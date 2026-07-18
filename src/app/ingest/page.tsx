'use client';

import React, { useCallback, useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  UploadCloud, FileVideo, X, GripVertical, CheckCircle2,
  Loader2, ChevronDown, ChevronRight, Scissors, AlertTriangle,
  ListOrdered, Play, Wand2,
} from 'lucide-react';
import { useVideoStore, Episode } from '@/stores/useVideoStore';
import Link from 'next/link';

const fmt = (b: number) => (b / 1024 / 1024).toFixed(1) + ' MB';

function EpisodeAccordion({
  episode,
  dragHandleProps,
  isDragging,
}: {
  episode: Episode;
  dragHandleProps: React.HTMLAttributes<HTMLDivElement>;
  isDragging: boolean;
}) {
  const { updateEpisode, removeEpisode, toggleAccordion, setEpisodeConfig, autoDetectOped } = useVideoStore();
  const [localOpening, setLocalOpening] = useState(episode.openingDuration);
  const [localEnding, setLocalEnding] = useState(episode.endingDuration);

  // Sync local state when store updates (e.g. after auto-detect)
  React.useEffect(() => {
    setLocalOpening(episode.openingDuration);
    setLocalEnding(episode.endingDuration);
  }, [episode.openingDuration, episode.endingDuration]);

  const statusIcon = () => {
    if (episode.uploadStatus === 'uploading')
      return <Loader2 size={18} className="text-cyan-400 animate-spin shrink-0" />;
    if (episode.uploadStatus === 'error')
      return <AlertTriangle size={18} className="text-red-400 shrink-0" />;
    return <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />;
  };

  const stageColor: Record<string, string> = {
    idle: 'text-white/30',
    stripping: 'text-yellow-400',
    transcribing: 'text-cyan-400',
    scripting: 'text-purple-400',
    tts: 'text-pink-400',
    done: 'text-emerald-400',
    error: 'text-red-400',
  };

  return (
    <div
      className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
        isDragging
          ? 'opacity-40 scale-95 border-cyan-400/50 shadow-[0_0_30px_rgba(6,182,212,0.2)]'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20'
      }`}
    >
      {/* Accordion Header */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Drag Handle */}
        <div
          {...dragHandleProps}
          className="cursor-grab active:cursor-grabbing text-white/25 hover:text-white/60 transition-colors shrink-0 touch-none"
        >
          <GripVertical size={20} />
        </div>

        {/* Episode number badge */}
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500/30 to-cyan-500/30 border border-white/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-black text-white/80">{episode.episodeNumber}</span>
        </div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate text-white/90">{episode.originalName}</div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-white/40">{fmt(episode.size)}</span>
            <span className={`text-xs font-bold capitalize ${stageColor[episode.pipelineStage]}`}>
              {episode.pipelineStage === 'idle' ? 'Ready' : episode.pipelineStage}
            </span>
          </div>
        </div>

        {/* Upload status */}
        {statusIcon()}

        {/* Remove */}
        {episode.uploadStatus !== 'uploading' && (
          <button
            onClick={() => removeEpisode(episode.id)}
            className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
          >
            <X size={16} />
          </button>
        )}

        {/* Accordion toggle */}
        <button
          onClick={() => toggleAccordion(episode.id)}
          disabled={episode.uploadStatus !== 'done'}
          className="p-1.5 rounded-lg text-white/40 hover:text-white transition-all shrink-0 disabled:opacity-30"
        >
          {episode.isAccordionOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* Upload progress bar */}
      {episode.uploadStatus === 'uploading' && (
        <div className="px-4 pb-3">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all duration-300 rounded-full"
              style={{ width: `${episode.uploadProgress}%` }}
            />
          </div>
          <span className="text-xs text-white/40 mt-1 inline-block">{episode.uploadProgress}%</span>
        </div>
      )}

      {/* Accordion Body */}
      {episode.isAccordionOpen && episode.uploadStatus === 'done' && (
        <div className="px-4 pb-4 border-t border-white/8 pt-4 flex flex-col gap-4">
          {/* Strip config */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-white/60 uppercase tracking-widest flex items-center gap-1.5">
                <Scissors size={12} className="text-yellow-400" /> Opening cut
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={localOpening}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || 0;
                    setLocalOpening(v);
                    setEpisodeConfig(episode.id, v, localEnding);
                  }}
                  className="w-20 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white text-center focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/25 transition-colors"
                />
                <span className="text-xs text-white/40">seconds from start</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-white/60 uppercase tracking-widest flex items-center gap-1.5">
                <Scissors size={12} className="text-orange-400" /> Ending cut
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={localEnding}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || 0;
                    setLocalEnding(v);
                    setEpisodeConfig(episode.id, localOpening, v);
                  }}
                  className="w-20 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white text-center focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/25 transition-colors"
                />
                <span className="text-xs text-white/40">seconds from end</span>
              </div>
            </div>
          </div>

          {/* Auto Detect Button */}
          <div className="flex justify-end border-b border-white/8 pb-4">
            <button
              onClick={() => autoDetectOped(episode.id)}
              disabled={episode.isDetectingOped}
              className="btn btn-sm bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs border border-white/10"
            >
              {episode.isDetectingOped ? (
                <><Loader2 size={14} className="animate-spin text-cyan-400" /> Detecting...</>
              ) : (
                <><Wand2 size={14} className="text-purple-400" /> Auto-Detect OP/ED</>
              )}
            </button>
          </div>

          {/* Pipeline stages mini-status */}
          {episode.pipelineStage !== 'idle' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {(['stripping', 'transcribing', 'scripting', 'tts', 'done'] as const).map((stage, idx) => {
                const stages = ['stripping', 'transcribing', 'scripting', 'tts', 'done'];
                const currentIdx = stages.indexOf(episode.pipelineStage);
                const isDone = idx < currentIdx || episode.pipelineStage === 'done';
                const isActive = stage === episode.pipelineStage;
                return (
                  <div key={stage} className="flex items-center gap-1.5">
                    <div className={`h-1.5 w-8 rounded-full transition-all ${isDone || isActive ? 'bg-cyan-400' : 'bg-white/15'}`} />
                    <span className={`text-[10px] font-bold capitalize ${isDone ? 'text-emerald-400' : isActive ? 'text-cyan-400' : 'text-white/25'}`}>
                      {stage}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {episode.pipelineError && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{episode.pipelineError}</p>
            </div>
          )}

          {episode.script && (
            <div className="bg-black/40 border border-white/8 rounded-xl p-3">
              <p className="text-xs font-bold text-purple-400 mb-1.5 uppercase tracking-widest">Script Preview</p>
              <p className="text-xs text-white/60 leading-relaxed line-clamp-3">{episode.script}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function IngestPage() {
  const { episodes, addEpisode, updateEpisode, animeTitle, setAnimeTitle, animeSynopsis, setAnimeSynopsis, reorderEpisodes, autoDetectOped } = useVideoStore();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);
  const [isBulkDetecting, setIsBulkDetecting] = useState(false);

  const handleBulkDetect = async () => {
    setIsBulkDetecting(true);
    for (const ep of episodes) {
      if (ep.uploadStatus === 'done' && !ep.isDetectingOped) {
        await autoDetectOped(ep.id);
      }
    }
    setIsBulkDetecting(false);
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        const tempId = Math.random().toString(36).substring(7);
        addEpisode({
          id: tempId,
          fileId: tempId,
          originalName: file.name,
          size: file.size,
          uploadStatus: 'uploading',
          uploadProgress: 0,
        });

        const formData = new FormData();
        formData.append('video', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload', true);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            updateEpisode(tempId, { uploadProgress: Math.round((e.loaded / e.total) * 100) });
        };
        xhr.onload = () => {
          if (xhr.status === 200) {
            const r = JSON.parse(xhr.responseText);
            updateEpisode(tempId, { fileId: r.fileId, uploadStatus: 'done', uploadProgress: 100 });
          } else {
            updateEpisode(tempId, { uploadStatus: 'error' });
          }
        };
        xhr.onerror = () => updateEpisode(tempId, { uploadStatus: 'error' });
        xhr.send(formData);
      }
    },
    [addEpisode, updateEpisode]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mkv', '.avi', '.mov', '.webm']
    },
  });

  const readyCount = episodes.filter((e) => e.uploadStatus === 'done').length;
  const doneCount = episodes.filter((e) => e.pipelineStage === 'done').length;

  const handleDragStart = (i: number) => setDraggedIndex(i);
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === i) return;
    dragOverIndex.current = i;
    reorderEpisodes(draggedIndex, i);
    setDraggedIndex(i);
  };
  const handleDragEnd = () => { setDraggedIndex(null); dragOverIndex.current = null; };

  return (
    <div className="flex flex-col gap-8 pb-20 mt-4 relative z-10">
      {/* Header */}
      <div>
        <h1 className="text-5xl font-black text-white font-heading tracking-tight leading-none">
          Ingest Episodes
        </h1>
        <p className="text-white/60 text-lg mt-3 font-medium">
          Upload anime episodes in order. We'll strip openings/endings and process each one independently.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Episode list + Dropzone */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Anime title input */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-white/60 uppercase tracking-widest">Anime Title</label>
            <input
              type="text"
              placeholder="e.g. Demon Slayer Season 1"
              value={animeTitle}
              onChange={(e) => setAnimeTitle(e.target.value)}
              className="bg-white/[0.04] border border-white/10 rounded-2xl px-5 py-3.5 text-white font-bold placeholder:text-white/25 focus:outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/15 transition-all"
            />
          </div>

          {/* Anime Synopsis input */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-white/60 uppercase tracking-widest">Anime Synopsis & Context</label>
            <textarea
              placeholder="Paste the MAL synopsis or list character names here (e.g. Iori, Chisa, Nanaka) to give the AI context..."
              value={animeSynopsis}
              onChange={(e) => setAnimeSynopsis(e.target.value)}
              rows={4}
              className="bg-white/[0.04] border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white/80 placeholder:text-white/25 focus:outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/15 transition-all resize-y custom-scrollbar"
            />
          </div>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-all duration-500 relative overflow-hidden group ${
              episodes.length > 0 ? 'p-6' : 'p-14'
            } ${
              isDragActive
                ? 'border-cyan-400 bg-cyan-400/10 scale-[1.01] shadow-[0_0_60px_rgba(6,182,212,0.2)]'
                : 'border-white/10 bg-white/[0.02] hover:border-cyan-400/40 hover:bg-cyan-500/5'
            }`}
          >
            {isDragActive && (
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 pointer-events-none" />
            )}
            <input {...getInputProps()} />
            <div className={`p-4 rounded-2xl mb-3 transition-all duration-300 ${isDragActive ? 'bg-cyan-400 text-black scale-110' : 'bg-white/8 text-white/50 group-hover:text-cyan-400 group-hover:bg-cyan-400/15'}`}>
              <UploadCloud size={episodes.length > 0 ? 28 : 42} />
            </div>
            <p className={`font-bold text-white/70 ${episodes.length > 0 ? 'text-base' : 'text-xl'}`}>
              {isDragActive ? 'Drop episodes here...' : episodes.length > 0 ? 'Drop more episodes' : 'Drag & drop all episodes at once'}
            </p>
            {episodes.length === 0 && (
              <p className="text-white/35 text-sm mt-1">Supports MP4, MKV, AVI, WebM</p>
            )}
          </div>

          {/* Episode List with Accordion */}
          {episodes.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <ListOrdered size={18} className="text-cyan-400" />
                <h3 className="text-base font-bold text-white/80">
                  Episode Queue
                </h3>
                <span className="bg-cyan-500/15 text-cyan-400 text-xs font-black px-2.5 py-1 rounded-full border border-cyan-500/25">
                  {episodes.length} episodes
                </span>
                <span className="text-white/30 text-xs">· drag to reorder</span>
              </div>

              <div className="flex flex-col gap-2">
                {episodes.map((ep, index) => (
                  <div
                    key={ep.id}
                    draggable={ep.uploadStatus === 'done'}
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    <EpisodeAccordion
                      episode={ep}
                      isDragging={draggedIndex === index}
                      dragHandleProps={{
                        onMouseDown: (e) => e.stopPropagation(),
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Summary + CTA */}
        <div className="flex flex-col gap-5">
          <div className="glass-card flex flex-col gap-5 sticky top-24">
            <h2 className="text-xl font-bold border-b border-white/10 pb-5">Session Summary</h2>

            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/60">Episodes uploaded</span>
                <span className="text-sm font-black text-white">{readyCount} / {episodes.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/60">Pipeline complete</span>
                <span className="text-sm font-black text-emerald-400">{doneCount} / {episodes.length}</span>
              </div>
              {animeTitle && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white/60">Project</span>
                  <span className="text-sm font-black text-purple-400 truncate max-w-[140px]">{animeTitle}</span>
                </div>
              )}
            </div>

            <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-4 flex flex-col gap-3">
              <div>
                <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Default Strip Config</p>
                <p className="text-xs text-white/40 leading-relaxed mt-1">
                  By default, <strong className="text-yellow-400">90s</strong> from start and <strong className="text-orange-400">90s</strong> from end are removed. Use Auto-Detect to let AI find the exact OP/ED duration based on silence and scene cuts.
                </p>
              </div>
              <button
                onClick={handleBulkDetect}
                disabled={isBulkDetecting || readyCount === 0}
                className="btn btn-sm bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 text-xs w-full justify-center"
              >
                {isBulkDetecting ? (
                  <><Loader2 size={14} className="animate-spin" /> Detecting all...</>
                ) : (
                  <><Wand2 size={14} /> Auto-Detect All</>
                )}
              </button>
            </div>

            <Link
              href="/pipeline"
              className={`btn btn-primary btn-full text-center ${readyCount === 0 ? 'opacity-30 pointer-events-none' : ''}`}
            >
              <Play size={18} /> Start AI Pipeline →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
