import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, writeFileSync, unlinkSync } from 'fs';
import os from 'os';

const ffmpegBinary = os.platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
ffmpeg.setFfmpegPath(join(process.cwd(), 'node_modules', 'ffmpeg-static', ffmpegBinary));

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const OUTPUT_DIR = join(process.cwd(), 'output');

/**
 * Detect if a video file has soft subtitle streams (removable streams).
 * Returns true if ffprobe finds any subtitle codec stream.
 */
function detectSoftSubs(videoPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        resolve(false);
        return;
      }
      const hasSubs = (metadata.streams || []).some(
        (s) => s.codec_type === 'subtitle'
      );
      resolve(hasSubs);
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const { fileIds, autoZoomPercent } = await req.json();

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const outputFilename = `master-${uuidv4()}.mp4`;
    const outputPath = join(OUTPUT_DIR, outputFilename);

    let targetInputPath = join(UPLOAD_DIR, fileIds[0]);

    // If multiple files, merge them first using concat demuxer
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

    // Detect soft subtitle streams BEFORE encoding
    const hadSoftSubs = await detectSoftSubs(targetInputPath);
    if (hadSoftSubs) {
      console.log('[Process] Soft subtitle stream detected — will strip with -sn');
    }

    // Apply crop/zoom if needed, always strip soft subs (-sn)
    await new Promise<void>((resolve, reject) => {
      let command = ffmpeg(targetInputPath);

      const outputOpts: string[] = [];

      if (autoZoomPercent && autoZoomPercent > 0) {
        // Scale up then crop center to original dimensions
        const sc = 1 + (autoZoomPercent / 100);
        command = command.videoFilters([
          `scale=iw*${sc.toFixed(3)}:ih*${sc.toFixed(3)}`,
          `crop=iw/${sc.toFixed(3)}:ih/${sc.toFixed(3)}`
        ]);
        outputOpts.push('-c:v', 'libx264', '-crf', '22', '-preset', 'fast', '-c:a', 'copy');
      } else if (hadSoftSubs) {
        // Need to re-encode video pass to ensure subtitle streams are stripped
        outputOpts.push('-c:v', 'libx264', '-crf', '22', '-preset', 'fast', '-c:a', 'copy');
      } else {
        // No crop, no subs — just stream copy
        outputOpts.push('-c', 'copy');
      }

      // Always strip subtitle streams from output
      outputOpts.push('-sn');

      command
        .outputOptions(outputOpts)
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

    return NextResponse.json({ success: true, mergedFileId: outputFilename, hadSoftSubs });

  } catch (error: any) {
    console.error('Process Error:', error);
    return NextResponse.json({
      error: 'Processing failed: ' + (error.message || String(error)),
    }, { status: 500 });
  }
}
