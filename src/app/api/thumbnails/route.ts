import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, readdirSync, statSync } from 'fs';
import os from 'os';

const ffmpegBinary = os.platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
ffmpeg.setFfmpegPath(join(process.cwd(), 'node_modules', 'ffmpeg-static', ffmpegBinary));

const OUTPUT_DIR = join(process.cwd(), 'output');

// Helper to get video duration
function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, meta) => {
      if (err) return reject(err);
      resolve(meta.format.duration || 60);
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const { videoFileId } = await req.json();

    if (!videoFileId) return NextResponse.json({ error: 'Missing video file ID' }, { status: 400 });

    const videoPath = join(OUTPUT_DIR, videoFileId);
    if (!existsSync(videoPath)) return NextResponse.json({ error: 'Video file not found' }, { status: 404 });

    const duration = await getVideoDuration(videoPath);
    
    // We want 3 thumbnails from different parts of the video
    // 20%, 50%, and 80% marks
    const timestamps = [
      Math.floor(duration * 0.2),
      Math.floor(duration * 0.5),
      Math.floor(duration * 0.8)
    ];

    const prefix = `thumb-${uuidv4()}`;

    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .takeScreenshots({
          count: 3,
          timemarks: timestamps,
          filename: `${prefix}-%i.jpg`,
          folder: OUTPUT_DIR,
          size: '1920x1080' // High quality thumbnails
        });
    });

    // FFmpeg creates files like thumb-xxx-1.jpg, thumb-xxx-2.jpg
    // Let's find them
    const files = readdirSync(OUTPUT_DIR)
      .filter(f => f.startsWith(prefix) && f.endsWith('.jpg'))
      .sort();

    return NextResponse.json({ success: true, thumbnails: files });

  } catch (error: any) {
    console.error('Thumbnail Error:', error);
    return NextResponse.json({ error: 'Thumbnail generation failed: ' + error.message }, { status: 500 });
  }
}
