import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, mkdirSync } from 'fs';
import os from 'os';

const ffmpegBinary = os.platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
ffmpeg.setFfmpegPath(join(process.cwd(), 'node_modules', 'ffmpeg-static', ffmpegBinary));

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const OUTPUT_DIR = join(process.cwd(), 'output');

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

/**
 * Get video duration in seconds using ffprobe.
 */
function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const { fileId, openingDuration = 90, endingDuration = 90 } = await req.json();

    if (!fileId) {
      return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
    }

    const inputPath = join(UPLOAD_DIR, fileId);
    if (!existsSync(inputPath)) {
      return NextResponse.json({ error: 'Video file not found' }, { status: 404 });
    }

    // Get video duration to calculate end time
    const duration = await getVideoDuration(inputPath);
    const startTime = openingDuration;
    const endTime = duration - endingDuration;

    if (endTime <= startTime) {
      return NextResponse.json(
        { error: `Video is too short to strip ${openingDuration}s opening and ${endingDuration}s ending from a ${Math.round(duration)}s video.` },
        { status: 400 }
      );
    }

    const outputFilename = `stripped-${uuidv4()}.mp4`;
    const outputPath = join(OUTPUT_DIR, outputFilename);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(endTime - startTime)
        .outputOptions([
          '-c', 'copy',      // stream copy - fast, no re-encode
          '-avoid_negative_ts', 'make_zero',
        ])
        .save(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });

    return NextResponse.json({
      success: true,
      strippedFileId: outputFilename,
      originalDuration: Math.round(duration),
      strippedDuration: Math.round(endTime - startTime),
    });

  } catch (error: any) {
    console.error('Strip Error:', error);
    return NextResponse.json(
      { error: 'Strip failed: ' + (error.message || String(error)) },
      { status: 500 }
    );
  }
}
