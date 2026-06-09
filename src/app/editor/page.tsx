'use client';

import React from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useVideoStore } from '@/stores/useVideoStore';
import { useVoiceStore } from '@/stores/useVoiceStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { Sliders, Clapperboard, Download, Loader2, AlertCircle, FlipHorizontal, Droplets, Palette, MonitorPlay } from 'lucide-react';

export default function EditorPage() {
  const { mergedFileId } = useVideoStore();
  const { ttsAudioUrl, syncedWords } = useVoiceStore();
  const settings = useSettingsStore();
  const { mirror, colorGrade, contrast, saturation, warmth, blurBackground, isExporting, exportedFileId, setTransform, setExporting, setExportedFileId } = useEditorStore();

  const handleExport = async () => {
    if (!mergedFileId || !ttsAudioUrl) return;
    const urlParams = new URLSearchParams(ttsAudioUrl.split('?')[1]);
    const audioFilename = urlParams.get('name');
    if (!audioFilename) return;
    setExporting(true);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoFileId: mergedFileId, audioFileId: audioFilename, words: syncedWords, outputFormat: settings.outputFormat, transforms: { mirror, colorGrade, contrast, saturation, warmth, blurBackground } }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Export failed'); }
      const data = await res.json();
      setExportedFileId(data.exportedFileId);
    } catch (e: any) { alert(e.message); }
    finally { setExporting(false); }
  };

  if (!mergedFileId || !ttsAudioUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-5 text-center">
        <div className="p-6 bg-red-500/10 rounded-3xl border border-red-500/20">
          <AlertCircle size={48} className="text-red-500" />
        </div>
        <h2 className="text-3xl font-bold">Missing Assets</h2>
        <p className="text-white/50 max-w-md text-base">You need a merged video (Ingest) and a voiceover (Voice) to enter the Editor.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 pb-20 mt-4 relative z-10">
      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-5xl font-black text-white font-heading tracking-tight leading-none">Final Editor</h1>
          <p className="text-white/60 text-lg mt-3 font-medium">Apply filters and export your final recap video.</p>
        </div>
        <button onClick={handleExport} disabled={isExporting} className="btn btn-primary btn-lg shrink-0">
          {isExporting ? <><Loader2 size={20} className="lucide-spinner" /> Rendering...</> : <><Clapperboard size={20} /> Export Video</>}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" style={{ height: 'calc(100vh - 250px)', minHeight: '580px' }}>

        {/* Canvas */}
        <div className="lg:col-span-2 glass-card flex flex-col gap-5 overflow-hidden">
          <div className="flex items-center gap-3 border-b border-white/10 pb-5 shrink-0">
            <div className="p-3 bg-pink-500/20 rounded-xl"><MonitorPlay size={22} className="text-pink-400" /></div>
            <h2 className="text-xl font-bold">Canvas Preview</h2>
          </div>
          <div className="flex-1 bg-black/60 rounded-2xl border border-white/8 overflow-hidden flex items-center justify-center">
            {exportedFileId
              ? <video src={`/api/file?name=${exportedFileId}&dir=output`} controls autoPlay className="w-full h-full object-contain" />
              : <div className="text-center opacity-35 flex flex-col items-center gap-4 p-8">
                  <Clapperboard size={56} />
                  <p className="text-base font-medium leading-relaxed">Preview unavailable in real-time.<br />Adjust settings &amp; click Export.</p>
                </div>
            }
          </div>
          {exportedFileId && (
            <div className="flex justify-center shrink-0">
              <a href={`/api/file?name=${exportedFileId}&dir=output`} download
                className="btn btn-ghost">
                <Download size={18} /> Download Render
              </a>
            </div>
          )}
        </div>

        {/* Tools */}
        <div className="glass-card flex flex-col gap-6 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-3 border-b border-white/10 pb-5 shrink-0">
            <div className="p-3 bg-cyan-500/20 rounded-xl"><Sliders size={22} className="text-cyan-400" /></div>
            <h2 className="text-xl font-bold">Tools</h2>
          </div>

          <div className="flex flex-col gap-4">
            {/* Mirror Toggle */}
            <label className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/8 cursor-pointer hover:border-cyan-500/30 hover:bg-white/[0.04] transition-all">
              <div className="flex items-center gap-3">
                <FlipHorizontal size={18} className="text-cyan-400" />
                <span className="font-bold text-sm">Mirror Video</span>
              </div>
              <div className={`relative w-12 h-6 rounded-full transition-all ${mirror ? 'bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.5)]' : 'bg-white/15'}`}>
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
                <div className={`relative w-12 h-6 rounded-full transition-all ${blurBackground ? 'bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.5)]' : 'bg-white/15'}`}>
                  <input type="checkbox" className="sr-only" checked={blurBackground} onChange={(e) => setTransform('blurBackground', e.target.checked)} />
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${blurBackground ? 'translate-x-6' : ''}`} />
                </div>
              </label>
            )}

            {/* Color Grading */}
            <div className={`p-4 rounded-2xl border transition-all ${colorGrade ? 'border-purple-500/40 bg-purple-500/5' : 'border-white/8 bg-black/40'}`}>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-3">
                  <Palette size={18} className="text-purple-400" />
                  <span className="font-bold text-sm">Color Grading</span>
                </div>
                <div className={`relative w-12 h-6 rounded-full transition-all ${colorGrade ? 'bg-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.5)]' : 'bg-white/15'}`}>
                  <input type="checkbox" className="sr-only" checked={colorGrade} onChange={(e) => setTransform('colorGrade', e.target.checked)} />
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${colorGrade ? 'translate-x-6' : ''}`} />
                </div>
              </label>

              {colorGrade && (
                <div className="flex flex-col gap-5 mt-5 pt-5 border-t border-white/10">
                  {[
                    { label: 'Contrast', key: 'contrast' as const, val: contrast, min: '0.5', max: '1.5', step: '0.05' },
                    { label: 'Saturation', key: 'saturation' as const, val: saturation, min: '0.5', max: '2.0', step: '0.05' },
                    { label: 'Warmth', key: 'warmth' as const, val: warmth, min: '-10', max: '10', step: '1' },
                  ].map(({ label, key, val, min, max, step }) => (
                    <div key={key} className="flex flex-col gap-2">
                      <div className="flex justify-between text-sm font-bold">
                        <span className="text-white/70">{label}</span>
                        <span className="text-purple-400">{typeof val === 'number' && val > 0 && key === 'warmth' ? `+${val}` : val}</span>
                      </div>
                      <input type="range" min={min} max={max} step={step} value={val}
                        onChange={(e) => setTransform(key, parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-400" />
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
