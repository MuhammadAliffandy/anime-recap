import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { writeFileSync, existsSync, createReadStream } from 'fs';
import * as googleTTS from 'google-tts-api';
import OpenAI from 'openai';

const OUTPUT_DIR = join(process.cwd(), 'output');

export async function POST(req: NextRequest) {
  try {
    const { script, provider, voiceId, sttProvider } = await req.json();
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
      const base64Audio = await googleTTS.getAudioBase64(script, { lang: 'en', slow: false });
      writeFileSync(filepath, Buffer.from(base64Audio, 'base64'));
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
    return NextResponse.json({ error: 'TTS generation failed: ' + error.message }, { status: 500 });
  }
}
