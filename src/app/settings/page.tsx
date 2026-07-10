'use client';

import React, { useState, useEffect } from 'react';
import { useSettingsStore, LLMProvider, STTProvider, TTSProvider } from '@/stores/useSettingsStore';
import { Key, Video, Mic, Brain, Eye, EyeOff, Save, Trash2, CheckCircle2, Cpu } from 'lucide-react';

export default function SettingsPage() {
  const settings = useSettingsStore();
  const [mounted, setMounted] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null; // Avoid hydration mismatch

  const toggleShowKey = (key: string) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  const KeyInput = ({ 
    label, 
    valueKey, 
    placeholder, 
    icon 
  }: { 
    label: string, 
    valueKey: keyof typeof settings, 
    placeholder: string,
    icon: React.ReactNode 
  }) => (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-bold text-white/80 flex items-center gap-2 tracking-wide">
        {icon} {label}
      </label>
      <div className="relative group">
        <input
          type={showKeys[valueKey] ? "text" : "password"}
          value={settings[valueKey as keyof typeof settings] as string}
          onChange={(e) => settings.setApiKey(valueKey as any, e.target.value)}
          placeholder={placeholder}
          className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 transition-all font-mono text-sm placeholder:text-white/20 group-hover:border-white/20"
        />
        <button
          onClick={() => toggleShowKey(valueKey)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-cyan-400 transition-colors p-2 bg-white/5 rounded-lg hover:bg-cyan-400/10"
        >
          {showKeys[valueKey] ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-10 pb-20 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-white font-heading tracking-tight drop-shadow-lg">Settings</h1>
          <p className="text-white/60 text-lg mt-2 font-medium">Configure your API keys and project preferences.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={settings.clearAllKeys}
            className="btn bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]"
          >
            <Trash2 size={18} /> Clear Keys
          </button>
          <button 
            onClick={handleSave}
            className="btn btn-primary"
          >
            <Save size={18} /> Save Settings
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: API Keys */}
        <div className="flex flex-col gap-8">
          <div className="glass-card flex flex-col gap-8">
            <div className="flex items-center gap-4 border-b border-white/10 pb-5">
              <div className="p-3 bg-cyan-500/20 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.3)]"><Key size={24} className="text-cyan-400" /></div>
              <h2 className="text-2xl font-bold tracking-tight">API Keys</h2>
            </div>
            
            <p className="text-sm font-medium text-white/50 bg-black/40 p-4 rounded-xl border border-white/5 flex items-center gap-3">
              <span className="text-2xl">🔒</span>
              Keys are stored securely in your browser's localStorage. They are never saved to our servers.
            </p>

            <div className="flex flex-col gap-6">
              <KeyInput label="OpenAI API Key" valueKey="openaiKey" placeholder="sk-proj-..." icon={<Brain size={18}/>} />
              <KeyInput label="Anthropic (Claude) API Key" valueKey="claudeKey" placeholder="sk-ant-..." icon={<Brain size={18}/>} />
              <KeyInput label="Groq API Key (Fast Whisper STT)" valueKey="groqKey" placeholder="gsk_..." icon={<Mic size={18}/>} />
              <KeyInput label="ElevenLabs API Key" valueKey="elevenLabsKey" placeholder="sk_..." icon={<Mic size={18}/>} />
            </div>
          </div>
        </div>

        {/* Right Column: Preferences */}
        <div className="flex flex-col gap-8">
          <div className="glass-card flex flex-col gap-8">
            <div className="flex items-center gap-4 border-b border-white/10 pb-5">
              <div className="p-3 bg-purple-500/20 rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.3)]"><Brain size={24} className="text-purple-400" /></div>
              <h2 className="text-2xl font-bold tracking-tight">AI Providers</h2>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-sm font-bold text-white/80 tracking-wide">Storytelling LLM</label>
              <div className="flex bg-black/50 p-1.5 rounded-2xl border border-white/10 shadow-inner gap-1">
                {([
                  { value: 'openai', label: 'OpenAI', icon: <Brain size={14} /> },
                  { value: 'claude', label: 'Claude', icon: <Brain size={14} /> },
                  { value: 'ollama', label: 'Ollama', icon: <Cpu size={14} /> },
                ] as { value: LLMProvider; label: string; icon: React.ReactNode }[]).map(({ value, label, icon }) => (
                  <button
                    key={value}
                    onClick={() => settings.setPreference('llmProvider', value)}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-bold capitalize transition-all duration-300 flex items-center justify-center gap-1.5 ${
                      settings.llmProvider === value
                        ? value === 'ollama'
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_4px_15px_rgba(16,185,129,0.35)]'
                          : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-[0_4px_15px_rgba(236,72,153,0.3)]'
                        : 'text-white/50 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>

              {/* Ollama Config — only shown when ollama is selected */}
              {settings.llmProvider === 'ollama' && (
                <div className="mt-1 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-widest">
                    <Cpu size={14} /> Local LLM — No API key needed
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-white/60 tracking-wide">Model Name</label>
                    <input
                      type="text"
                      value={settings.ollamaModel}
                      onChange={(e) => settings.setPreference('ollamaModel', e.target.value)}
                      placeholder="qwen2.5:14b"
                      className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-all placeholder:text-white/20"
                    />
                    <p className="text-xs text-white/35">Run <code className="bg-white/10 px-1.5 py-0.5 rounded text-emerald-400 font-mono">ollama pull {settings.ollamaModel}</code> to download this model</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-white/60 tracking-wide">Ollama Base URL</label>
                    <input
                      type="text"
                      value={settings.ollamaBaseUrl}
                      onChange={(e) => settings.setPreference('ollamaBaseUrl', e.target.value)}
                      placeholder="http://localhost:11434"
                      className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-all placeholder:text-white/20"
                    />
                    <p className="text-xs text-white/35">Default: <code className="bg-white/10 px-1.5 py-0.5 rounded text-white/50 font-mono">http://localhost:11434</code>. Start Ollama with <code className="bg-white/10 px-1.5 py-0.5 rounded text-emerald-400 font-mono">ollama serve</code></p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-sm font-bold text-white/80 tracking-wide">Transcription (STT)</label>
              <div className="flex bg-black/50 p-1.5 rounded-2xl border border-white/10 shadow-inner">
                {(['whisper', 'groq'] as STTProvider[]).map(provider => (
                  <button
                    key={provider}
                    onClick={() => settings.setPreference('sttProvider', provider)}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold capitalize transition-all duration-300 ${
                      settings.sttProvider === provider 
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-[0_4px_15px_rgba(6,182,212,0.3)]' 
                        : 'text-white/50 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {provider}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-sm font-bold text-white/80 tracking-wide">Voiceover (TTS)</label>
              <div className="flex bg-black/50 p-1.5 rounded-2xl border border-white/10 shadow-inner">
                {(['edge', 'elevenlabs', 'google', 'openai'] as TTSProvider[]).map(provider => (
                  <button
                    key={provider}
                    onClick={() => settings.setPreference('ttsProvider', provider)}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold capitalize transition-all duration-300 ${
                      settings.ttsProvider === provider 
                        ? 'bg-white text-black shadow-[0_4px_15px_rgba(255,255,255,0.2)]' 
                        : 'text-white/50 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {provider}
                  </button>
                ))}
              </div>

              {settings.ttsProvider === 'elevenlabs' && (
                <div className="flex flex-col gap-2 mt-2">
                  <label className="text-xs font-bold text-white/60 tracking-wide">ElevenLabs Voice ID</label>
                  <input
                    type="text"
                    value={settings.elevenLabsVoiceId}
                    onChange={(e) => settings.setPreference('elevenLabsVoiceId', e.target.value)}
                    placeholder="pNInz6obpgDQGcFmaJgB"
                    className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-white focus:ring-2 focus:ring-white/20 transition-all placeholder:text-white/20"
                  />
                  <p className="text-xs text-white/35">
                    Copy the Voice ID from your ElevenLabs Voice Library. Default is Adam (<code className="bg-white/10 px-1 rounded">pNInz6obpgDQGcFmaJgB</code>).
                  </p>
                </div>
              )}

              {settings.ttsProvider === 'openai' && (
                <div className="flex flex-col gap-2 mt-2 p-4 bg-purple-500/5 border border-purple-500/20 rounded-2xl">
                  <div className="flex items-center gap-2 text-purple-400 text-xs font-black uppercase tracking-widest mb-1">
                    <Mic size={14} /> OpenAI TTS
                  </div>
                  <label className="text-xs font-bold text-white/60 tracking-wide">Voice</label>
                  <select
                    value={settings.openaiVoiceId}
                    onChange={(e) => settings.setPreference('openaiVoiceId', e.target.value)}
                    className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-white focus:ring-2 focus:ring-white/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="onyx">Onyx (Deep Male)</option>
                    <option value="echo">Echo (Male)</option>
                    <option value="fable">Fable (Male / British)</option>
                    <option value="alloy">Alloy (Neutral)</option>
                    <option value="nova">Nova (Female)</option>
                    <option value="shimmer">Shimmer (Female)</option>
                  </select>
                  <p className="text-xs text-white/35">OpenAI TTS costs around $15 per 1M characters. It has excellent, cheap male voices.</p>
                </div>
              )}

              {settings.ttsProvider === 'edge' && (
                <div className="flex flex-col gap-2 mt-2 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-widest mb-1">
                    <Mic size={14} /> Edge TTS (100% Free)
                  </div>
                  <label className="text-xs font-bold text-white/60 tracking-wide">Voice</label>
                  <select
                    value={settings.edgeVoiceId}
                    onChange={(e) => settings.setPreference('edgeVoiceId', e.target.value)}
                    className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-white focus:ring-2 focus:ring-white/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="en-US-ChristopherNeural">Christopher (US Male - Deep)</option>
                    <option value="en-US-GuyNeural">Guy (US Male)</option>
                    <option value="en-US-EricNeural">Eric (US Male)</option>
                    <option value="en-GB-RyanNeural">Ryan (UK Male)</option>
                    <option value="en-AU-WilliamNeural">William (AU Male)</option>
                    <option value="en-US-AriaNeural">Aria (US Female)</option>
                    <option value="en-US-JennyNeural">Jenny (US Female)</option>
                  </select>
                  <p className="text-xs text-white/35">Microsoft Edge TTS is completely free, has no character limits, requires no API key, and has amazing male voices.</p>
                </div>
              )}
            </div>
          </div>

          <div className="glass-card flex flex-col gap-8">
            <div className="flex items-center gap-4 border-b border-white/10 pb-5">
              <div className="p-3 bg-pink-500/20 rounded-xl shadow-[0_0_15px_rgba(236,72,153,0.3)]"><Video size={24} className="text-pink-400" /></div>
              <h2 className="text-2xl font-bold tracking-tight">Video Settings</h2>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-sm font-bold text-white/80 tracking-wide">Output Format</label>
              <div className="flex bg-black/50 p-1.5 rounded-2xl border border-white/10 shadow-inner">
                {(['16:9', '9:16', '1:1'] as const).map(format => (
                  <button
                    key={format}
                    onClick={() => settings.setPreference('outputFormat', format)}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-300 ${
                      settings.outputFormat === format 
                        ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-[0_4px_15px_rgba(244,63,94,0.3)]' 
                        : 'text-white/50 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {format}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-white/80 tracking-wide">Default Auto-Zoom</label>
                <div className="bg-cyan-500/20 px-3 py-1 rounded-lg border border-cyan-500/30">
                  <span className="text-cyan-400 font-bold text-sm">{settings.autoZoomPercent}%</span>
                </div>
              </div>
              <input 
                type="range" 
                min="0" max="30" step="1"
                value={settings.autoZoomPercent}
                onChange={(e) => settings.setPreference('autoZoomPercent', parseInt(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-colors"
              />
              <p className="text-sm font-medium text-white/40">Useful for cropping out existing hardcoded subtitles.</p>
            </div>
          </div>
        </div>

      </div>

      {/* Floating Toast Notification */}
      {savedToast && (
        <div className="fixed bottom-10 right-10 bg-gradient-to-r from-emerald-500 to-emerald-400 text-black px-6 py-4 rounded-2xl shadow-[0_10px_30px_rgba(16,185,129,0.3)] flex items-center gap-3 animate-bounce border border-emerald-300 backdrop-blur-md z-50">
          <CheckCircle2 size={24} />
          <span className="font-bold text-lg">Settings saved successfully!</span>
        </div>
      )}
    </div>
  );
}
