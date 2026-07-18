import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const YOUTUBE_PROMPT = (animeTitle: string, synopsis: string, episodeSummaries: string) =>
  `You are a YouTube SEO expert specializing in anime recap channels. Generate an optimized YouTube title and description for a recap video.

Anime Title: "${animeTitle}"
${synopsis ? `Synopsis: "${synopsis}"` : ''}

Episode summaries covered in this recap:
${episodeSummaries}

You MUST respond in this exact JSON format (no markdown, no code blocks, just raw JSON):
{
  "title": "Your catchy title here",
  "description": "Your full description here",
  "tags": ["tag1", "tag2", "tag3"]
}

TITLE RULES:
- Write the title in English
- Make it dramatic, clickbait-y, and intriguing — like real anime recap YouTube channels
- Use emotional hooks, plot twists, or dramatic revelations from the story
- Use em dashes (—) for dramatic pauses
- Keep it under 100 characters
- Do NOT include "Recap" or "Summary" in the title
- Examples of good titles:
  "The World Wanted Me to Kill the Spider Queen—But I Proposed Instead!"
  "He Was the Weakest Student—Until He Unlocked a Forbidden Power"
  "She Betrayed Her Kingdom to Save the Boy Everyone Hated"

DESCRIPTION RULES:
- Start with a brief 2-3 sentence hook about the story
- Then add "Here is Anime Recap. Welcome to my channel!"
- Add "All my videos are self-made, and creating them takes a lot of work"
- Add "Thank You👍 my content and follow my channel! 🙏🙏🙏"
- Add "If there's a video you really love, let me know via likes or comments, and I'll create a sequel for it later."
- Add "Thanks everyone for subscribing and liking!"
- End with a newline and hashtags: #anime #Manga #animerecap #recap #Manhwa #Mangarecap

TAGS RULES:
- Include 10-15 relevant tags
- Include the anime name, genre tags, and general anime tags
- Include "anime recap", "anime summary", the anime title`;

export async function POST(req: NextRequest) {
  try {
    const { animeTitle, animeSynopsis, episodeScripts, provider } = await req.json();
    const openaiKey = req.headers.get('x-openai-key');
    const claudeKey = req.headers.get('x-claude-key');
    const ollamaModel = req.headers.get('x-ollama-model') || 'qwen2.5:14b';
    const ollamaBaseUrl = req.headers.get('x-ollama-base-url') || 'http://localhost:11434';

    if (!animeTitle) return NextResponse.json({ error: 'Missing anime title' }, { status: 400 });

    const summaries = (episodeScripts || [])
      .map((s: string, i: number) => `Episode ${i + 1}: ${s.substring(0, 300)}...`)
      .join('\n');

    const systemPrompt = YOUTUBE_PROMPT(animeTitle, animeSynopsis || '', summaries);
    const userContent = `Generate an optimized YouTube title, description, and tags for this anime recap video of "${animeTitle}".`;

    let rawResponse = '';

    if (provider === 'openai') {
      if (!openaiKey) return NextResponse.json({ error: 'Missing OpenAI API Key' }, { status: 401 });
      const client = new OpenAI({ apiKey: openaiKey });
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      });
      rawResponse = response.choices[0].message.content || '';

    } else if (provider === 'claude') {
      if (!claudeKey) return NextResponse.json({ error: 'Missing Claude API Key' }, { status: 401 });
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Claude API Error');
      rawResponse = data.content[0].text;

    } else if (provider === 'ollama') {
      const client = new OpenAI({
        apiKey: 'ollama',
        baseURL: `${ollamaBaseUrl}/v1`,
      });
      const response = await client.chat.completions.create({
        model: ollamaModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        stream: false,
      });
      rawResponse = response.choices[0].message.content || '';

    } else {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    // Parse JSON from LLM response (handle markdown code blocks)
    let cleaned = rawResponse.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(cleaned);

    return NextResponse.json({
      success: true,
      title: parsed.title || '',
      description: parsed.description || '',
      tags: parsed.tags || [],
    });

  } catch (error: any) {
    console.error('YouTube Meta Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate YouTube metadata' }, { status: 500 });
  }
}
