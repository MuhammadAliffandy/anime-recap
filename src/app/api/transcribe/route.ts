import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import OpenAI from 'openai';
import { join } from 'path';
import { existsSync, unlinkSync, createReadStream } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';

const ffmpegBinary = os.platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
ffmpeg.setFfmpegPath(join(process.cwd(), 'node_modules', 'ffmpeg-static', ffmpegBinary));

const OUTPUT_DIR = join(process.cwd(), 'output');
const UPLOAD_DIR = join(process.cwd(), 'uploads');

export async function POST(req: NextRequest) {
  try {
    const { fileId, provider, animeTitle, animeSynopsis } = await req.json();
    const groqKey = req.headers.get('x-groq-key');
    const openaiKey = req.headers.get('x-openai-key');

    if (!fileId) return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });

    // Check OUTPUT_DIR first (stripped files land here), then UPLOAD_DIR fallback
    let videoPath = join(OUTPUT_DIR, fileId);
    if (!existsSync(videoPath)) {
      videoPath = join(UPLOAD_DIR, fileId);
    }
    if (!existsSync(videoPath)) {
      return NextResponse.json({ error: 'Video file not found' }, { status: 404 });
    }

    const useGroq = provider === 'groq';
    const apiKey = useGroq ? groqKey : openaiKey;

    if (!apiKey) {
      return NextResponse.json({ error: `Missing API Key for ${provider}` }, { status: 401 });
    }

    // 1. Extract Audio (low-bitrate mono for fast upload to Whisper)
    const audioFilename = `audio-${uuidv4()}.mp3`;
    const audioPath = join(UPLOAD_DIR, audioFilename);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .audioCodec('libmp3lame')
        .audioBitrate('32k')
        .audioChannels(1)
        .audioFrequency(16000)
        .noVideo()
        .save(audioPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });

    // 2. Send to Whisper API
    const client = new OpenAI({
      apiKey,
      baseURL: useGroq ? 'https://api.groq.com/openai/v1' : undefined,
    });

    const response = await client.audio.translations.create({
      file: createReadStream(audioPath) as any,
      model: useGroq ? 'whisper-large-v3' : 'whisper-1',
      response_format: 'verbose_json',
      prompt: animeTitle ? `Context: Anime "${animeTitle}". Character names might include standard Japanese names.` : undefined,
    }) as any;

    // Cleanup audio
    if (existsSync(audioPath)) unlinkSync(audioPath);

    const words = (response.words || []).map((w: any) => ({
      word: w.word.trim(),
      start: w.start,
      end: w.end,
    }));

    return NextResponse.json({
      success: true,
      text: response.text,
      words,
    });

  } catch (error: any) {
    console.error('Transcription Error:', error);
    return NextResponse.json({ error: 'Transcription failed: ' + error.message }, { status: 500 });
  }
}
