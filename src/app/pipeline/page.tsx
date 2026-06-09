'use client';

import React, { useState } from 'react';
import { useVideoStore } from '@/stores/useVideoStore';
import { usePipelineStore } from '@/stores/usePipelineStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { Wand2, Mic, Brain, Loader2, PlayCircle, AlertCircle } from 'lucide-react';

export default function PipelinePage() {
  const { mergedFileId } = useVideoStore();
  const { transcriptText, generatedScript, isTranscribing, isGeneratingScript, setTranscript, setScript, setTranscribing, setGeneratingScript } = usePipelineStore();
  const settings = useSettingsStore();

  const handleTranscribe = async () => {
    if (!mergedFileId) return;
    setTranscribing(true);
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-openai-key': settings.openaiKey, 'x-groq-key': settings.groqKey },
        body: JSON.stringify({ fileId: mergedFileId, provider: settings.sttProvider }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      const data = await res.json();
      setTranscript(data.text, data.words);
    } catch (e: any) { alert(e.message); }
    finally { setTranscribing(false); }
  };

  const handleGenerateScript = async () => {
    if (!transcriptText) return;
    setGeneratingScript(true);
    try {
      const res = await fetch('/api/script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-key': settings.openaiKey,
          'x-claude-key': settings.claudeKey,
          'x-ollama-model': settings.ollamaModel,
          'x-ollama-base-url': settings.ollamaBaseUrl,
        },
        body: JSON.stringify({ transcript: transcriptText, provider: settings.llmProvider }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      const data = await res.json();
      setScript(data.script);
    } catch (e: any) { alert(e.message); }
    finally { setGeneratingScript(false); }
  };

  if (!mergedFileId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-5 text-center">
        <div className="p-6 bg-red-500/10 rounded-3xl border border-red-500/20">
          <AlertCircle size={48} className="text-red-500" />
        </div>
        <h2 className="text-3xl font-bold">No Video Found</h2>
        <p className="text-white/50 max-w-md text-base">You need to ingest and merge a video first before starting the AI pipeline.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 pb-20 mt-4 relative z-10 h-full">
      <div>
        <h1 className="text-5xl font-black text-white font-heading tracking-tight leading-none">AI Pipeline</h1>
        <p className="text-white/60 text-lg mt-3 font-medium">Transcribe the video and let AI write an engaging script.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" style={{ height: 'calc(100vh - 240px)', minHeight: '560px' }}>

        {/* Step 1 */}
        <div className="glass-card flex flex-col gap-5 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 pb-5 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-cyan-500/20 rounded-xl"><Mic size={22} className="text-cyan-400" /></div>
              <h2 className="text-xl font-bold">1. Transcription</h2>
            </div>
            <button onClick={handleTranscribe} disabled={isTranscribing} className="btn btn-primary btn-sm">
              {isTranscribing ? <><Loader2 size={15} className="lucide-spinner" /> Transcribing...</> : 'Extract & Transcribe'}
            </button>
          </div>
          <div className="flex-1 bg-black/40 rounded-2xl border border-white/8 p-5 overflow-y-auto custom-scrollbar">
            {transcriptText
              ? <p className="text-white/85 leading-relaxed text-sm whitespace-pre-wrap">{transcriptText}</p>
              : <div className="h-full flex flex-col items-center justify-center opacity-30 gap-3">
                  <PlayCircle size={44} />
                  <p className="text-sm font-medium">Click "Extract & Transcribe" to begin.</p>
                </div>
            }
          </div>
        </div>

        {/* Step 2 */}
        <div className="glass-card flex flex-col gap-5 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 pb-5 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/20 rounded-xl"><Brain size={22} className="text-purple-400" /></div>
              <h2 className="text-xl font-bold">2. Storytelling Script</h2>
            </div>
            <button
              onClick={handleGenerateScript}
              disabled={!transcriptText || isGeneratingScript}
              className="btn btn-primary btn-sm"
              style={{ opacity: !transcriptText ? 0.4 : 1, cursor: !transcriptText ? 'not-allowed' : 'pointer' }}
            >
              {isGeneratingScript ? <><Loader2 size={15} className="lucide-spinner" /> Writing...</> : 'Generate Script'}
            </button>
          </div>
          <div className="flex-1 flex flex-col">
            {generatedScript
              ? <textarea
                  value={generatedScript}
                  onChange={(e) => setScript(e.target.value)}
                  className="flex-1 bg-black/40 rounded-2xl border border-white/8 p-5 text-white/90 leading-relaxed text-sm resize-none focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/25 custom-scrollbar transition-colors"
                />
              : <div className="flex-1 bg-black/40 rounded-2xl border border-white/8 p-5 flex flex-col items-center justify-center opacity-30 gap-3">
                  <Wand2 size={44} />
                  <p className="text-sm font-medium text-center">Awaiting transcript to generate script.</p>
                </div>
            }
          </div>
        </div>

      </div>
    </div>
  );
}
