'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileVideo, X, Loader2, GripVertical, CheckCircle2, Merge } from 'lucide-react';
import { useVideoStore } from '@/stores/useVideoStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

export default function IngestPage() {
  const { files, addFile, updateFile, removeFile, reorderFiles, isMerging, setMerging, setMergedFileId } = useVideoStore();
  const settings = useSettingsStore();
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const tempId = Math.random().toString(36).substring(7);
      addFile({ id: tempId, originalName: file.name, size: file.size, progress: 0, status: 'uploading' });
      const formData = new FormData();
      formData.append('video', file);
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload', true);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) updateFile(tempId, { progress: Math.round((e.loaded / e.total) * 100) });
        };
        xhr.onload = () => {
          if (xhr.status === 200) {
            const r = JSON.parse(xhr.responseText);
            updateFile(tempId, { id: r.fileId, status: 'done', progress: 100 });
          } else {
            updateFile(tempId, { status: 'error' });
          }
        };
        xhr.onerror = () => updateFile(tempId, { status: 'error' });
        xhr.send(formData);
      } catch {
        updateFile(tempId, { status: 'error' });
      }
    }
  }, [addFile, updateFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'video/*': [] } });

  const handleMerge = async () => {
    if (files.length === 0 || files.some(f => f.status !== 'done')) return;
    setMerging(true);
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: files.map(f => f.id), autoZoomPercent: settings.autoZoomPercent }),
      });
      if (!res.ok) throw new Error('Merge failed');
      const data = await res.json();
      setMergedFileId(data.mergedFileId);
    } catch {
      alert('Failed to merge videos.');
    } finally {
      setMerging(false);
    }
  };

  const handleDragStart = (i: number) => setDraggedItemIndex(i);
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === i) return;
    reorderFiles(draggedItemIndex, i);
    setDraggedItemIndex(i);
  };
  const handleDragEnd = () => setDraggedItemIndex(null);
  const fmt = (b: number) => (b / 1024 / 1024).toFixed(2) + ' MB';

  return (
    <div className="flex flex-col gap-10 pb-20 mt-4 relative z-10">
      {/* Header */}
      <div>
        <h1 className="text-5xl font-black text-white font-heading tracking-tight leading-none">Ingest &amp; Prepare</h1>
        <p className="text-white/60 text-lg mt-3 font-medium">Upload video parts, reorder them, and merge into a single master file.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Dropzone Column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-3xl p-16 flex flex-col items-center justify-center cursor-pointer transition-all duration-500 relative overflow-hidden group ${
              isDragActive
                ? 'border-cyan-400 bg-cyan-400/10 scale-[1.01] shadow-[0_0_60px_rgba(6,182,212,0.25)]'
                : 'border-white/15 bg-white/[0.02] hover:border-cyan-400/40 hover:bg-cyan-500/5 hover:shadow-[0_0_40px_rgba(6,182,212,0.1)]'
            }`}
          >
            {isDragActive && <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/15 to-purple-500/15 pointer-events-none" />}
            <input {...getInputProps()} />
            <div className={`p-5 rounded-2xl mb-6 transition-all duration-300 ${isDragActive ? 'bg-cyan-400 text-black shadow-[0_0_30px_rgba(6,182,212,0.6)] scale-110' : 'bg-white/10 text-white/60 group-hover:bg-cyan-400/20 group-hover:text-cyan-400 group-hover:scale-110'}`}>
              <UploadCloud size={48} />
            </div>
            <h3 className="text-2xl font-bold mb-2 tracking-tight">
              {isDragActive ? 'Release to upload...' : 'Drag & drop video files'}
            </h3>
            <p className="text-white/40 text-sm font-medium text-center">Supports MP4, MKV, AVI, WebM — multiple files at once</p>
          </div>

          {files.length > 0 && (
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-bold flex items-center gap-3 text-white/80">
                <FileVideo size={18} className="text-cyan-400" /> Upload Queue
                <span className="bg-cyan-500/20 text-cyan-400 text-xs font-black px-2.5 py-1 rounded-full border border-cyan-500/30">{files.length}</span>
              </h3>
              <div className="flex flex-col gap-2.5">
                {files.map((file, index) => (
                  <div
                    key={file.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`glass-card !py-4 !px-5 flex items-center gap-4 transition-all ${draggedItemIndex === index ? 'opacity-40 scale-95 border-cyan-400/50' : 'hover:scale-[1.005]'}`}
                  >
                    <div className="cursor-grab active:cursor-grabbing text-white/30 hover:text-white/60 transition-colors">
                      <GripVertical size={20} />
                    </div>
                    <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl">
                      <FileVideo size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{file.originalName}</div>
                      <div className="text-xs text-white/40 mt-0.5">{fmt(file.size)}</div>
                    </div>
                    {file.status === 'uploading' && (
                      <div className="flex items-center gap-3 w-36">
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all duration-300 rounded-full" style={{ width: `${file.progress}%` }} />
                        </div>
                        <span className="text-xs text-white/60 font-bold w-9 text-right">{file.progress}%</span>
                      </div>
                    )}
                    {file.status === 'done' && <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />}
                    {file.status === 'error' && <span className="text-xs font-black text-red-500 bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20">FAILED</span>}
                    <button onClick={() => removeFile(file.id)} className="p-2 rounded-xl text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all ml-1">
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Controls Column */}
        <div className="flex flex-col gap-6">
          <div className="glass-card flex flex-col gap-6 sticky top-24">
            <h2 className="text-xl font-bold border-b border-white/10 pb-5">Merge Controls</h2>

            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-white/70">Auto-Zoom / Crop Subtitles</label>
                <span className="text-cyan-400 font-black text-sm bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20">{settings.autoZoomPercent}%</span>
              </div>
              <input
                type="range" min="0" max="30" step="1"
                value={settings.autoZoomPercent}
                onChange={(e) => settings.setPreference('autoZoomPercent', parseInt(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-400"
              />
              <p className="text-xs text-white/40">Zooms into video to crop hardcoded subtitles at bottom.</p>
            </div>

            <button
              onClick={handleMerge}
              disabled={files.length === 0 || files.some(f => f.status !== 'done') || isMerging}
              className="btn btn-primary btn-full"
            >
              {isMerging
                ? <><Loader2 size={18} className="lucide-spinner" /> Merging...</>
                : <><Merge size={18} /> Merge &amp; Prepare</>
              }
            </button>

            {useVideoStore.getState().mergedFileId && !isMerging && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex items-start gap-3">
                <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-400 text-sm">Merge Complete!</div>
                  <div className="text-xs text-emerald-500/70 mt-1">Proceed to AI Pipeline to continue.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
