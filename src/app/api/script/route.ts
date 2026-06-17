import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const EPISODE_SCRIPT_PROMPT = (episodeNum: number, totalEpisodes: number, animeTitle?: string, previousScript?: string) =>
  `You are an expert anime recap storyteller for YouTube creating a long-form recap video.
You are writing the voiceover narration for Episode ${episodeNum} of ${totalEpisodes} total episodes${animeTitle ? ` for the anime "${animeTitle}"` : ''}.
${previousScript ? `\nFor context, here is the recap script from the PREVIOUS episode to ensure continuity:\n"""\n${previousScript}\n"""\n` : ''}
Your task is to read the "Original Episode Transcript" provided by the user, extract EVERY SINGLE key plot point, character interaction, and event, and turn them into a highly detailed, comprehensive, and engaging 5-minute spoken recap.

Rules:
- CRITICAL: You MUST base your recap strictly on the actual events and dialogue found in the provided transcript. Do not just write a generic intro or outro. Tell the actual story of what happens in this episode!
- CRITICAL: NO CONVERSATIONAL FILLER. Do NOT start your response with "Here is the recap" or "Sure, here is the script". Output ONLY the raw spoken words of the story. Do NOT write any titles, stage directions, parentheses, or brackets. The text will be sent directly to a TTS engine.
- Write in a friendly, casual, and conversational tone (like chatting with a friend about an awesome anime). Avoid overly formal, stiff, or overly dramatic words. Keep it relaxed and engaging.
- Ensure the story connects logically and smoothly with the previous episode's events.
- Preserve key story beats, character moments, and plot twists.
- End each episode segment with a cliffhanger hook leading to the next episode (unless it's the final episode).
- CRITICAL: Length Requirement! You MUST write a MINIMUM of 800 words. Do NOT skip any scenes from the transcript. Describe the characters' emotions, the dialogue, the fights, and the atmosphere in painstaking detail. If your recap is too short, you must expand on the psychological aspects and visual descriptions of the scenes until you reach at least 800 words. This should be a 5-minute deep-dive.
${episodeNum === 1 
  ? `- Start with a friendly, welcoming hook to introduce the recap for Episode 1.` 
  : `- CRITICAL: Do NOT use any introductory phrases like "Welcome back", "Hello again", or "In Episode ${episodeNum}". Start immediately where the previous episode left off to make it a seamless, continuous story.`}`;

const PROLOG_PROMPT = (animeTitle: string, episodeSummaries: string) =>
  `You are an expert anime recap storyteller for YouTube.
Write a compelling PROLOG voiceover narration that will open a full-season recap video for the anime "${animeTitle}".

The prolog should:
- CRITICAL: Write ONLY the exact spoken words. ABSOLUTELY NO stage directions, no parentheses, no brackets, no sound effects, no intro/outro labels (e.g. do NOT write "(music starts)", "[sighs]", or "Narrator:"). The text will be sent directly to a TTS engine.
- Hook the viewer immediately with the anime's core premise/appeal
- Briefly introduce the main character(s) and the world/setting
- Build hype and anticipation for what they're about to watch
- Be between 80-120 words
- End with something like "Now, let's go back to where it all began..." or similar transition

Here are brief summaries of what happens across all episodes to give you context:
${episodeSummaries}`;

export async function POST(req: NextRequest) {
  try {
    const { transcript, provider, mode, episodeNum, totalEpisodes, animeTitle, allEpisodeScripts, previousScript } = await req.json();
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
      systemPrompt = EPISODE_SCRIPT_PROMPT(episodeNum || 1, totalEpisodes || 1, animeTitle, previousScript);
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
