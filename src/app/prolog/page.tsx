'use client';

import React, { useState } from 'react';
import { useVideoStore } from '@/stores/useVideoStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import {
  Wand2, Mic, Loader2, PlayCircle, Volume2, CheckCircle2,
  AlertCircle, Sparkles, BookOpen,
} from 'lucide-react';
import Link from 'next/link';

export default function PrologPage() {
  const { episodes, animeTitle, prologScript, prologAudioFileId, setPrologScript, setPrologAudio } = useVideoStore();
  const settings = useSettingsStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [localScript, setLocalScript] = useState(prologScript || '');
  const [error, setError] = useState('');

  const doneEpisodes = episodes.filter((e) => e.pipelineStage === 'done');

  const handleGenerateProlog = async () => {
    if (doneEpisodes.length === 0) return;
    setIsGenerating(true);
    setError('');
    try {
      const allEpisodeScripts = doneEpisodes.map((e) => e.script || '');
      const res = await fetch('/api/script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-key': settings.openaiKey,
          'x-claude-key': settings.claudeKey,
          'x-ollama-model': settings.ollamaModel,
          'x-ollama-base-url': settings.ollamaBaseUrl,
        },
        body: JSON.stringify({
          mode: 'prolog',
          provider: settings.llmProvider,
          animeTitle: animeTitle || 'Unknown Anime',
          allEpisodeScripts,
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'Failed to generate prolog');
      }
      const data = await res.json();
      setLocalScript(data.script);
      setPrologScript(data.script);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratePrologTTS = async () => {
    if (!localScript) return;
    setIsGeneratingTTS(true);
    setError('');
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-elevenlabs-key': settings.elevenLabsKey,
          'x-groq-key': settings.groqKey,
          'x-openai-key': settings.openaiKey,
        },
        body: JSON.stringify({
          script: localScript,
          provider: settings.ttsProvider,
          voiceId: settings.elevenLabsVoiceId,
          sttProvider: settings.sttProvider,
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'TTS failed');
      }
      const data = await res.json();
      setPrologScript(localScript);
      setPrologAudio(data.audioFile, data.words || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGeneratingTTS(false);
    }
  };

  if (doneEpisodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-5 text-center">
        <div className="p-6 bg-yellow-500/10 rounded-3xl border border-yellow-500/20">
          <AlertCircle size={48} className="text-yellow-400" />
        </div>
        <h2 className="text-3xl font-bold">No Episodes Processed</h2>
        <p className="text-white/50 max-w-md text-base">
          Complete the AI Pipeline for at least one episode before generating a prolog.
        </p>
        <Link href="/pipeline" className="btn btn-primary mt-2">
          Go to Pipeline →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-20 mt-4 relative z-10">
      {/* Header */}
      <div>
        <h1 className="text-5xl font-black text-white font-heading tracking-tight leading-none">
          Prolog Generator
        </h1>
        <p className="text-white/60 text-lg mt-3 font-medium">
          Create an opening narration that introduces{' '}
          <span className="text-purple-400 font-bold">{animeTitle || 'the anime'}</span> to your audience.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Script editor */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Episode context */}
          <div className="glass-card !bg-purple-500/[0.04] border-purple-500/20 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-500/20 rounded-xl">
                <BookOpen size={18} className="text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Context Available</p>
                <p className="text-xs text-white/50">{doneEpisodes.length} episode scripts ready to inform prolog</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {doneEpisodes.map((ep) => (
                <span key={ep.id} className="text-xs bg-purple-500/15 text-purple-300 border border-purple-500/20 px-3 py-1 rounded-full font-bold">
                  Ep {ep.episodeNumber}
                </span>
              ))}
            </div>
          </div>

          {/* Script textarea */}
          <div className="flex flex-col gap-3 flex-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
                <Sparkles size={14} className="text-yellow-400" />
                Prolog Script
              </label>
              <span className="text-xs text-white/30">{localScript.split(' ').filter(Boolean).length} words</span>
            </div>
            <textarea
              value={localScript}
              onChange={(e) => {
                setLocalScript(e.target.value);
                setPrologScript(e.target.value);
              }}
              placeholder="Your prolog script will appear here. Generate it with AI or write it yourself..."
              rows={12}
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white/90 leading-relaxed text-sm resize-none focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 transition-colors placeholder:text-white/20 custom-scrollbar font-medium"
            />
          </div>

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Right: Controls */}
        <div className="flex flex-col gap-5">
          <div className="glass-card flex flex-col gap-5 sticky top-24">
            <h2 className="text-xl font-bold border-b border-white/10 pb-5">Prolog Controls</h2>

            {/* Generate Script */}
            <div className="flex flex-col gap-3">
              <p className="text-xs text-white/50 leading-relaxed">
                AI will read all {doneEpisodes.length} episode scripts and write an engaging introduction for your recap video.
              </p>
              <button
                onClick={handleGenerateProlog}
                disabled={isGenerating || isGeneratingTTS}
                className="btn btn-primary btn-full"
              >
                {isGenerating
                  ? <><Loader2 size={16} className="animate-spin" /> Generating...</>
                  : <><Wand2 size={16} /> Generate with AI</>}
              </button>
            </div>

            <div className="border-t border-white/8" />

            {/* Generate TTS */}
            <div className="flex flex-col gap-3">
              <p className="text-xs text-white/50 leading-relaxed">
                Convert prolog script to a voice narration using your selected TTS provider.
              </p>
              <button
                onClick={handleGeneratePrologTTS}
                disabled={!localScript || isGenerating || isGeneratingTTS}
                className="btn btn-primary btn-full"
                style={{ opacity: !localScript ? 0.4 : 1, cursor: !localScript ? 'not-allowed' : 'pointer' }}
              >
                {isGeneratingTTS
                  ? <><Loader2 size={16} className="animate-spin" /> Generating Voice...</>
                  : <><Mic size={16} /> Generate Voice</>}
              </button>
            </div>

            {/* Audio preview */}
            {prologAudioFileId && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <p className="text-sm font-bold text-emerald-400">Prolog voice ready!</p>
                </div>
                <audio
                  controls
                  src={`/api/file?id=${prologAudioFileId}`}
                  className="w-full h-9 rounded-xl"
                />
              </div>
            )}

            <div className="border-t border-white/8" />

            {/* Next step */}
            <Link
              href="/voice"
              className={`btn btn-primary btn-full text-center ${!prologAudioFileId && !doneEpisodes.some(e => e.audioFileId) ? 'opacity-40 pointer-events-none' : ''}`}
            >
              <Volume2 size={16} /> Assembly & Export →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
