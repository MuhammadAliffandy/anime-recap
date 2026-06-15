import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
import os from 'os';

const ffmpegBinary = os.platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
const ffmpegPath = join(process.cwd(), 'node_modules', 'ffmpeg-static', ffmpegBinary);

const UPLOAD_DIR = join(process.cwd(), 'uploads');

export async function POST(req: NextRequest) {
  try {
    const { fileId } = await req.json();

    if (!fileId) {
      return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
    }

    const videoPath = join(UPLOAD_DIR, fileId);
    if (!existsSync(videoPath)) {
      return NextResponse.json({ error: 'Video file not found' }, { status: 404 });
    }

    // Run ffmpeg with both blackdetect and silencedetect
    // -an is omitted because silencedetect needs audio
    // -vn is omitted because blackdetect needs video
    const args = [
      '-i', videoPath,
      '-vf', 'blackdetect=d=0.05:pix_th=0.1',
      '-af', 'silencedetect=noise=-30dB:d=0.5',
      '-f', 'null',
      '-',
      '-nostats'
    ];

    let output = '';

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpegPath, args);

      proc.stderr.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) reject(new Error(`ffmpeg exited with code ${code}`));
        else resolve();
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });

    const lines = output.split('\n');

    const blackStarts: number[] = [];
    const silenceStarts: number[] = [];
    
    // Parse the output
    for (const line of lines) {
      if (line.includes('black_start:')) {
        const match = line.match(/black_start:([0-9.]+)/);
        if (match) blackStarts.push(parseFloat(match[1]));
      }
      if (line.includes('silence_start:')) {
        const match = line.match(/silence_start:\s*([0-9.]+)/);
        if (match) silenceStarts.push(parseFloat(match[1]));
      }
    }

    // We combine all "scene break" candidates from both black frames and silences
    const allBreaks = [...blackStarts, ...silenceStarts].sort((a, b) => a - b);
    
    // De-duplicate breaks that are very close to each other (e.g. within 1 second)
    const uniqueBreaks: number[] = [];
    for (const b of allBreaks) {
      if (uniqueBreaks.length === 0 || b - uniqueBreaks[uniqueBreaks.length - 1] > 1.0) {
        uniqueBreaks.push(b);
      }
    }

    let detectedOpening = 90; // default 90s
    let detectedEnding = 90; // default 90s

    // Get video duration to find ending
    let duration = 1440; // fallback 24 mins
    for (const line of lines) {
      if (line.includes('Duration:')) {
        const match = line.match(/Duration: (\d+):(\d+):([0-9.]+)/);
        if (match) {
          duration = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3]);
        }
      }
    }

    // 1. Detect Opening
    // Look for a break in the first 6 mins (360s) that is followed by another break ~90s later
    let opFound = false;
    for (let i = 0; i < uniqueBreaks.length; i++) {
      for (let j = i + 1; j < uniqueBreaks.length; j++) {
        const diff = uniqueBreaks[j] - uniqueBreaks[i];
        if (diff >= 85 && diff <= 95 && uniqueBreaks[j] <= 360) {
          detectedOpening = Math.round(uniqueBreaks[j]);
          opFound = true;
          break;
        }
      }
      if (opFound) break;
    }

    // Fallback: If no 90s gap found, but there is a clear break around 90s
    if (!opFound) {
      const near90 = uniqueBreaks.find(b => b >= 80 && b <= 100);
      if (near90) detectedOpening = Math.round(near90);
    }

    // 2. Detect Ending
    // Look for a break in the last 6 mins that is followed by another break ~90s later
    let edFound = false;
    for (let i = 0; i < uniqueBreaks.length; i++) {
      for (let j = i + 1; j < uniqueBreaks.length; j++) {
        const diff = uniqueBreaks[j] - uniqueBreaks[i];
        if (diff >= 85 && diff <= 95 && uniqueBreaks[i] >= duration - 360) {
          // The ending starts at uniqueBreaks[i]
          // The UI asks for "seconds from end", so duration - ED start
          detectedEnding = Math.round(duration - uniqueBreaks[i]);
          edFound = true;
          break;
        }
      }
      if (edFound) break;
    }

    // Fallback: If no 90s gap found, but there is a clear break ~90s before the end
    if (!edFound) {
      const nearEnd90 = uniqueBreaks.find(b => duration - b >= 80 && duration - b <= 100);
      if (nearEnd90) detectedEnding = Math.round(duration - nearEnd90);
    }

    return NextResponse.json({
      success: true,
      openingDuration: detectedOpening,
      endingDuration: detectedEnding,
      duration: Math.round(duration),
    });

  } catch (error: any) {
    console.error('Detect Error:', error);
    return NextResponse.json(
      { error: 'Detection failed: ' + (error.message || String(error)) },
      { status: 500 }
    );
  }
}
