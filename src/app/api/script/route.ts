import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const EPISODE_SCRIPT_PROMPT = (episodeNum: number, totalEpisodes: number) =>
  `You are an expert anime recap storyteller for YouTube creating a long-form recap video.
You are writing the voiceover narration for Episode ${episodeNum} of ${totalEpisodes} total episodes.

Rules:
- Write ONLY the spoken voiceover narration — no stage directions, timestamps, or visual cues
- Be dramatic, engaging, and fast-paced — like a professional YouTube storyteller
- Preserve key story beats, character moments, and plot twists
- End each episode segment with a cliffhanger hook leading to the next episode (unless it's the final episode)
- Keep it between 150-250 words
- Start with "In Episode ${episodeNum}..." or a dramatic hook tied to that episode`;

const PROLOG_PROMPT = (animeTitle: string, episodeSummaries: string) =>
  `You are an expert anime recap storyteller for YouTube.
Write a compelling PROLOG voiceover narration that will open a full-season recap video for the anime "${animeTitle}".

The prolog should:
- Hook the viewer immediately with the anime's core premise/appeal
- Briefly introduce the main character(s) and the world/setting
- Build hype and anticipation for what they're about to watch
- Be between 80-120 words
- End with something like "Now, let's go back to where it all began..." or similar transition

Here are brief summaries of what happens across all episodes to give you context:
${episodeSummaries}`;

export async function POST(req: NextRequest) {
  try {
    const { transcript, provider, mode, episodeNum, totalEpisodes, animeTitle, allEpisodeScripts } = await req.json();
    const openaiKey = req.headers.get('x-openai-key');
    const claudeKey = req.headers.get('x-claude-key');
    const ollamaModel = req.headers.get('x-ollama-model') || 'llama3.1:8b';
    const ollamaBaseUrl = req.headers.get('x-ollama-base-url') || 'http://localhost:11434';

    // mode: 'episode' | 'prolog'
    let systemPrompt: string;
    let userContent: string;

    if (mode === 'prolog') {
      if (!animeTitle) return NextResponse.json({ error: 'Missing animeTitle for prolog' }, { status: 400 });
      const summaries = (allEpisodeScripts || [])
        .map((s: string, i: number) => `Episode ${i + 1}: ${s.substring(0, 200)}...`)
        .join('\n');
      systemPrompt = PROLOG_PROMPT(animeTitle, summaries);
      userContent = `Generate the prolog voiceover for "${animeTitle}".`;
    } else {
      // episode mode
      if (!transcript) return NextResponse.json({ error: 'Missing transcript' }, { status: 400 });
      systemPrompt = EPISODE_SCRIPT_PROMPT(episodeNum || 1, totalEpisodes || 1);
      userContent = `Original Episode Transcript:\n${transcript}`;
    }

    let script = '';

    if (provider === 'openai') {
      if (!openaiKey) return NextResponse.json({ error: 'Missing OpenAI API Key. Add it in Settings.' }, { status: 401 });
      const client = new OpenAI({ apiKey: openaiKey });
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      });
      script = response.choices[0].message.content || '';

    } else if (provider === 'claude') {
      if (!claudeKey) return NextResponse.json({ error: 'Missing Claude API Key. Add it in Settings.' }, { status: 401 });
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Claude API Error');
      script = data.content[0].text;

    } else if (provider === 'ollama') {
      const client = new OpenAI({
        apiKey: 'ollama',
        baseURL: `${ollamaBaseUrl}/v1`,
      });
      try {
        const response = await client.chat.completions.create({
          model: ollamaModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          stream: false,
        });
        script = response.choices[0].message.content || '';
      } catch (ollamaErr: any) {
        if (ollamaErr.code === 'ECONNREFUSED' || ollamaErr.message?.includes('ECONNREFUSED')) {
          throw new Error(`Cannot connect to Ollama at ${ollamaBaseUrl}. Make sure Ollama is running.`);
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
