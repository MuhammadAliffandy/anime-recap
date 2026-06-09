'use client';

import React, { useRef } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { usePipelineStore } from '@/stores/usePipelineStore';
import { useVoiceStore } from '@/stores/useVoiceStore';
import { Mic, Captions, Loader2, AlertCircle } from 'lucide-react';

export default function VoicePage() {
  const settings = useSettingsStore();
  const { generatedScript } = usePipelineStore();
  const { ttsAudioUrl, syncedWords, isGeneratingTTS, setTTSAudio, setSyncedWords, setGeneratingTTS } = useVoiceStore();
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleGenerateVoice = async () => {
    if (!generatedScript) return;
    setGeneratingTTS(true);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-elevenlabs-key': settings.elevenLabsKey,
          'x-openai-key': settings.openaiKey,
          'x-groq-key': settings.groqKey,
        },
        body: JSON.stringify({ script: generatedScript, provider: settings.ttsProvider, voiceId: settings.elevenLabsVoiceId, sttProvider: settings.sttProvider }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      const data = await res.json();
      setTTSAudio(`/api/file?name=${data.audioFile}&dir=output`);
      setSyncedWords(data.words);
    } catch (e: any) { alert(e.message); }
    finally { setGeneratingTTS(false); }
  };

  if (!generatedScript) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-5 text-center">
        <div className="p-6 bg-red-500/10 rounded-3xl border border-red-500/20">
          <AlertCircle size={48} className="text-red-500" />
        </div>
        <h2 className="text-3xl font-bold">No Script Found</h2>
        <p className="text-white/50 max-w-md text-base">Generate a script in the AI Pipeline first.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 pb-20 mt-4 relative z-10">
      <div>
        <h1 className="text-5xl font-black text-white font-heading tracking-tight leading-none">Voice &amp; Subtitles</h1>
        <p className="text-white/60 text-lg mt-3 font-medium">Generate AI voiceover and word-level subtitle sync.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* TTS Card */}
        <div className="glass-card flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/20 rounded-xl"><Mic size={22} className="text-blue-400" /></div>
              <h2 className="text-xl font-bold">Voiceover (TTS)</h2>
            </div>
            <button onClick={handleGenerateVoice} disabled={isGeneratingTTS} className="btn btn-primary btn-sm">
              {isGeneratingTTS ? <><Loader2 size={15} className="lucide-spinner" /> Generating...</> : 'Generate Audio'}
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <p className="text-xs font-bold uppercase tracking-widest text-white/40">Script Preview</p>
            <div className="bg-black/40 rounded-2xl border border-white/8 p-4 text-sm italic text-white/70 line-clamp-5 leading-relaxed">
              &quot;{generatedScript}&quot;
            </div>

            {ttsAudioUrl && (
              <div className="mt-2 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex flex-col gap-3">
                <p className="text-xs font-black uppercase tracking-widest text-emerald-400">✓ Audio Ready</p>
                <audio ref={audioRef} controls src={ttsAudioUrl} className="w-full rounded-xl" />
              </div>
            )}
          </div>
        </div>

        {/* Subtitles Card */}
        <div className="glass-card flex flex-col gap-6">
          <div className="flex items-center gap-3 border-b border-white/10 pb-5">
            <div className="p-3 bg-yellow-500/20 rounded-xl"><Captions size={22} className="text-yellow-400" /></div>
            <h2 className="text-xl font-bold">Synced Subtitles</h2>
          </div>

          <div className="flex-1 bg-black/40 rounded-2xl border border-white/8 p-5 overflow-y-auto custom-scrollbar min-h-[300px]">
            {syncedWords.length > 0
              ? <div className="flex flex-wrap gap-2">
                  {syncedWords.map((w, i) => (
                    <span key={i} title={`${w.start}s → ${w.end}s`}
                      className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm cursor-pointer hover:bg-yellow-400/15 hover:border-yellow-400/40 hover:text-yellow-300 transition-all"
                    >{w.word}</span>
                  ))}
                </div>
              : <div className="h-full flex flex-col items-center justify-center opacity-30 gap-3">
                  <Captions size={44} />
                  <p className="text-sm font-medium text-center">Generate voiceover first.</p>
                </div>
            }
          </div>
        </div>

      </div>
    </div>
  );
}
