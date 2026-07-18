import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { writeFileSync, existsSync, createReadStream, readFileSync, unlinkSync } from 'fs';
import * as googleTTS from 'google-tts-api';
import OpenAI from 'openai';
import { EdgeTTS } from 'node-edge-tts';

const OUTPUT_DIR = join(process.cwd(), 'output');

function chunkText(text: string, maxLength: number = 3000): string[] {
  // Split by sentence endings or newlines, keeping the trailing text
  const sentences = (text.match(/[^.!?\n]+[.!?\n]*|\s*$/g) || []).filter(s => s.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk = '';
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxLength) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += ' ' + sentence;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

export async function POST(req: NextRequest) {
  try {
    const { script, provider, voiceId, openaiVoiceId, edgeVoiceId, sttProvider } = await req.json();
    const elevenLabsKey = req.headers.get('x-elevenlabs-key');
    const groqKey = req.headers.get('x-groq-key');
    const openaiKey = req.headers.get('x-openai-key');

    if (!script) return NextResponse.json({ error: 'Missing script' }, { status: 400 });

    const filename = `tts-${uuidv4()}.mp3`;
    const filepath = join(OUTPUT_DIR, filename);

    // 1. Generate TTS
    if (provider === 'elevenlabs') {
      if (!elevenLabsKey) return NextResponse.json({ error: 'Missing ElevenLabs API Key' }, { status: 401 });
      
      const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId || 'pNInz6obpgDQGcFmaJgB'}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsKey
        },
        body: JSON.stringify({
          text: script,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
      });

      if (!elRes.ok) {
        const errorText = await elRes.text();
        throw new Error(`ElevenLabs error: ${errorText}`);
      }
      
      const buffer = await elRes.arrayBuffer();
      writeFileSync(filepath, Buffer.from(buffer));

    } else if (provider === 'google') {
      // Chunking for Google TTS (max 200 chars per chunk usually, but library handles it)
      const results = await googleTTS.getAllAudioBase64(script, { lang: 'en', slow: false, timeout: 120000 });
      const buffers = results.map((r: any) => Buffer.from(r.base64, 'base64'));
      writeFileSync(filepath, Buffer.concat(buffers));
    } else if (provider === 'openai') {
      if (!openaiKey) return NextResponse.json({ error: 'Missing OpenAI API Key' }, { status: 401 });
      
      const client = new OpenAI({ apiKey: openaiKey });
      const mp3 = await client.audio.speech.create({
        model: 'tts-1',
        voice: (openaiVoiceId || 'onyx') as any,
        input: script,
      });
      const buffer = Buffer.from(await mp3.arrayBuffer());
      writeFileSync(filepath, buffer);
    } else if (provider === 'edge') {
      const chunks = chunkText(script, 1500);
      const tempFiles: string[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const tts = new EdgeTTS({
          voice: edgeVoiceId || 'en-US-ChristopherNeural',
          lang: (edgeVoiceId || 'en-US-ChristopherNeural').substring(0, 5),
          outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
          timeout: 120000,
        });
        const tempPath = filepath.replace('.mp3', `-${i}.mp3`);
        await tts.ttsPromise(chunks[i], tempPath);
        tempFiles.push(tempPath);
      }
      
      const buffers = [];
      for (const f of tempFiles) {
        buffers.push(readFileSync(f));
        unlinkSync(f);
      }
      writeFileSync(filepath, Buffer.concat(buffers));
    } else {
      return NextResponse.json({ error: 'Invalid TTS provider' }, { status: 400 });
    }

    // 2. Sync Subtitles using STT provider
    const useGroq = sttProvider === 'groq';
    const sttKey = useGroq ? groqKey : openaiKey;

    if (!sttKey) {
      // If no STT key, we just return the audio without synced words
      return NextResponse.json({ success: true, audioFile: filename, words: [] });
    }

    const client = new OpenAI({
      apiKey: sttKey,
      baseURL: useGroq ? 'https://api.groq.com/openai/v1' : undefined,
    });

    const response = await client.audio.transcriptions.create({
      file: createReadStream(filepath) as any,
      model: useGroq ? 'whisper-large-v3-turbo' : 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    }) as any;

    const words = (response.words || []).map((w: any) => ({
      word: w.word.trim(),
      start: w.start,
      end: w.end,
    }));

    return NextResponse.json({ success: true, audioFile: filename, words });

  } catch (error: any) {
    console.error('TTS Error:', error);
    const msg = typeof error === 'string' ? error : (error?.message || 'Unknown TTS error');
    return NextResponse.json({ error: 'TTS generation failed: ' + msg }, { status: 500 });
  }
}
