'use client';

import React, { useState } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { Image as ImageIcon, Download, Loader2, AlertCircle } from 'lucide-react';

export default function ThumbnailsPage() {
  const { exportedFileId } = useEditorStore();
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!exportedFileId) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/thumbnails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoFileId: exportedFileId }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      const data = await res.json();
      setThumbnails(data.thumbnails);
    } catch (e: any) { alert(e.message); }
    finally { setIsGenerating(false); }
  };

  if (!exportedFileId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-5 text-center">
        <div className="p-6 bg-red-500/10 rounded-3xl border border-red-500/20">
          <AlertCircle size={48} className="text-red-500" />
        </div>
        <h2 className="text-3xl font-bold">No Rendered Video Found</h2>
        <p className="text-white/50 max-w-md text-base">Render a final video in the Editor phase first.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 pb-20 mt-4 relative z-10">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-5xl font-black text-white font-heading tracking-tight leading-none">Thumbnails</h1>
          <p className="text-white/60 text-lg mt-3 font-medium">Extract high-quality frames for YouTube.</p>
        </div>
        <button onClick={handleGenerate} disabled={isGenerating} className="btn btn-primary btn-lg shrink-0">
          {isGenerating ? <><Loader2 size={20} className="lucide-spinner" /> Extracting...</> : <><ImageIcon size={20} /> Extract Frames</>}
        </button>
      </div>

      {thumbnails.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {thumbnails.map((thumb, idx) => (
            <div key={idx} className="glass-card !p-0 overflow-hidden group">
              <div className="relative aspect-video overflow-hidden">
                <img
                  src={`/api/file?name=${thumb}&dir=output`}
                  alt={`Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                  <a href={`/api/file?name=${thumb}&dir=output`} download
                    className="btn btn-ghost btn-sm w-full justify-center">
                    <Download size={16} /> Save Option {idx + 1}
                  </a>
                </div>
              </div>
              <div className="p-4 flex justify-between items-center">
                <span className="font-bold text-base">Option {idx + 1}</span>
                <a href={`/api/file?name=${thumb}&dir=output`} download
                  className="text-white/50 hover:text-white transition-colors text-sm font-semibold flex items-center gap-1.5">
                  <Download size={14} /> Save
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card flex flex-col items-center justify-center min-h-[380px] gap-5 opacity-50">
          <div className="p-6 bg-white/5 rounded-3xl"><ImageIcon size={56} className="text-white/50" /></div>
          <h3 className="text-2xl font-bold">No Thumbnails Yet</h3>
          <p className="text-center max-w-sm text-base">Click "Extract Frames" to pull the best shots from your final video.</p>
        </div>
      )}
    </div>
  );
}
