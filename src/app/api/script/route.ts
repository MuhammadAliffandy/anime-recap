import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const EPISODE_SCRIPT_PROMPT = (episodeNum: number, totalEpisodes: number, animeTitle?: string, animeSynopsis?: string, previousScript?: string) =>
  `You are an expert anime recap storyteller for YouTube creating a long-form recap video.
You are writing the voiceover narration for Episode ${episodeNum} of ${totalEpisodes} total episodes${animeTitle ? ` for the anime "${animeTitle}"` : ''}.
${animeSynopsis ? `\nHere is the overarching synopsis and context of this anime:\n"""\n${animeSynopsis}\n"""\n` : ''}
${previousScript ? `\nFor context, here is the recap script from the PREVIOUS episode to ensure continuity:\n"""\n${previousScript}\n"""\n` : ''}
Your task is to read the "Original Episode Transcript" provided by the user, extract EVERY SINGLE key plot point, character interaction, and event, and turn them into a highly detailed, comprehensive, and engaging 5-minute spoken recap.

Rules:
- CRITICAL: You MUST base your recap strictly on the actual events and dialogue found in the provided transcript. Tell the actual story of what happens in this episode!
- CRITICAL: NAME CORRECTION. The transcript is AI-generated and may contain phonetically misspelled character names (e.g. 'Yuuri' instead of 'Iori'). Use your knowledge of the anime to actively identify and correct these misspellings to their canonical names.
- CRITICAL: LANGUAGE. You MUST write the ENTIRE recap in English. Even if the transcript is in Japanese or another language, your final storytelling narration must be strictly in English.
- CRITICAL: NO CONVERSATIONAL FILLER. Do NOT start your response with "Here is the recap" or "Sure, here is the script". Output ONLY the raw spoken words of the story. Do NOT write any titles, stage directions, parentheses, or brackets. The text will be sent directly to a TTS engine.
- CRITICAL: YOUTUBE NARRATOR FORMAT, NOT A NOVEL. Do NOT write a dialogue-heavy novel or a screenplay. Do not use direct quotes or back-and-forth character conversations. Instead, act as a YouTube storyteller EXPLAINING what is happening in the video, what it means, and summarizing the plot points and character feelings. Add engaging commentary.
- Write in a friendly, casual, and conversational tone (like chatting with a friend about an awesome anime). Avoid overly formal, stiff, or overly dramatic words. Keep it relaxed and engaging, but heavily focused on the actual narrative.
- Ensure the story connects logically and smoothly with the previous episode's events.
- Preserve key story beats, character moments, and plot twists.
- CRITICAL: NO META-COMMENTARY OR EPISODE NUMBERS. You are writing ONE continuous movie script. NEVER use the words "episode", "season", or "part" anywhere in the text. Treat the transition from the previous script as just the next scene. Use seamless narrative conjunctions (e.g. "Meanwhile", "Right after", "Later that day") to connect the story.
- End each section with a cliffhanger or leading hook into the next scene (unless it's the final episode).
- CRITICAL: Length Requirement! You MUST write a MINIMUM of 800 words. Do NOT skip any scenes from the transcript. Summarize the fights, the character motivations, and the atmosphere in painstaking detail. If your recap is too short, you must expand on the psychological aspects and the meaning behind the scenes until you reach at least 800 words. This should be a 5-minute deep-dive commentary.
- CRITICAL: SCENE TIMESTAMP FORMAT. You MUST prefix every paragraph of narration with the source video timestamp range it corresponds to, in this exact format: [MM:SS-MM:SS]. Use the timestamps from the original transcript to determine the correct range. Example:
  [00:45-01:30] Iori settles into the library, savoring the quiet...
  [01:30-02:40] Suddenly Chisa bursts through the door and drags him away...
  Every paragraph MUST begin with a [MM:SS-MM:SS] tag. No exceptions.
${episodeNum === 1 
  ? `- CRITICAL: Start the story immediately with an exciting narrative hook. DO NOT use meta-phrases like "Welcome to", "Today we", or "Let's dive in".` 
  : `- CRITICAL: Start immediately where the previous script left off using seamless narrative conjunctions (e.g. "Following the events...", "Meanwhile..."). NEVER use phrases like "Welcome back" or "In this episode".`}`;

// Parse the LLM's tagged output into clean script + scene timestamps
function parseTaggedScript(raw: string): { cleanScript: string; scenes: { start: number; end: number; narration: string }[] } {
  const tagRegex = /\[(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})\]\s*/g;
  const scenes: { start: number; end: number; narration: string }[] = [];

  // Split by tag boundaries
  const parts = raw.split(/(\[\d{1,2}:\d{2}-\d{1,2}:\d{2}\])/);

  let cleanLines: string[] = [];
  let lastTag: { start: number; end: number } | null = null;
  let pendingNarration = '';

  for (const part of parts) {
    const match = part.match(/^\[(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})\]$/);
    if (match) {
      // Save previous scene if any
      if (lastTag && pendingNarration.trim()) {
        scenes.push({ ...lastTag, narration: pendingNarration.trim() });
      }
      lastTag = {
        start: parseInt(match[1]) * 60 + parseInt(match[2]),
        end: parseInt(match[3]) * 60 + parseInt(match[4]),
      };
      pendingNarration = '';
    } else {
      const text = part.trim();
      if (text) {
        cleanLines.push(text);
        pendingNarration += ' ' + text;
      }
    }
  }
  // Flush last scene
  if (lastTag && pendingNarration.trim()) {
    scenes.push({ ...lastTag, narration: pendingNarration.trim() });
  }

  // If LLM didn't produce any tags, just return the raw text as-is
  const cleanScript = cleanLines.join('\n\n') || raw.replace(tagRegex, '');
  return { cleanScript, scenes };
}

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
    const { transcript, provider, mode, episodeNum, totalEpisodes, animeTitle, animeSynopsis, allEpisodeScripts, previousScript } = await req.json();
    const openaiKey = req.headers.get('x-openai-key');
    const claudeKey = req.headers.get('x-claude-key');
    const ollamaModel = req.headers.get('x-ollama-model') || 'qwen2.5:14b';
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
      systemPrompt = EPISODE_SCRIPT_PROMPT(episodeNum || 1, totalEpisodes || 1, animeTitle, animeSynopsis, previousScript);
      userContent = `Original Episode Transcript (note any timestamps visible in the transcript text to inform your [MM:SS-MM:SS] tags):\n${transcript}`;
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

    const { cleanScript, scenes } = parseTaggedScript(script);
    return NextResponse.json({ success: true, script: cleanScript, scenes });

  } catch (error: any) {
    console.error('Script Generation Error:', error);
    return NextResponse.json({ error: error.message || 'Script generation failed' }, { status: 500 });
  }
}
