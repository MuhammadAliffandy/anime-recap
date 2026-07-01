'use client';

import React, { useState } from 'react';
import { useVideoStore, Episode, PipelineStage } from '@/stores/useVideoStore';
import { usePipelineStore } from '@/stores/usePipelineStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import {
  Scissors, Mic, Brain, Volume2, CheckCircle2, AlertCircle,
  Loader2, ChevronDown, ChevronRight, PlayCircle, Zap, RefreshCw,
} from 'lucide-react';
import Link from 'next/link';

// ── Pipeline runner for a single episode ──────────────────────────────────────

async function runTTSPhase(
  episode: Episode,
  settings: ReturnType<typeof useSettingsStore.getState>,
  updateEpisode: (id: string, updates: Partial<Episode>) => void
) {
  const update = (updates: Partial<Episode>) => updateEpisode(episode.id, updates);
  try {
    if (episode.audioFileId && episode.audioWords) {
      update({ pipelineStage: 'done' });
      return;
    }

    update({ pipelineStage: 'tts', pipelineError: undefined });
    const ttsRes = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-elevenlabs-key': settings.elevenLabsKey,
        'x-groq-key': settings.groqKey,
        'x-openai-key': settings.openaiKey,
      },
      body: JSON.stringify({
        script: episode.script,
        provider: settings.ttsProvider,
        voiceId: settings.elevenLabsVoiceId,
        sttProvider: settings.sttProvider,
      }),
    });
    if (!ttsRes.ok) {
      const e = await ttsRes.json();
      throw new Error(e.error || 'TTS failed');
    }
    const ttsData = await ttsRes.json();
    update({ audioFileId: ttsData.audioFile, audioWords: ttsData.words, pipelineStage: 'done' });
  } catch (err: any) {
    try {
      update({ pipelineStage: 'error', pipelineError: err.message });
    } catch (updateErr) {
      console.error('Failed to update UI state:', updateErr);
    }
    throw err;
  }
}

async function runScriptAndTTSPhase(
  episode: Episode,
  settings: ReturnType<typeof useSettingsStore.getState>,
  updateEpisode: (id: string, updates: Partial<Episode>) => void
) {
  const update = (updates: Partial<Episode>) => updateEpisode(episode.id, updates);
  try {
    let currentScript = episode.script;

    if (!currentScript) {
      update({ pipelineStage: 'scripting', pipelineError: undefined });
      const state = useVideoStore.getState();
      const allEpisodes = state.episodes;
      
      // Find previous episode script if available to provide context
      let previousScript: string | undefined;
      if (episode.episodeNumber > 1) {
        const prevEp = allEpisodes.find(e => e.episodeNumber === episode.episodeNumber - 1);
        if (prevEp && prevEp.script) {
          previousScript = prevEp.script;
        }
      }

      const scriptRes = await fetch('/api/script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-key': settings.openaiKey,
          'x-claude-key': settings.claudeKey,
          'x-ollama-model': settings.ollamaModel,
          'x-ollama-base-url': settings.ollamaBaseUrl,
        },
        body: JSON.stringify({
          mode: 'episode',
          transcript: episode.transcriptText,
          provider: settings.llmProvider,
          episodeNum: episode.episodeNumber,
          totalEpisodes: allEpisodes.length,
          animeTitle: state.animeTitle,
          animeSynopsis: state.animeSynopsis,
          previousScript,
        }),
      });
      if (!scriptRes.ok) {
        const e = await scriptRes.json();
        throw new Error(e.error || 'Script generation failed');
      }
      const scriptData = await scriptRes.json();
      currentScript = scriptData.script;
      update({ script: currentScript, sceneTimestamps: scriptData.scenes || [] });
    }

    // Run TTS immediately after
    await runTTSPhase({ ...episode, script: currentScript }, settings, updateEpisode);

  } catch (err: any) {
    try {
      update({ pipelineStage: 'error', pipelineError: err.message });
    } catch (updateErr) {
      console.error('Failed to update UI state:', updateErr);
    }
    throw err;
  }
}

async function runEpisodePipeline(
  episode: Episode,
  settings: ReturnType<typeof useSettingsStore.getState>,
  updateEpisode: (id: string, updates: Partial<Episode>) => void
) {
  const update = (updates: Partial<Episode>) => updateEpisode(episode.id, updates);

  try {
    let currentStrippedFileId = episode.strippedFileId;
    let currentTranscriptText = episode.transcriptText;
    
    // Stage 1: Strip
    if (!currentStrippedFileId) {
      update({ pipelineStage: 'stripping', pipelineError: undefined });
      const stripRes = await fetch('/api/strip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: episode.fileId,
          openingDuration: episode.openingDuration,
          endingDuration: episode.endingDuration,
        }),
      });
      if (!stripRes.ok) {
        const e = await stripRes.json();
        throw new Error(e.error || 'Strip failed');
      }
      const stripData = await stripRes.json();
      currentStrippedFileId = stripData.strippedFileId;
      update({ strippedFileId: currentStrippedFileId });
    }

    // Stage 2: Transcribe
    if (!currentTranscriptText) {
      update({ pipelineStage: 'transcribing', pipelineError: undefined });
      const transcribeRes = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-key': settings.openaiKey,
          'x-groq-key': settings.groqKey,
        },
        body: JSON.stringify({
          fileId: currentStrippedFileId,
          provider: settings.sttProvider,
          animeTitle: useVideoStore.getState().animeTitle,
          animeSynopsis: useVideoStore.getState().animeSynopsis,
        }),
      });
      if (!transcribeRes.ok) {
        const e = await transcribeRes.json();
        throw new Error(e.error || 'Transcription failed');
      }
      const transcribeData = await transcribeRes.json();
      currentTranscriptText = transcribeData.text;
      try { update({ transcriptText: currentTranscriptText, transcriptWords: transcribeData.words }); } catch(err) {}
    }

    // Stage 3 & 4: Generate Script and TTS
    await runScriptAndTTSPhase({ ...episode, transcriptText: currentTranscriptText }, settings, updateEpisode);

  } catch (err: any) {
    try {
      update({ pipelineStage: 'error', pipelineError: err.message });
    } catch (updateErr) {
      console.error('Failed to update UI state:', updateErr);
    }
    throw err;
  }
}

// ── Stage step indicator ──────────────────────────────────────────────────────

const STAGES: { key: PipelineStage; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'stripping',   label: 'Strip OP/ED',   icon: <Scissors size={15} />,   color: 'yellow' },
  { key: 'transcribing',label: 'Transcribe',     icon: <Mic size={15} />,        color: 'cyan'   },
  { key: 'scripting',   label: 'AI Script',      icon: <Brain size={15} />,      color: 'purple' },
  { key: 'tts',         label: 'Voice TTS',      icon: <Volume2 size={15} />,    color: 'pink'   },
  { key: 'done',        label: 'Done',           icon: <CheckCircle2 size={15}/>, color: 'emerald'},
];

const stageIndex = (stage: PipelineStage) =>
  ['idle', 'stripping', 'transcribing', 'scripting', 'tts', 'done', 'error'].indexOf(stage);

function StageRow({ stage, current }: { stage: typeof STAGES[0]; current: PipelineStage }) {
  const ci = stageIndex(current);
  const si = stageIndex(stage.key);
  const isDone = current === 'done' || (si < ci && current !== 'error');
  const isActive = current === stage.key;
  const isError = current === 'error' && si === ci;

  const colorMap: Record<string, string> = {
    yellow: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    cyan: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
    purple: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    pink: 'text-pink-400 bg-pink-400/10 border-pink-400/20',
    emerald: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  };

  return (
    <div className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all ${isActive ? 'bg-white/[0.04]' : ''}`}>
      <div className={`p-1.5 rounded-lg border ${
        isDone ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' :
        isError ? 'text-red-400 bg-red-400/10 border-red-400/20' :
        isActive ? colorMap[stage.color] :
        'text-white/20 bg-white/[0.03] border-white/8'
      }`}>
        {isActive && !isDone ? <Loader2 size={15} className="animate-spin" /> : stage.icon}
      </div>
      <span className={`text-sm font-bold ${
        isDone ? 'text-emerald-400' :
        isError ? 'text-red-400' :
        isActive ? 'text-white' :
        'text-white/30'
      }`}>
        {stage.label}
      </span>
      {isDone && <CheckCircle2 size={14} className="ml-auto text-emerald-400" />}
      {isActive && <div className="ml-auto w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />}
    </div>
  );
}

function EpisodeCard({
  episode,
  onRun,
  onRunScript,
  onRunTTS,
  updateEpisode,
  isRunningAny,
}: {
  episode: Episode;
  onRun: (ep: Episode) => void;
  onRunScript: (ep: Episode) => void;
  onRunTTS: (ep: Episode) => void;
  updateEpisode: (id: string, updates: Partial<Episode>) => void;
  isRunningAny: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isRunning = ['stripping', 'transcribing', 'scripting', 'tts'].includes(episode.pipelineStage);
  const isDone = episode.pipelineStage === 'done';
  const isError = episode.pipelineStage === 'error';

  return (
    <div className={`glass-card !p-0 overflow-hidden transition-all ${
      isDone ? 'border-emerald-500/20' : isError ? 'border-red-500/20' : 'border-white/8'
    }`}>
      {/* Card header */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-sm ${
          isDone ? 'bg-emerald-500/20 text-emerald-400' :
          isError ? 'bg-red-500/20 text-red-400' :
          isRunning ? 'bg-cyan-500/20 text-cyan-400' :
          'bg-white/8 text-white/50'
        }`}>
          {isRunning ? <Loader2 size={18} className="animate-spin" /> :
           isDone ? <CheckCircle2 size={18} /> :
           episode.episodeNumber}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate text-white/90">{episode.originalName}</p>
          <p className="text-xs text-white/40 mt-0.5 capitalize">
            {episode.pipelineStage === 'idle' ? 'Not started' :
             isRunning ? `Running: ${episode.pipelineStage}...` :
             isDone ? 'All stages complete' :
             isError ? `Error: ${episode.pipelineError?.substring(0, 40)}...` :
             episode.pipelineStage}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(episode.pipelineStage === 'idle' || isError || isDone) && !isRunningAny && (
            <button
              onClick={() => onRun(episode)}
              className="btn btn-primary btn-sm !py-1.5 !px-3 text-xs"
            >
              {isError || isDone ? <><RefreshCw size={13} /> {isDone ? 'Restart' : 'Retry'}</> : <><Zap size={13} /> Run</>}
            </button>
          )}
          <button
            onClick={() => setOpen(!open)}
            disabled={episode.pipelineStage === 'idle'}
            className="p-1.5 rounded-lg text-white/40 hover:text-white transition-all disabled:opacity-30"
          >
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>

      {/* Stage progress bar (mini) */}
      <div className="px-5 pb-3">
        <div className="flex gap-1">
          {STAGES.map((s, i) => {
            const si = stageIndex(s.key);
            const ci = stageIndex(episode.pipelineStage);
            const filled = isDone || (si <= ci && !isError);
            return <div key={s.key} className={`h-1 flex-1 rounded-full transition-all ${filled ? 'bg-cyan-400' : 'bg-white/10'}`} />;
          })}
        </div>
      </div>

      {/* Expandable detail */}
      {open && episode.pipelineStage !== 'idle' && (
        <div className="border-t border-white/8 px-5 pb-4 pt-3 flex flex-col gap-2">
          {STAGES.map((s) => (
            <StageRow key={s.key} stage={s} current={episode.pipelineStage} />
          ))}

          {episode.script && (
            <div className="mt-3 bg-black/40 border border-white/8 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-purple-400 uppercase tracking-widest">Generated Script</p>
                <button
                  onClick={() => onRunTTS(episode)}
                  disabled={isRunning}
                  className="btn btn-sm !py-1 !px-2.5 text-[10px] bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30"
                >
                  <Volume2 size={12} className="mr-1" /> Regenerate Voice
                </button>
              </div>
              <textarea
                value={episode.script}
                onChange={(e) => updateEpisode(episode.id, { script: e.target.value })}
                className="w-full bg-transparent text-xs text-white/70 leading-relaxed custom-scrollbar outline-none resize-y min-h-[100px]"
                rows={12}
              />
            </div>
          )}

          {episode.transcriptText && (
            <div className="bg-black/40 border border-white/8 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Transcript Preview</p>
                <button
                  onClick={() => onRunScript(episode)}
                  disabled={isRunning}
                  className="btn btn-sm !py-1 !px-2.5 text-[10px] bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30"
                >
                  <Brain size={12} className="mr-1" /> Regenerate Script
                </button>
              </div>
              <textarea
                value={episode.transcriptText}
                onChange={(e) => updateEpisode(episode.id, { transcriptText: e.target.value })}
                className="w-full bg-transparent text-xs text-white/70 leading-relaxed custom-scrollbar outline-none resize-y min-h-[100px]"
                rows={12}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const { episodes, updateEpisode, animeTitle } = useVideoStore();
  const { isRunningAll, setRunningAll } = usePipelineStore();
  const settings = useSettingsStore();

  const readyEpisodes = episodes.filter((e) => e.uploadStatus === 'done');
  const doneEpisodes = episodes.filter((e) => e.pipelineStage === 'done');
  const erroredEpisodes = readyEpisodes.filter((e) => e.pipelineStage === 'error');
  const pendingEpisodes = readyEpisodes.filter((e) => e.pipelineStage === 'idle' || e.pipelineStage === 'error');
  const isAnyRunning = episodes.some((e) =>
    ['stripping', 'transcribing', 'scripting', 'tts'].includes(e.pipelineStage)
  );

  const runSingle = async (ep: Episode) => {
    await runEpisodePipeline(ep, settings, updateEpisode);
  };

  const runAll = async () => {
    setRunningAll(true);
    const toRun = readyEpisodes.filter(
      (e) => e.pipelineStage === 'idle' || e.pipelineStage === 'error'
    );
    for (const ep of toRun) {
      try {
        await runEpisodePipeline(
          useVideoStore.getState().episodes.find((e) => e.id === ep.id)!,
          settings,
          updateEpisode
        );
      } catch {
        // continue with next episode even if one fails
      }
    }
    setRunningAll(false);
  };

  if (readyEpisodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-5 text-center">
        <div className="p-6 bg-yellow-500/10 rounded-3xl border border-yellow-500/20">
          <AlertCircle size={48} className="text-yellow-400" />
        </div>
        <h2 className="text-3xl font-bold">No Episodes Found</h2>
        <p className="text-white/50 max-w-md text-base">
          You need to upload episodes first on the Ingest page before running the AI pipeline.
        </p>
        <Link href="/ingest" className="btn btn-primary mt-2">
          Go to Ingest →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-20 mt-4 relative z-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black text-white font-heading tracking-tight leading-none">
            AI Pipeline
          </h1>
          <p className="text-white/60 text-lg mt-3 font-medium">
            {animeTitle ? `Processing: ${animeTitle}` : 'Per-episode: Strip → Transcribe → Script → Voice'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-2xl font-black text-white">
              {doneEpisodes.length}
              <span className="text-white/30 text-lg font-bold"> / {readyEpisodes.length}</span>
            </p>
            <p className="text-xs text-white/40 font-bold uppercase tracking-widest">Complete</p>
          </div>

          {!isRunningAll && !isAnyRunning && doneEpisodes.length < readyEpisodes.length && pendingEpisodes.length > 0 && (
            <button onClick={runAll} className="btn btn-primary">
              {erroredEpisodes.length > 0 && pendingEpisodes.length === erroredEpisodes.length ? (
                <><RefreshCw size={18} /> Retry {erroredEpisodes.length} Failed</>
              ) : (
                <><Zap size={18} /> Run {pendingEpisodes.length} Episodes</>
              )}
            </button>
          )}

          {(isRunningAll || isAnyRunning) && (
            <button disabled className="btn btn-primary opacity-70 cursor-not-allowed">
              <Loader2 size={18} className="animate-spin" /> Running...
            </button>
          )}

          {doneEpisodes.length === readyEpisodes.length && readyEpisodes.length > 0 && (
            <Link href="/prolog" className="btn btn-primary">
              <PlayCircle size={18} /> Generate Prolog →
            </Link>
          )}
        </div>
      </div>

      {/* Episode Cards */}
      <div className="flex flex-col gap-4">
        {readyEpisodes.map((ep) => (
          <EpisodeCard
            key={ep.id}
            episode={ep}
            onRun={runSingle}
            onRunScript={async (epToRun) => await runScriptAndTTSPhase(epToRun, settings, updateEpisode)}
            onRunTTS={async (epToRun) => await runTTSPhase(epToRun, settings, updateEpisode)}
            updateEpisode={updateEpisode}
            isRunningAny={isAnyRunning || isRunningAll}
          />
        ))}
      </div>
    </div>
  );
}
