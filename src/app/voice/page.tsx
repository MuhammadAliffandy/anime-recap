'use client';

import React, { useState } from 'react';
import { useVideoStore } from '@/stores/useVideoStore';
import {
  Loader2, CheckCircle2, AlertCircle, Download, PlayCircle,
  Volume2, Film, Sparkles, Layers,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function VoicePage() {
  const router = useRouter();
  const {
    episodes,
    animeTitle,
    prologAudioFileId,
    prologAudioWords,
    finalExportId,
    isAssembling,
    setFinalExportId,
    setFinalWords,
    setAssembling,
  } = useVideoStore();

  const [error, setError] = useState('');

  const doneEpisodes = episodes.filter(
    (e) => e.pipelineStage === 'done' && e.strippedFileId && e.audioFileId
  );

  const handleAssemble = async () => {
    if (doneEpisodes.length === 0) return;
    setAssembling(true);
    setError('');
    try {
      const res = await fetch('/api/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animeTitle,
          prologAudioFileId: prologAudioFileId || undefined,
          prologAudioWords: prologAudioWords || [],
          episodes: doneEpisodes.map((e) => ({
            videoFileId: e.strippedFileId!,
            audioFileId: e.audioFileId!,
            audioWords: e.audioWords || [],
          })),
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'Assembly failed');
      }
      const data = await res.json();
      setFinalExportId(data.finalFileId);
      if (data.finalWords) {
        setFinalWords(data.finalWords);
      }
      router.push('/editor');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAssembling(false);
    }
  };

  if (doneEpisodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-5 text-center">
        <div className="p-6 bg-yellow-500/10 rounded-3xl border border-yellow-500/20">
          <AlertCircle size={48} className="text-yellow-400" />
        </div>
        <h2 className="text-3xl font-bold">No Ready Episodes</h2>
        <p className="text-white/50 max-w-md text-base">
          Complete the AI Pipeline for your episodes before assembling the final video.
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
          Assembly & Export
        </h1>
        <p className="text-white/60 text-lg mt-3 font-medium">
          Review all episode audio, then assemble into one final long-form recap video.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Episode audio list */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Prolog */}
          {prologAudioFileId ? (
            <div className="glass-card !bg-purple-500/[0.04] border-purple-500/20 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/20 rounded-xl shrink-0">
                  <Sparkles size={18} className="text-purple-400" />
                </div>
                <div>
                  <p className="text-base font-bold text-white">Prolog Narration</p>
                  <p className="text-xs text-white/50">Opening of your recap video</p>
                </div>
                <CheckCircle2 size={18} className="text-emerald-400 ml-auto shrink-0" />
              </div>
              <audio controls src={`/api/file?id=${prologAudioFileId}`} className="w-full h-9 rounded-xl" />
            </div>
          ) : (
            <div className="glass-card border-dashed border-white/10 flex items-center gap-4 opacity-50">
              <div className="p-2.5 bg-white/5 rounded-xl">
                <Sparkles size={18} className="text-white/40" />
              </div>
              <div>
                <p className="text-sm font-bold text-white/60">No Prolog</p>
                <p className="text-xs text-white/35">
                  Optionally{' '}
                  <Link href="/prolog" className="text-purple-400 underline hover:no-underline">
                    generate a prolog
                  </Link>{' '}
                  first
                </p>
              </div>
            </div>
          )}

          {/* Episode audio list */}
          <div className="flex flex-col gap-3">
            <h3 className="text-base font-bold text-white/70 flex items-center gap-2">
              <Layers size={16} className="text-cyan-400" />
              Episode Segments
              <span className="text-xs bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full font-black">
                {doneEpisodes.length}
              </span>
            </h3>

            {doneEpisodes.map((ep) => (
              <div key={ep.id} className="glass-card flex flex-col gap-3">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-black text-white/80">{ep.episodeNumber}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate text-white/90">{ep.originalName}</p>
                    <p className="text-xs text-white/40 mt-0.5 line-clamp-1 italic">
                      {ep.script?.substring(0, 80)}...
                    </p>
                  </div>
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                </div>

                {ep.audioFileId && (
                  <audio
                    controls
                    src={`/api/file?id=${ep.audioFileId}`}
                    className="w-full h-9 rounded-xl"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Assembly Controls */}
        <div className="flex flex-col gap-5">
          <div className="glass-card flex flex-col gap-5 sticky top-24">
            <h2 className="text-xl font-bold border-b border-white/10 pb-5">Final Assembly</h2>

            {/* Summary */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Total Episodes</span>
                <span className="font-black text-white">{doneEpisodes.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Prolog</span>
                <span className={`font-black ${prologAudioFileId ? 'text-emerald-400' : 'text-white/30'}`}>
                  {prologAudioFileId ? 'Ready' : 'None'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Project</span>
                <span className="font-black text-purple-400 truncate max-w-[120px]">
                  {animeTitle || '—'}
                </span>
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-4">
              <p className="text-xs text-white/50 leading-relaxed">
                Each episode video will be looped/trimmed to match its TTS audio duration, then all segments will be concatenated into one final MP4.
              </p>
            </div>

            {/* Assemble button */}
            {!finalExportId ? (
              <button
                onClick={handleAssemble}
                disabled={isAssembling}
                className="btn btn-primary btn-full"
              >
                {isAssembling
                  ? <><Loader2 size={16} className="animate-spin" /> Assembling...</>
                  : <><Film size={16} /> Assemble Final Video</>}
              </button>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-emerald-400">Video Ready!</p>
                    <p className="text-xs text-emerald-500/70 mt-0.5">Your recap is assembled</p>
                  </div>
                </div>
                <a
                  href={`/api/file?id=${finalExportId}`}
                  download
                  className="btn btn-primary btn-full text-center"
                >
                  <Download size={16} /> Download Final Video
                </a>
                <button
                  onClick={() => { setFinalExportId(''); handleAssemble(); }}
                  disabled={isAssembling}
                  className="btn btn-sm text-center text-white/50 hover:text-white border border-white/10 hover:border-white/25 rounded-xl py-2 transition-all text-xs font-bold"
                >
                  Re-assemble
                </button>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
