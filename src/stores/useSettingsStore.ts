import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type LLMProvider = 'openai' | 'claude' | 'ollama';
export type STTProvider = 'whisper' | 'groq';
export type TTSProvider = 'elevenlabs' | 'google' | 'openai' | 'edge';

export interface AppSettings {
  // API Keys (stored in localStorage only)
  openaiKey: string;
  claudeKey: string;
  elevenLabsKey: string;
  groqKey: string;

  // Provider preferences
  llmProvider: LLMProvider;
  sttProvider: STTProvider;
  ttsProvider: TTSProvider;
  elevenLabsVoiceId: string;
  openaiVoiceId: string;
  edgeVoiceId: string;

  // Ollama local LLM settings
  ollamaModel: string;     // e.g. "llama3.1:8b"
  ollamaBaseUrl: string;   // e.g. "http://localhost:11434"

  // Video preferences
  outputFormat: '16:9' | '9:16' | '1:1';
  autoZoomPercent: number; // 0-30%
}

interface SettingsStore extends AppSettings {
  setApiKey: (provider: keyof AppSettings, key: string) => void;
  setPreference: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  clearAllKeys: () => void;
}

const defaultSettings: AppSettings = {
  openaiKey: '',
  claudeKey: '',
  elevenLabsKey: '',
  groqKey: '',
  llmProvider: 'openai',
  sttProvider: 'groq',
  ttsProvider: 'edge',
  elevenLabsVoiceId: 'pNInz6obpgDQGcFmaJgB', // Adam by default
  openaiVoiceId: 'onyx', // Good male voice by default
  edgeVoiceId: 'en-US-ChristopherNeural', // Good male voice by default

  ollamaModel: 'qwen2.5:14b',
  ollamaBaseUrl: 'http://localhost:11434',
  outputFormat: '16:9',
  autoZoomPercent: 15,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setApiKey: (provider, key) => set((state) => ({ ...state, [provider]: key })),
      setPreference: (key, value) => set((state) => ({ ...state, [key]: value })),
      clearAllKeys: () => set((state) => ({
        ...state,
        openaiKey: '',
        claudeKey: '',
        elevenLabsKey: '',
        groqKey: '',
      })),
    }),
    {
      name: 'animerecap-settings',
    }
  )
);
