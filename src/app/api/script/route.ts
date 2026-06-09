import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are an expert anime recap storyteller for YouTube. 
Create a highly engaging, viral, fast-paced script based on the provided transcript. 
The script should be read as a voiceover — do NOT include timestamps, visual cues, or stage directions. 
Just the raw spoken dialogue text. Keep it punchy, exciting, and under 300 words.`;

export async function POST(req: NextRequest) {
  try {
    const { transcript, provider } = await req.json();
    const openaiKey = req.headers.get('x-openai-key');
    const claudeKey = req.headers.get('x-claude-key');
    const ollamaModel = req.headers.get('x-ollama-model') || 'llama3.1:8b';
    const ollamaBaseUrl = req.headers.get('x-ollama-base-url') || 'http://localhost:11434';

    if (!transcript) return NextResponse.json({ error: 'Missing transcript' }, { status: 400 });

    let script = '';

    // ── OpenAI ──────────────────────────────────────────────────────────────
    if (provider === 'openai') {
      if (!openaiKey) return NextResponse.json({ error: 'Missing OpenAI API Key. Add it in Settings.' }, { status: 401 });

      const client = new OpenAI({ apiKey: openaiKey });
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Original Transcript:\n${transcript}` }
        ]
      });
      script = response.choices[0].message.content || '';

    // ── Anthropic Claude ─────────────────────────────────────────────────────
    } else if (provider === 'claude') {
      if (!claudeKey) return NextResponse.json({ error: 'Missing Claude API Key. Add it in Settings.' }, { status: 401 });

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Original Transcript:\n${transcript}` }]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Claude API Error');
      script = data.content[0].text;

    // ── Ollama (local) ────────────────────────────────────────────────────────
    // Ollama exposes an OpenAI-compatible endpoint at /v1 (since v0.1.24+)
    } else if (provider === 'ollama') {
      const ollamaApiUrl = `${ollamaBaseUrl}/v1`;

      let res: Response;
      try {
        const client = new OpenAI({
          apiKey: 'ollama', // Ollama doesn't require a real key, but SDK needs a non-empty string
          baseURL: ollamaApiUrl,
        });

        const response = await client.chat.completions.create({
          model: ollamaModel,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Original Transcript:\n${transcript}` }
          ],
          // Ollama can be slow — no streaming for simplicity
          stream: false,
        });

        script = response.choices[0].message.content || '';

      } catch (ollamaErr: any) {
        // Provide a helpful error message if Ollama is not running
        if (ollamaErr.code === 'ECONNREFUSED' || ollamaErr.message?.includes('ECONNREFUSED')) {
          throw new Error(`Cannot connect to Ollama at ${ollamaBaseUrl}. Make sure Ollama is running: run "ollama serve" in your terminal.`);
        }
        if (ollamaErr.message?.includes('model') && ollamaErr.message?.includes('not found')) {
          throw new Error(`Model "${ollamaModel}" not found in Ollama. Run: ollama pull ${ollamaModel}`);
        }
        throw ollamaErr;
      }

    } else {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    return NextResponse.json({ success: true, script });

  } catch (error: any) {
    console.error('Script Generation Error:', error);
    return NextResponse.json({ error: error.message || 'Script generation failed' }, { status: 500 });
  }
}
