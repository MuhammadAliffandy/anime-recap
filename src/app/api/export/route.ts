import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { writeFileSync, existsSync, unlinkSync } from 'fs';

ffmpeg.setFfmpegPath(ffmpegStatic as string);

const OUTPUT_DIR = join(process.cwd(), 'output');

// Helper to convert words to ASS format
function wordsToAss(words: any[]): string {
  const toAss = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const cs = Math.round((s % 1) * 100);
    return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
  };

  const groups = [];
  let group = [];
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

  const events = groups.map(g => {
    const text = g.map(w => w.word).join(' ').trim();
    return `Dialogue: 0,${toAss(g[0].start)},${toAss(g[g.length-1].end)},Default,,0,0,0,,${text}`;
  }).join('\n');

  return header + events + '\n';
}

export async function POST(req: NextRequest) {
  try {
    const { 
      videoFileId, 
      audioFileId, 
      words, 
      transforms, 
      outputFormat 
    } = await req.json();

    if (!videoFileId || !audioFileId) {
      return NextResponse.json({ error: 'Missing required files' }, { status: 400 });
    }

    const videoPath = join(OUTPUT_DIR, videoFileId);
    const audioPath = join(OUTPUT_DIR, audioFileId);

    if (!existsSync(videoPath) || !existsSync(audioPath)) {
      return NextResponse.json({ error: 'Source files not found on server' }, { status: 404 });
    }

    const outFilename = `export-${uuidv4()}.mp4`;
    const outputPath = join(OUTPUT_DIR, outFilename);
    const srtPath = join(OUTPUT_DIR, `subs-${uuidv4()}.ass`);

    // Create Subtitles
    if (words && words.length > 0) {
      writeFileSync(srtPath, wordsToAss(words));
    }

    const {
      mirror,
      colorGrade,
      contrast,
      saturation,
      warmth,
      blurBackground
    } = transforms || {};

    let vfParts: string[] = [];
    let complexFilterStr = '';

    // We assume 16:9 1080p source. 
    // Wait, the video could be anything. We will force to 1080p height first for consistency.
    vfParts.push('scale=-2:1080');

    if (mirror) vfParts.push('hflip');
    if (colorGrade) {
      vfParts.push(`eq=contrast=${contrast}:saturation=${saturation}`, `hue=h=${warmth}`);
    }

    if (outputFormat === '9:16' && blurBackground) {
      const outW = 1080, outH = 1920;
      const bgChain = `scale=${outW}:${outH}:force_original_aspect_ratio=increase,crop=${outW}:${outH},boxblur=20:5`;
      const fgParts = [...vfParts, `scale=${outW}:-2`];
      
      complexFilterStr = `[0:v]${bgChain}[bg];[0:v]${fgParts.join(',')}[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[vid]`;
    } else if (outputFormat === '9:16') {
      vfParts.push('crop=ih*(9/16):ih');
    }

    // Add subtitles filter
    if (words && words.length > 0) {
      // ffmpeg needs the path escaped
      const escapedPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
      if (complexFilterStr) {
        complexFilterStr += `;[vid]ass='${escapedPath}'[final]`;
      } else {
        vfParts.push(`ass='${escapedPath}'`);
      }
    }

    await new Promise<void>((resolve, reject) => {
      let command = ffmpeg()
        .input(videoPath)
        .input(audioPath); // Map audio track 1 (TTS)

      if (complexFilterStr) {
        command = command.complexFilter(complexFilterStr);
        command = command.outputOptions(['-map', '[final]', '-map', '1:a']);
      } else if (vfParts.length > 0) {
        command = command.videoFilters(vfParts);
        command = command.outputOptions(['-map', '0:v', '-map', '1:a']);
      } else {
        command = command.outputOptions(['-map', '0:v', '-map', '1:a']);
      }

      // Fastest encoding settings for development/demo
      command = command.outputOptions([
        '-c:v', 'libx264', 
        '-crf', '26', 
        '-preset', 'ultrafast', 
        '-c:a', 'aac', 
        '-ar', '44100', 
        '-ac', '2',
        '-movflags', 'faststart',
        '-shortest' // Stop encoding when shortest stream ends (usually audio)
      ]);

      command
        .save(outputPath)
        .on('end', () => {
          if (existsSync(srtPath)) unlinkSync(srtPath);
          resolve();
        })
        .on('error', (err) => {
          if (existsSync(srtPath)) unlinkSync(srtPath);
          reject(err);
        });
    });

    return NextResponse.json({ success: true, exportedFileId: outFilename });

  } catch (error: any) {
    console.error('Export Error:', error);
    return NextResponse.json({ error: 'Export failed: ' + error.message }, { status: 500 });
  }
}
