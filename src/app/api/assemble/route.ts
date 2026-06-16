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

interface EpisodeSegment {
  videoFileId: string;   // stripped video file in OUTPUT_DIR
  audioFileId: string;   // TTS audio file in OUTPUT_DIR
  audioWords: { word: string; start: number; end: number }[];
}

interface AssembleBody {
  animeTitle: string;
  prologAudioFileId?: string;
  prologAudioWords?: { word: string; start: number; end: number }[];
  episodes: EpisodeSegment[];
  outputFormat?: '16:9' | '9:16';
}

function wordsToAss(words: { word: string; start: number; end: number }[], timeOffset = 0): string {
  const toAss = (s: number) => {
    const adjusted = s + timeOffset;
    const h = Math.floor(adjusted / 3600);
    const m = Math.floor((adjusted % 3600) / 60);
    const sec = Math.floor(adjusted % 60);
    const cs = Math.round((adjusted % 1) * 100);
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  };

  const groups: typeof words[] = [];
  let group: typeof words = [];
  for (const w of words) {
    group.push(w);
    if (group.length >= 5) { groups.push(group); group = []; }
  }
  if (group.length) groups.push(group);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginV
Style: Default,Arial,60,&H0000FFFF,&H00000000,&H80000000,-1,1,3,2,2,50

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = groups.map((g) => {
    const text = g.map((w) => w.word).join(' ').trim();
    return `Dialogue: 0,${toAss(g[0].start)},${toAss(g[g.length - 1].end)},Default,,0,0,0,,${text}`;
  }).join('\n');

  return header + events + '\n';
}

function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
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
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(bgVideoPath).inputOptions(['-stream_loop', '-1'])
          .input(prologAudioPath)
          .outputOptions([
            '-map', '0:v',
            '-map', '1:a',
            '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-r', '30',
            '-c:a', 'aac', '-ar', '44100', '-ac', '2',
            '-t', String(prologDuration),
            '-movflags', 'faststart',
          ])
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

      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(videoPath).inputOptions(['-stream_loop', '-1'])
          .input(audioPath)
          .outputOptions([
            '-map', '0:v',
            '-map', '1:a',
            '-c:v', 'libx264',
            '-crf', '18',
            '-preset', 'medium',
            '-r', '30',
            '-c:a', 'aac',
            '-ar', '44100',
            '-ac', '2',
            '-t', String(audioDuration),
            '-movflags', 'faststart',
          ])
          .save(clipPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err));
      });

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
