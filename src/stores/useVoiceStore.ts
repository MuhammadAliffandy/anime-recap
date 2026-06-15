import { create } from 'zustand';
import { Word } from './useVideoStore';

interface VoiceStore {
  ttsAudioUrl: string | null;
  syncedWords: Word[];
  subtitleStyle: string;

  isGeneratingTTS: boolean;
  isSyncingSubs: boolean;

  setTTSAudio: (url: string) => void;
  setSyncedWords: (words: Word[]) => void;
  setGeneratingTTS: (status: boolean) => void;
  setSyncingSubs: (status: boolean) => void;
}

export const useVoiceStore = create<VoiceStore>((set) => ({
  ttsAudioUrl: null,
  syncedWords: [],
  subtitleStyle: 'Default',

  isGeneratingTTS: false,
  isSyncingSubs: false,

  setTTSAudio: (url) => set({ ttsAudioUrl: url }),
  setSyncedWords: (words) => set({ syncedWords: words }),
  setGeneratingTTS: (status) => set({ isGeneratingTTS: status }),
  setSyncingSubs: (status) => set({ isSyncingSubs: status }),
}));
