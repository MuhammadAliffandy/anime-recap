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
  /** Height % of the bottom region to blur for hiding hardcoded subtitles. Default 15. */
  subtitleRegionHeightPct?: number;
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
 * Builds an FFmpeg filter_complex string that:
 *  1. Blurs the bottom strip of the video (to cover hardcoded subs).
 *  2. Overlays our narration words as timed drawtext captions.
 *
 * @param words - word-level timestamps (relative to start of clip, in seconds)
 * @param blurHeightPct - fraction of video height to blur from bottom (e.g. 0.15 = 15%)
 * @param videoLabel - input video stream label
 * @param outLabel - output stream label
 */
function buildSubtitleOverlayFilter(
  words: { word: string; start: number; end: number }[],
  blurHeightPct: number,
  videoLabel = '[inv]',
  outLabel = '[vfinal]'
): string {
  const topPct = (1 - blurHeightPct).toFixed(4);
  const blurPct = blurHeightPct.toFixed(4);

  const escapeText = (t: string) =>
    t.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:').replace(/%/g, '\\%');

  const parts: string[] = [
    // Crop the subtitle region from the bottom
    `${videoLabel}crop=iw:ih*${blurPct}:0:ih*${topPct}[sub_strip]`,
    // Blur it heavily
    `[sub_strip]boxblur=luma_radius=25:luma_power=3[blurred_strip]`,
    // Overlay blurred strip back onto the original video at the same Y position
    `${videoLabel}[blurred_strip]overlay=0:H*${topPct}[v_blurred]`,
  ];

  let prevLabel = '[v_blurred]';

  words.forEach((w, i) => {
    const isLast = i === words.length - 1;
    const nextLabel = isLast ? outLabel : `[dtxt${i}]`;
    const safeWord = escapeText(w.word);
    // Center horizontally, vertically center within the blurred subtitle strip
    const yExpr = `h*${(1 - blurHeightPct / 2).toFixed(4)}-text_h/2`;
    parts.push(
      `${prevLabel}drawtext=` +
        `text='${safeWord}':` +
        `fontsize=h/15:` +
        `fontcolor=white:` +
        `borderw=3:bordercolor=black:` +
        `font=Arial:` +
        `x=(w-text_w)/2:` +
        `y=${yExpr}:` +
        `enable='between(t\\,${w.start.toFixed(3)}\\,${w.end.toFixed(3)})'` +
        nextLabel
    );
    prevLabel = nextLabel;
  });

  // If no words at all, pass video through unchanged
  if (words.length === 0) {
    parts.push(`[v_blurred]copy${outLabel}`);
  }

  return parts.join(';');
}

/**
 * Semantic assembly: cut exact video segments matching each scene timestamp,
 * concatenate them at NORMAL speed (no stretch/compress) with crossfade dissolve
 * transitions between scenes, then trim/loop to match the TTS audio duration exactly.
 */
async function buildSemanticClip(
  videoPath: string,
  audioPath: string,
  audioDuration: number,
  scenes: SceneTimestamp[],
  tempDir: string,
  outPath: string,
  tempFiles: string[],
  words: { word: string; start: number; end: number }[],
  blurHeightPct: number
): Promise<void> {
  const FADE_DURATION = 0.3; // seconds for crossfade dissolve between scenes

  // Step 1: cut each scene at 1x speed into a temp clip
  const sceneClipPaths: string[] = [];
  const sceneClipDurations: number[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const start = Math.max(scene.start - 0.1, 0); // tiny pre-roll for accuracy
    const duration = Math.max(scene.end - scene.start, 0.5);
    const sceneClipPath = join(tempDir, `scene-${uuidv4()}.mp4`);
    tempFiles.push(sceneClipPath);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .inputOptions([`-ss ${start.toFixed(3)}`])
        .outputOptions([
          '-t', duration.toFixed(3),
          '-c:v', 'libx264', '-crf', '18', '-preset', 'ultrafast',
          '-r', '30',
          '-an',
          '-avoid_negative_ts', 'make_zero',
        ])
        .save(sceneClipPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });
    sceneClipPaths.push(sceneClipPath);
    sceneClipDurations.push(duration);
  }

  // Step 2: combine clips with concat demuxer (fast and avoids SIGSEGV)
  const sceneCombinedPath = join(tempDir, `scene-combined-${uuidv4()}.mp4`);
  tempFiles.push(sceneCombinedPath);

  if (sceneClipPaths.length === 1) {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(sceneClipPaths[0])
        .outputOptions(['-c:v', 'libx264', '-crf', '18', '-preset', 'ultrafast', '-r', '30', '-an'])
        .save(sceneCombinedPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });
  } else {
    const listPath = join(tempDir, `concat-scenes-${uuidv4()}.txt`);
    tempFiles.push(listPath);
    const listContent = sceneClipPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    writeFileSync(listPath, listContent);

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c', 'copy'])
        .save(sceneCombinedPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });
  }

  // Step 3: calculate total combined duration
  const totalSceneDuration = sceneClipDurations.reduce((s, d) => s + d, 0);

  // Step 4: apply subtitle blur+overlay, loop if needed, trim to exact audio duration
  await new Promise<void>((resolve, reject) => {
    const cmd = ffmpeg();
    if (totalSceneDuration < audioDuration) {
      cmd.input(sceneCombinedPath).inputOptions(['-stream_loop', '-1']);
    } else {
      cmd.input(sceneCombinedPath);
    }
    cmd.input(audioPath);

    const subtitleFilter = buildSubtitleOverlayFilter(words, blurHeightPct, '[0:v]', '[vfinal]');
    cmd.outputOptions([
      '-filter_complex', subtitleFilter,
      '-map', '[vfinal]',
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
    const { animeTitle, prologAudioFileId, prologAudioWords = [], episodes, outputFormat = '16:9', subtitleRegionHeightPct = 15 } = body;
    const blurHeightPct = Math.min(Math.max(subtitleRegionHeightPct / 100, 0.05), 0.35); // clamp 5%–35%

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
        await buildSemanticClip(videoPath, audioPath, audioDuration, ep.sceneTimestamps!, OUTPUT_DIR, clipPath, tempFiles, ep.audioWords ?? [], blurHeightPct);
      } else {
        // ── Fallback: uniform montage ──
        console.log(`[Assemble] Episode ${i + 1}: no scene timestamps, using uniform montage fallback`);
        const videoDuration = await getVideoDuration(videoPath);
        const highlightFilter = buildHighlightFilter(videoDuration, audioDuration, 5);

        const subtitleFilter = buildSubtitleOverlayFilter(ep.audioWords ?? [], blurHeightPct, '[vraw]', '[vfinal]');

        await new Promise<void>((resolve, reject) => {
          const cmd = ffmpeg().input(videoPath);
          if (!highlightFilter) {
            cmd.inputOptions(['-stream_loop', '-1']);
          }
          cmd.input(audioPath);

          // Build a combined filter: first highlight select (if any), then subtitle overlay
          let filterComplex: string;
          if (highlightFilter) {
            // highlightFilter outputs [v] — pipe into subtitle overlay
            const adjustedHighlight = highlightFilter.replace('[v]', '[vraw]');
            filterComplex = adjustedHighlight + ';' + subtitleFilter;
          } else {
            // No highlight filter — feed raw input into subtitle overlay
            filterComplex = '[0:v]copy[vraw];' + subtitleFilter;
          }

          cmd.outputOptions([
            '-filter_complex', filterComplex,
            '-map', '[vfinal]',
            '-map', '1:a',
            '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-r', '30',
            '-c:a', 'aac', '-ar', '44100', '-ac', '2',
            '-t', String(audioDuration),
            '-movflags', 'faststart',
          ])
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
