'use client';

import React from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useVideoStore } from '@/stores/useVideoStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import {
  Sliders, Clapperboard, Download, Loader2, AlertCircle,
  FlipHorizontal, Droplets, Palette, MonitorPlay, Film,
} from 'lucide-react';
import Link from 'next/link';

export default function EditorPage() {
  const {
    finalExportId,
    finalWords,
  } = useVideoStore();
  const settings = useSettingsStore();
  const {
    mirror, colorGrade, contrast, saturation, warmth, zoom, panX, panY, blurBackground,
    isExporting, exportedFileId,
    setTransform, setExporting, setExportedFileId,
  } = useEditorStore();

  // Editor now applies post-processing effects to the final assembled video
  const handleExport = async () => {
    if (!finalExportId) return;
    setExporting(true);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoFileId: finalExportId,
          audioFileId: null,   // audio is already baked in by /api/assemble
          words: finalWords || [],           // subtitles already baked in
          outputFormat: settings.outputFormat,
          transforms: { mirror, colorGrade, contrast, saturation, warmth, zoom, panX, panY, blurBackground },
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Export failed'); }
      const data = await res.json();
      setExportedFileId(data.exportedFileId);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setExporting(false);
    }
  };

  if (!finalExportId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="p-6 bg-cyan-500/10 rounded-full animate-pulse"><Loader2 size={48} className="text-cyan-400 animate-spin" /></div>
        <p className="text-xl font-bold text-white/50 tracking-tight">No assembled video loaded</p>
        <Link href="/voice" className="btn btn-primary mt-2">Go to Assembly Stage</Link>
      </div>
    );
  }

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = React.useState(0);

  // Group words into chunks of 5 (matches the export subtitle logic)
  const subtitleChunks = React.useMemo(() => {
    if (!finalWords) return [];
    const chunks = [];
    let currentChunk = [];
    for (const w of finalWords) {
      currentChunk.push(w);
      if (currentChunk.length >= 5) {
        chunks.push(currentChunk);
        currentChunk = [];
      }
    }
    if (currentChunk.length > 0) chunks.push(currentChunk);
    return chunks;
  }, [finalWords]);

  // Find the chunk that is currently being spoken
  const activeChunk = subtitleChunks.find(
    chunk => currentTime >= chunk[0].start && currentTime <= chunk[chunk.length - 1].end
  ) || [];

  // Construct CSS filters
  const filterStyle = colorGrade 
    ? `contrast(${contrast}) saturate(${saturation}) hue-rotate(${warmth * 10}deg)` 
    : 'none';
  const transformStyle = `scale(${zoom}) ${mirror ? 'scaleX(-1)' : ''}`;
  const transformOriginStyle = `${panX}% ${panY}%`;

  return (
    <div className="flex flex-col gap-10 pb-20 mt-4 relative z-10">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-5xl font-black text-white font-heading tracking-tight leading-none">
            Final Editor
          </h1>
          <p className="text-white/60 text-lg mt-3 font-medium">
            Apply post-processing effects to your assembled recap video.
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {exportedFileId && (
            <a href={`/api/file?name=${exportedFileId}&dir=output`} download className="btn btn-ghost text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10">
              <Download size={20} /> Download Result
            </a>
          )}
          <button onClick={handleExport} disabled={isExporting} className="btn btn-primary btn-lg">
            {isExporting
              ? <><Loader2 size={20} className="animate-spin" /> Rendering...</>
              : <><Clapperboard size={20} /> Export Final</>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" style={{ height: 'calc(100vh - 250px)', minHeight: '580px' }}>
        {/* Canvas */}
        <div className="lg:col-span-2 glass-card flex flex-col gap-5 overflow-hidden relative">
          <div className="flex items-center gap-3 border-b border-white/10 pb-5 shrink-0 z-20">
            <div className="p-3 bg-pink-500/20 rounded-xl"><MonitorPlay size={22} className="text-pink-400" /></div>
            <h2 className="text-xl font-bold">Live Preview</h2>
          </div>
          
          <div className="flex-1 bg-black/80 rounded-2xl border border-white/8 overflow-hidden relative flex items-center justify-center">
            {/* The Video Layer (forced to 16:9 aspect ratio) */}
            <div className="w-full aspect-video relative overflow-hidden flex items-center justify-center bg-black">
              <video 
                ref={videoRef}
                src={`/api/file?name=${finalExportId}&dir=output`} 
                controls 
                className="w-full h-full object-cover transition-transform duration-200"
                style={{ 
                  transform: transformStyle,
                  transformOrigin: transformOriginStyle,
                  filter: filterStyle,
                }}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              />
            </div>
            
            {/* Subtitle Overlay Layer */}
            {activeChunk.length > 0 && (
              <div 
                className="absolute bottom-10 left-0 right-0 text-center pointer-events-none z-10 px-8"
              >
                <span 
                  className="inline-block text-[42px] font-bold text-yellow-400"
                  style={{
                    fontFamily: 'Arial, sans-serif',
                    textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0px 3px 6px rgba(0,0,0,0.8)',
                  }}
                >
                  {activeChunk.map(w => w.word).join(' ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tools */}
        <div className="glass-card flex flex-col gap-6 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-3 border-b border-white/10 pb-5 shrink-0">
            <div className="p-3 bg-cyan-500/20 rounded-xl"><Sliders size={22} className="text-cyan-400" /></div>
            <h2 className="text-xl font-bold">Effects</h2>
          </div>

          <div className="flex flex-col gap-4">
            {/* Mirror */}
            <label className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/8 cursor-pointer hover:border-cyan-500/30 hover:bg-white/[0.04] transition-all">
              <div className="flex items-center gap-3">
                <FlipHorizontal size={18} className="text-cyan-400" />
                <span className="font-bold text-sm">Mirror Video</span>
              </div>
              <div className={`relative w-12 h-6 rounded-full transition-all ${mirror ? 'bg-cyan-500' : 'bg-white/15'}`}>
                <input type="checkbox" className="sr-only" checked={mirror} onChange={(e) => setTransform('mirror', e.target.checked)} />
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${mirror ? 'translate-x-6' : ''}`} />
              </div>
            </label>

            {/* Blur Background */}
            {settings.outputFormat === '9:16' && (
              <label className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/8 cursor-pointer hover:border-blue-500/30 hover:bg-white/[0.04] transition-all">
                <div className="flex items-center gap-3">
                  <Droplets size={18} className="text-blue-400" />
                  <span className="font-bold text-sm">Blur Background</span>
                </div>
                <div className={`relative w-12 h-6 rounded-full transition-all ${blurBackground ? 'bg-blue-500' : 'bg-white/15'}`}>
                  <input type="checkbox" className="sr-only" checked={blurBackground} onChange={(e) => setTransform('blurBackground', e.target.checked)} />
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${blurBackground ? 'translate-x-6' : ''}`} />
                </div>
              </label>
            )}

            {/* Zoom Video */}
            <div className={`p-4 rounded-2xl border transition-all ${zoom > 1.0 ? 'border-pink-500/40 bg-pink-500/5' : 'border-white/8 bg-black/40'}`}>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between text-sm font-bold items-center mt-3">
                  <div className="flex items-center gap-3">
                    <MonitorPlay size={18} className="text-pink-400" />
                    <span className="text-white">Zoom</span>
                  </div>
                  <span className="text-pink-400">{zoom.toFixed(2)}x</span>
                </div>
                <input
                  type="range" min="1.0" max="1.5" step="0.05" value={zoom}
                  onChange={(e) => setTransform('zoom', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-pink-400"
                />
                
                {zoom > 1.0 && (
                  <div className="flex flex-col gap-4 mt-3 pt-4 border-t border-white/10">
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-white/60">Horizontal Pan</span>
                        <span className="text-pink-400">{panX}%</span>
                      </div>
                      <input
                        type="range" min="0" max="100" step="1" value={panX}
                        onChange={(e) => setTransform('panX', parseInt(e.target.value))}
                        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-pink-400"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-white/60">Vertical Pan</span>
                        <span className="text-pink-400">{panY}%</span>
                      </div>
                      <input
                        type="range" min="0" max="100" step="1" value={panY}
                        onChange={(e) => setTransform('panY', parseInt(e.target.value))}
                        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-pink-400"
                      />
                    </div>
                  </div>
                )}
                <p className="text-xs text-white/40 mt-1">Zoom in, then adjust pan to crop</p>
              </div>
            </div>

            {/* Color Grading */}
            <div className={`p-4 rounded-2xl border transition-all ${colorGrade ? 'border-purple-500/40 bg-purple-500/5' : 'border-white/8 bg-black/40'}`}>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-3">
                  <Palette size={18} className="text-purple-400" />
                  <span className="font-bold text-sm">Color Grading</span>
                </div>
                <div className={`relative w-12 h-6 rounded-full transition-all ${colorGrade ? 'bg-purple-500' : 'bg-white/15'}`}>
                  <input type="checkbox" className="sr-only" checked={colorGrade} onChange={(e) => setTransform('colorGrade', e.target.checked)} />
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${colorGrade ? 'translate-x-6' : ''}`} />
                </div>
              </label>

              {colorGrade && (
                <div className="flex flex-col gap-5 mt-5 pt-5 border-t border-white/10">
                  {[
                    { label: 'Contrast',   key: 'contrast'   as const, val: contrast,   min: '0.5', max: '1.5', step: '0.05' },
                    { label: 'Saturation', key: 'saturation' as const, val: saturation, min: '0.5', max: '2.0', step: '0.05' },
                    { label: 'Warmth',     key: 'warmth'     as const, val: warmth,     min: '-10', max: '10',  step: '1'    },
                  ].map(({ label, key, val, min, max, step }) => (
                    <div key={key} className="flex flex-col gap-2">
                      <div className="flex justify-between text-sm font-bold">
                        <span className="text-white/70">{label}</span>
                        <span className="text-purple-400">
                          {key === 'warmth' && val > 0 ? `+${val}` : val}
                        </span>
                      </div>
                      <input
                        type="range" min={min} max={max} step={step} value={val}
                        onChange={(e) => setTransform(key, parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-400"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
