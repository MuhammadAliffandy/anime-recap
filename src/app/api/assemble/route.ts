import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import os from 'os';

const ffmpegBinary = os.platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
ffmpeg.setFfmpegPath(join(process.cwd(), 'node_modules', 'ffmpeg-static', ffmpegBinary));

const OUTPUT_DIR = join(process.cwd(), 'output');

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

interface SceneTimestamp {
  start: number;
  end: number;
  narration: string;
}

interface EpisodeSegment {
  videoFileId: string;   // stripped video file in OUTPUT_DIR
  audioFileId: string;   // TTS audio file in OUTPUT_DIR
  audioWords: { word: string; start: number; end: number }[];
  sceneTimestamps?: SceneTimestamp[];
}

interface AssembleBody {
  animeTitle: string;
  prologAudioFileId?: string;
  prologAudioWords?: { word: string; start: number; end: number }[];
  episodes: EpisodeSegment[];
  outputFormat?: '16:9' | '9:16';
}



function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

/**
 * Semantic assembly: cut exact video segments matching each scene timestamp,
 * then re-encode them at the exact TTS audio duration.
 * Returns a single combined clip path.
 */
async function buildSemanticClip(
  videoPath: string,
  audioPath: string,
  audioDuration: number,
  scenes: SceneTimestamp[],
  outPath: string
): Promise<void> {
  // Map scene video duration proportionally to TTS audio duration
  const totalScenesDuration = scenes.reduce((sum, s) => sum + Math.max(s.end - s.start, 0.5), 0);

  // Build a complex filter that trims each scene and concatenates them
  // then scales total duration to match audio
  const filterParts: string[] = [];
  const concatInputs: string[] = [];

  scenes.forEach((scene, i) => {
    const sceneDuration = Math.max(scene.end - scene.start, 0.5);
    // How much audio time this scene "owns" proportionally
    const targetDuration = (sceneDuration / totalScenesDuration) * audioDuration;
    // Use setpts to stretch/compress the scene to targetDuration
    const pts = targetDuration / sceneDuration;
    filterParts.push(
      `[0:v]trim=start=${scene.start}:end=${scene.end},setpts=${pts.toFixed(6)}*(PTS-STARTPTS)[v${i}]`
    );
    concatInputs.push(`[v${i}]`);
  });

  const filterComplex = [
    ...filterParts,
    `${concatInputs.join('')}concat=n=${scenes.length}:v=1:a=0[vout]`,
  ].join(';');

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        '-filter_complex', filterComplex,
        '-map', '[vout]',
        '-map', '1:a',
        '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-r', '30',
        '-c:a', 'aac', '-ar', '44100', '-ac', '2',
        '-t', String(audioDuration),
        '-movflags', 'faststart',
      ])
      .save(outPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });
}

function buildHighlightFilter(videoDuration: number, audioDuration: number, clipDuration = 5): string | null {
  if (videoDuration <= audioDuration) return null;
  const interval = (videoDuration * clipDuration) / audioDuration;
  return `[0:v]select='lt(mod(t\\, ${interval.toFixed(2)})\\, ${clipDuration})',setpts=N/FRAME_RATE/TB[v]`;
}

export async function POST(req: NextRequest) {
  const tempFiles: string[] = [];

  try {
    const body: AssembleBody = await req.json();
    const { animeTitle, prologAudioFileId, prologAudioWords = [], episodes, outputFormat = '16:9' } = body;

    if (!episodes || episodes.length === 0) {
      return NextResponse.json({ error: 'No episodes provided' }, { status: 400 });
    }

    // Validate all files exist
    for (const ep of episodes) {
      const vp = join(OUTPUT_DIR, ep.videoFileId);
      const ap = join(OUTPUT_DIR, ep.audioFileId);
      if (!existsSync(vp)) return NextResponse.json({ error: `Video not found: ${ep.videoFileId}` }, { status: 404 });
      if (!existsSync(ap)) return NextResponse.json({ error: `Audio not found: ${ep.audioFileId}` }, { status: 404 });
    }

    // ── Step 1: Optionally create prolog clip (using ep 1 video + prolog audio) ──
    const finalWords: { word: string; start: number; end: number }[] = [];
    let cumulativeDuration = 0;

    let prologClipFilename: string | null = null;
    if (prologAudioFileId && existsSync(join(OUTPUT_DIR, prologAudioFileId))) {
      const prologAudioPath = join(OUTPUT_DIR, prologAudioFileId);
      const prologDuration = await getAudioDuration(prologAudioPath);
      prologClipFilename = `clip-prolog-${uuidv4()}.mp4`;
      const prologClipPath = join(OUTPUT_DIR, prologClipFilename);
      tempFiles.push(prologClipPath);

      if (prologAudioWords) {
        prologAudioWords.forEach(w => {
          finalWords.push({ word: w.word, start: w.start + cumulativeDuration, end: w.end + cumulativeDuration });
        });
      }

      // Use Episode 1 video for prolog background instead of black screen
      const bgVideoPath = join(OUTPUT_DIR, episodes[0].videoFileId);
      const bgVideoDuration = await getVideoDuration(bgVideoPath);
      const highlightFilter = buildHighlightFilter(bgVideoDuration, prologDuration, 4); // 4 sec clips for prolog

      await new Promise<void>((resolve, reject) => {
        const cmd = ffmpeg().input(bgVideoPath);
        if (!highlightFilter) {
          cmd.inputOptions(['-stream_loop', '-1']);
        }
        cmd.input(prologAudioPath);

        const outputOpts: string[] = [];
        if (highlightFilter) {
          outputOpts.push('-filter_complex', highlightFilter);
          outputOpts.push('-map', '[v]');
        } else {
          outputOpts.push('-map', '0:v');
        }
        outputOpts.push('-map', '1:a');
        outputOpts.push('-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-r', '30');
        outputOpts.push('-c:a', 'aac', '-ar', '44100', '-ac', '2');
        outputOpts.push('-t', String(prologDuration), '-movflags', 'faststart');

        cmd.outputOptions(outputOpts)
          .save(prologClipPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err));
      });
      
      cumulativeDuration += prologDuration;
    }

    // ── Step 2: For each episode, create a clip trimmed to match TTS audio duration ──
    const episodeClips: string[] = [];

    for (let i = 0; i < episodes.length; i++) {
      const ep = episodes[i];
      const videoPath = join(OUTPUT_DIR, ep.videoFileId);
      const audioPath = join(OUTPUT_DIR, ep.audioFileId);

      const audioDuration = await getAudioDuration(audioPath);

      if (ep.audioWords) {
        ep.audioWords.forEach(w => {
          finalWords.push({ word: w.word, start: w.start + cumulativeDuration, end: w.end + cumulativeDuration });
        });
      }

      const clipFilename = `clip-ep${i + 1}-${uuidv4()}.mp4`;
      const clipPath = join(OUTPUT_DIR, clipFilename);
      tempFiles.push(clipPath);

      const hasSemanticScenes = ep.sceneTimestamps && ep.sceneTimestamps.length > 0;

      if (hasSemanticScenes) {
        // ── Semantic mode: cut exact scenes from the source video ──
        console.log(`[Assemble] Episode ${i + 1}: using semantic scene matching (${ep.sceneTimestamps!.length} scenes)`);
        await buildSemanticClip(videoPath, audioPath, audioDuration, ep.sceneTimestamps!, clipPath);
      } else {
        // ── Fallback: uniform montage (old behavior) ──
        console.log(`[Assemble] Episode ${i + 1}: no scene timestamps, using uniform montage fallback`);
        const videoDuration = await getVideoDuration(videoPath);
        const highlightFilter = buildHighlightFilter(videoDuration, audioDuration, 5);

        await new Promise<void>((resolve, reject) => {
          const cmd = ffmpeg().input(videoPath);
          if (!highlightFilter) {
            cmd.inputOptions(['-stream_loop', '-1']);
          }
          cmd.input(audioPath);

          const outputOpts: string[] = [];
          if (highlightFilter) {
            outputOpts.push('-filter_complex', highlightFilter);
            outputOpts.push('-map', '[v]');
          } else {
            outputOpts.push('-map', '0:v');
          }
          outputOpts.push('-map', '1:a');
          outputOpts.push('-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-r', '30');
          outputOpts.push('-c:a', 'aac', '-ar', '44100', '-ac', '2');
          outputOpts.push('-t', String(audioDuration), '-movflags', 'faststart');

          cmd.outputOptions(outputOpts)
            .save(clipPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err));
        });
      }

      episodeClips.push(clipFilename);
      cumulativeDuration += audioDuration;
    }

    // ── Step 3: Concat all clips with ffmpeg concat demuxer ──
    const allClips = [
      ...(prologClipFilename ? [prologClipFilename] : []),
      ...episodeClips,
    ];

    const concatListPath = join(OUTPUT_DIR, `concat-${uuidv4()}.txt`);
    tempFiles.push(concatListPath);
    const concatContent = allClips
      .map((c) => `file '${join(OUTPUT_DIR, c).replace(/\\/g, '/')}'`)
      .join('\n');
    writeFileSync(concatListPath, concatContent);

    const finalFilename = `final-recap-${uuidv4()}.mp4`;
    const finalPath = join(OUTPUT_DIR, finalFilename);

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(concatListPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions([
          '-c', 'copy',
          '-movflags', 'faststart',
        ])
        .save(finalPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });

    // Cleanup temp files
    for (const f of tempFiles) {
      if (existsSync(f)) unlinkSync(f);
    }

    return NextResponse.json({
      success: true,
      finalFileId: finalFilename,
      finalWords,
      episodeCount: episodes.length,
      hasProlog: !!prologClipFilename,
    });

  } catch (error: any) {
    // Cleanup temp files on error too
    for (const f of tempFiles) {
      try { if (existsSync(f)) unlinkSync(f); } catch {}
    }
    console.error('Assemble Error:', error);
    return NextResponse.json(
      { error: 'Assembly failed: ' + (error.message || String(error)) },
      { status: 500 }
    );
  }
}
