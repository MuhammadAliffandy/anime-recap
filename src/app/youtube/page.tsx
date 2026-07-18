'use client';

import React, { useState, useEffect } from 'react';
import { useVideoStore } from '@/stores/useVideoStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useEditorStore } from '@/stores/useEditorStore';
import {
  Youtube, Sparkles, Copy, Check, Hash, Type, FileText, Loader2,
  RefreshCw, Download, AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

export default function YoutubePage() {
  const { animeTitle, animeSynopsis, episodes, finalExportId } = useVideoStore();
  const settings = useSettingsStore();
  const { exportedFileId } = useEditorStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  const hasVideo = finalExportId || exportedFileId;
  const hasScripts = episodes.some(ep => ep.script);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/youtube-meta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-key': settings.openaiKey,
          'x-claude-key': settings.claudeKey,
          'x-ollama-model': settings.ollamaModel,
          'x-ollama-base-url': settings.ollamaBaseUrl,
        },
        body: JSON.stringify({
          animeTitle,
          animeSynopsis,
          episodeScripts: episodes.map(ep => ep.script || ''),
          provider: settings.llmProvider,
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'Generation failed');
      }
      const data = await res.json();
      setTitle(data.title);
      setDescription(data.description);
      setTags(data.tags);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const fullDescription = description + (tags.length > 0 ? '\n\n' + tags.map(t => `#${t.replace(/^#/, '')}`).join(' ') : '');

  if (!hasScripts) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="p-6 bg-red-500/10 rounded-full">
          <AlertCircle size={48} className="text-red-400" />
        </div>
        <p className="text-xl font-bold text-white/50 tracking-tight">No episode scripts found</p>
        <p className="text-white/30 text-sm">Complete the AI Pipeline first to generate scripts.</p>
        <Link href="/pipeline" className="btn btn-primary mt-2">Go to AI Pipeline</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 pb-20 mt-4 relative z-10">
      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-5xl font-black text-white font-heading tracking-tight leading-none flex items-center gap-4">
            <div className="p-3 bg-red-500/20 rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.3)]">
              <Youtube size={36} className="text-red-400" />
            </div>
            YouTube
          </h1>
          <p className="text-white/60 text-lg mt-3 font-medium">
            Generate an optimized title, description, and tags for your recap video.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="btn btn-primary btn-lg shrink-0"
        >
          {isGenerating ? (
            <><Loader2 size={20} className="animate-spin" /> Generating...</>
          ) : title ? (
            <><RefreshCw size={20} /> Regenerate</>
          ) : (
            <><Sparkles size={20} /> Generate with AI</>
          )}
        </button>
      </div>

      {error && (
        <div className="glass-card border-red-500/30 bg-red-500/5 p-4 text-red-400 text-sm font-medium flex items-center gap-3">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Anime Info */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 text-white/40 text-xs font-black uppercase tracking-widest mb-4">
          <FileText size={14} /> Project Info
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-bold text-white/50 tracking-wide">Anime Title</label>
            <p className="text-white font-bold text-lg mt-1">{animeTitle || '(Not set)'}</p>
          </div>
          <div>
            <label className="text-xs font-bold text-white/50 tracking-wide">Episodes</label>
            <p className="text-white font-bold text-lg mt-1">{episodes.length} episodes</p>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 text-red-400 text-xs font-black uppercase tracking-widest">
            <Type size={14} /> Video Title
          </div>
          {title && (
            <button
              onClick={() => copyToClipboard(title, 'title')}
              className="btn bg-white/5 text-white/60 hover:text-white hover:bg-white/10 text-xs py-2 px-3"
            >
              {copiedField === 'title' ? <><Check size={14} className="text-emerald-400" /> Copied!</> : <><Copy size={14} /> Copy</>}
            </button>
          )}
        </div>
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isGenerating ? 'Generating title...' : 'Click "Generate with AI" to create a catchy YouTube title...'}
          rows={2}
          className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white text-xl font-black focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/30 transition-all placeholder:text-white/15 resize-none"
        />
        {title && (
          <div className="mt-2 flex items-center gap-2">
            <span className={`text-xs font-bold ${title.length > 100 ? 'text-red-400' : 'text-emerald-400'}`}>
              {title.length}/100 characters
            </span>
            {title.length > 100 && <span className="text-xs text-red-400/70">⚠ Too long for YouTube</span>}
          </div>
        )}
      </div>

      {/* Description */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 text-cyan-400 text-xs font-black uppercase tracking-widest">
            <FileText size={14} /> Description
          </div>
          {description && (
            <button
              onClick={() => copyToClipboard(fullDescription, 'description')}
              className="btn bg-white/5 text-white/60 hover:text-white hover:bg-white/10 text-xs py-2 px-3"
            >
              {copiedField === 'description' ? <><Check size={14} className="text-emerald-400" /> Copied!</> : <><Copy size={14} /> Copy All</>}
            </button>
          )}
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={isGenerating ? 'Generating description...' : 'Click "Generate with AI" to create an engaging YouTube description...'}
          rows={10}
          className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm font-medium leading-relaxed focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 transition-all placeholder:text-white/15 resize-none"
        />
      </div>

      {/* Tags */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 text-purple-400 text-xs font-black uppercase tracking-widest">
            <Hash size={14} /> Tags
          </div>
          {tags.length > 0 && (
            <button
              onClick={() => copyToClipboard(tags.map(t => `#${t.replace(/^#/, '')}`).join(' '), 'tags')}
              className="btn bg-white/5 text-white/60 hover:text-white hover:bg-white/10 text-xs py-2 px-3"
            >
              {copiedField === 'tags' ? <><Check size={14} className="text-emerald-400" /> Copied!</> : <><Copy size={14} /> Copy Tags</>}
            </button>
          )}
        </div>
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, i) => (
              <span
                key={i}
                className="px-3 py-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full text-xs font-bold hover:bg-purple-500/20 transition-colors cursor-default"
              >
                #{tag.replace(/^#/, '')}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-white/20 text-sm font-medium">
            {isGenerating ? 'Generating tags...' : 'Tags will appear here after generation.'}
          </p>
        )}
      </div>

      {/* Preview Card */}
      {title && (
        <div className="glass-card p-6 border-red-500/20">
          <div className="flex items-center gap-3 text-white/40 text-xs font-black uppercase tracking-widest mb-6">
            <Youtube size={14} /> YouTube Preview
          </div>

          {/* Simulated YouTube card */}
          <div className="bg-[#0f0f0f] rounded-2xl overflow-hidden border border-white/5">
            {/* Video thumbnail area */}
            <div className="aspect-video bg-gradient-to-br from-gray-900 to-black flex items-center justify-center relative">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="text-center z-10">
                <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-[0_0_30px_rgba(239,68,68,0.5)]">
                  <div className="w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[18px] border-l-white ml-1" />
                </div>
                <p className="text-white/30 text-xs font-bold">Your Recap Video</p>
              </div>
            </div>

            {/* Title and info */}
            <div className="p-5">
              <h3 className="text-white font-black text-lg leading-snug mb-3">
                {title}
                {tags.length > 0 && (
                  <span className="text-[#3ea6ff]">
                    {tags.slice(0, 3).map(t => ` #${t.replace(/^#/, '')}`)}
                  </span>
                )}
              </h3>

              {/* Channel info */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white text-xs font-black">AR</div>
                <div>
                  <p className="text-white/90 text-sm font-bold">Anime Recap</p>
                  <p className="text-white/40 text-xs">subscriber</p>
                </div>
                <button className="ml-auto bg-white text-black text-xs font-black px-4 py-2 rounded-full">Subscribe</button>
              </div>

              {/* Description preview */}
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-white/50 text-xs mb-2 font-bold">views • Just now</p>
                <p className="text-white/80 text-xs leading-relaxed whitespace-pre-line line-clamp-4">{description}</p>
                {tags.length > 0 && (
                  <p className="text-[#3ea6ff] text-xs mt-3 font-medium">
                    {tags.map(t => `#${t.replace(/^#/, '')}`).join(' ')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
