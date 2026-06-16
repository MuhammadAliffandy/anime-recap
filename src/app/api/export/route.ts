import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { writeFileSync, existsSync, unlinkSync } from 'fs';
import os from 'os';

const ffmpegBinary = os.platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
ffmpeg.setFfmpegPath(join(process.cwd(), 'node_modules', 'ffmpeg-static', ffmpegBinary));

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

    console.log(`[EXPORT] Received request. words.length: ${words?.length}`);

    if (!videoFileId) {
      return NextResponse.json({ error: 'Missing videoFileId' }, { status: 400 });
    }

    const { 
      mirror, 
      colorGrade, 
      contrast, 
      saturation, 
      warmth, 
      zoom, 
      blurBackground,
      panX = 50,
      panY = 50
    } = transforms || {};

    const videoPath = join(OUTPUT_DIR, videoFileId);
    const audioPath = audioFileId ? join(OUTPUT_DIR, audioFileId) : null;
    const finalFileId = `final-export-${uuidv4()}.${outputFormat || 'mp4'}`;
    const outputPath = join(OUTPUT_DIR, finalFileId);

    // Create Subtitles
    const srtPath = join(OUTPUT_DIR, `subs-${uuidv4()}.ass`);
    if (words && words.length > 0) {
      writeFileSync(srtPath, wordsToAss(words));
    }

    await new Promise<void>((resolve, reject) => {
      let command = ffmpeg().input(videoPath);

      const vfParts: string[] = [];
      let complexFilterStr = '';

      // 9:16 blurred background mode
      if (blurBackground) {
        const scaleAndCrop = zoom && zoom > 1.0 
          ? `[scaled_fg]crop=iw/${zoom}:ih/${zoom}:(iw-iw/${zoom})*(${panX}/100):(ih-ih/${zoom})*(${panY}/100)[fg_cropped];[fg_cropped]` 
          : '[scaled_fg]';

        complexFilterStr = `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,boxblur=20:20[bg];` +
          `[0:v]scale=1080:1920:force_original_aspect_ratio=decrease${scaleAndCrop}[fg];` +
          `[bg][fg]overlay=(W-w)/2:(H-h)/2[vid]`;
      } else {
        // Zoom/Crop
        if (zoom && zoom > 1.0) {
          vfParts.push(`crop=iw/${zoom}:ih/${zoom}:(iw-iw/${zoom})*(${panX}/100):(ih-ih/${zoom})*(${panY}/100)`);
        }

        // Force to 1080p height first for consistency.
        vfParts.push('scale=-2:1080');

        if (mirror) vfParts.push('hflip');
        if (colorGrade) {
          vfParts.push(`eq=contrast=${contrast}:saturation=${saturation}`, `hue=h=${warmth}`);
        }
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

      // Only add separate audio input if we have one
      if (audioPath) command = command.input(audioPath);

      const audioMap = audioPath ? '1:a' : '0:a';

      if (complexFilterStr) {
        command = command.complexFilter(complexFilterStr);
        command = command.outputOptions(['-map', '[final]', '-map', audioMap]);
      } else if (vfParts.length > 0) {
        command = command.videoFilters(vfParts);
        command = command.outputOptions(['-map', '0:v', '-map', audioMap]);
      } else {
        command = command.outputOptions(['-map', '0:v', '-map', audioMap]);
      }

      command = command.outputOptions([
        '-c:v', 'libx264',
        '-crf', '18',
        '-preset', 'medium',
        '-r', '30',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '44100',
        '-ac', '2',
        '-movflags', 'faststart',
        '-shortest',
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
