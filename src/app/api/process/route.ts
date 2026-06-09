import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, writeFileSync, unlinkSync } from 'fs';

ffmpeg.setFfmpegPath(ffmpegStatic as string);

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const OUTPUT_DIR = join(process.cwd(), 'output');

export async function POST(req: NextRequest) {
  try {
    const { fileIds, autoZoomPercent } = await req.json();

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const outputFilename = `master-${uuidv4()}.mp4`;
    const outputPath = join(OUTPUT_DIR, outputFilename);

    let targetInputPath = join(UPLOAD_DIR, fileIds[0]);

    // If multiple files, we need to merge them first using concat demuxer
    if (fileIds.length > 1) {
      const listPath = join(UPLOAD_DIR, `concat-${uuidv4()}.txt`);
      const fileListContent = fileIds
        .map(id => `file '${join(UPLOAD_DIR, id).replace(/\\/g, '/')}'`)
        .join('\n');
      
      writeFileSync(listPath, fileListContent);
      
      const mergedTempPath = join(UPLOAD_DIR, `temp-merged-${uuidv4()}.mp4`);
      
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(listPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .outputOptions(['-c', 'copy'])
          .save(mergedTempPath)
          .on('end', () => {
            if (existsSync(listPath)) unlinkSync(listPath);
            resolve();
          })
          .on('error', (err) => {
            if (existsSync(listPath)) unlinkSync(listPath);
            reject(err);
          });
      });

      targetInputPath = mergedTempPath;
    }

    // Now apply crop if necessary, or just copy to output
    await new Promise<void>((resolve, reject) => {
      let command = ffmpeg(targetInputPath);

      if (autoZoomPercent && autoZoomPercent > 0) {
        // Calculate crop scale based on percent (e.g. 15% -> scale=1.15)
        const sc = 1 + (autoZoomPercent / 100);
        // We scale up by sc, then crop the center to the original dimensions
        command = command.videoFilters([
          `scale=iw*${sc.toFixed(3)}:ih*${sc.toFixed(3)}`,
          `crop=iw/${sc.toFixed(3)}:ih/${sc.toFixed(3)}`
        ]);
        // re-encode video, copy audio
        command = command.outputOptions(['-c:v', 'libx264', '-crf', '22', '-preset', 'fast', '-c:a', 'copy']);
      } else {
        // No crop needed, just copy stream
        command = command.outputOptions(['-c', 'copy']);
      }

      command
        .save(outputPath)
        .on('end', () => {
          // Cleanup temp merge file if we made one
          if (fileIds.length > 1 && existsSync(targetInputPath)) {
            unlinkSync(targetInputPath);
          }
          resolve();
        })
        .on('error', (err) => reject(err));
    });

    return NextResponse.json({ success: true, mergedFileId: outputFilename });

  } catch (error: any) {
    console.error('Process Error:', error);
    return NextResponse.json({ error: 'Processing failed: ' + error.message }, { status: 500 });
  }
}
