import { create } from 'zustand';

export interface Word {
  word: string;
  start: number;
  end: number;
}

export interface SceneTimestamp {
  start: number;   // seconds into the source video
  end: number;
  narration: string;
}

export type PipelineStage = 'idle' | 'stripping' | 'transcribing' | 'scripting' | 'tts' | 'done' | 'error';

export interface Episode {
  id: string;                    // temp ID during upload, then becomes fileId
  episodeNumber: number;         // order (1-based), driven by drag & drop
  fileId: string;                // uploaded file ID from backend
  originalName: string;
  size: number;
  uploadStatus: 'uploading' | 'done' | 'error';
  uploadProgress: number;

  // Per-episode strip config
  openingDuration: number;       // seconds to cut from start (default 90)
  endingDuration: number;        // seconds to cut from end (default 90)
  isDetectingOped: boolean;      // true if currently running auto-detect API

  // Pipeline outputs
  strippedFileId?: string;       // after strip op/ed
  transcriptText?: string;
  transcriptWords?: Word[];
  script?: string;               // storytelling script for this episode
  sceneTimestamps?: SceneTimestamp[]; // semantic scene cuts from LLM
  audioFileId?: string;          // TTS audio file
  audioWords?: Word[];           // synced words for subtitles

  // Pipeline tracking
  pipelineStage: PipelineStage;
  pipelineError?: string;

  // UI state
  isAccordionOpen: boolean;
}

interface VideoStore {
  episodes: Episode[];
  animeTitle: string;
  animeSynopsis: string;

  // Prolog (generated after all episode scripts are ready)
  prologScript?: string;
  prologAudioFileId?: string;
  prologAudioWords?: Word[];

  // Final assembled video
  finalExportId?: string;
  finalWords?: Word[];
  isAssembling: boolean;

  // Episode actions
  addEpisode: (ep: Omit<Episode, 'episodeNumber' | 'pipelineStage' | 'isAccordionOpen' | 'openingDuration' | 'endingDuration' | 'isDetectingOped'>) => void;
  updateEpisode: (id: string, updates: Partial<Episode>) => void;
  removeEpisode: (id: string) => void;
  reorderEpisodes: (fromIndex: number, toIndex: number) => void;

  // Config actions
  setAnimeTitle: (title: string) => void;
  setAnimeSynopsis: (synopsis: string) => void;
  setEpisodeConfig: (id: string, openingDuration: number, endingDuration: number) => void;
  toggleAccordion: (id: string) => void;
  autoDetectOped: (id: string) => Promise<void>;

  // Prolog actions
  setPrologScript: (script: string) => void;
  setPrologAudio: (fileId: string, words: Word[]) => void;

  // Final assembly
  setFinalExportId: (id: string) => void;
  setFinalWords: (words: Word[]) => void;
  setAssembling: (val: boolean) => void;

  clearAll: () => void;
}

export const useVideoStore = create<VideoStore>((set) => ({
  episodes: [],
  animeTitle: '',
  animeSynopsis: '',
  isAssembling: false,

  addEpisode: (ep) =>
    set((state) => {
      const episodeNumber = state.episodes.length + 1;
      return {
        episodes: [
          ...state.episodes,
          {
            ...ep,
            episodeNumber,
            openingDuration: 90,
            endingDuration: 90,
            isDetectingOped: false,
            pipelineStage: 'idle',
            isAccordionOpen: false,
          },
        ],
      };
    }),

  updateEpisode: (id, updates) =>
    set((state) => ({
      episodes: state.episodes.map((ep) =>
        ep.id === id ? { ...ep, ...updates } : ep
      ),
    })),

  removeEpisode: (id) =>
    set((state) => {
      const filtered = state.episodes.filter((ep) => ep.id !== id);
      // Re-number remaining episodes
      return {
        episodes: filtered.map((ep, i) => ({ ...ep, episodeNumber: i + 1 })),
      };
    }),

  reorderEpisodes: (fromIndex, toIndex) =>
    set((state) => {
      const result = Array.from(state.episodes);
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      // Re-number
      return {
        episodes: result.map((ep, i) => ({ ...ep, episodeNumber: i + 1 })),
      };
    }),

  setAnimeTitle: (animeTitle) => set({ animeTitle }),
  setAnimeSynopsis: (animeSynopsis) => set({ animeSynopsis }),

  setEpisodeConfig: (id, openingDuration, endingDuration) =>
    set((state) => ({
      episodes: state.episodes.map((ep) =>
        ep.id === id ? { ...ep, openingDuration, endingDuration } : ep
      ),
    })),

  toggleAccordion: (id) =>
    set((state) => ({
      episodes: state.episodes.map((ep) =>
        ep.id === id ? { ...ep, isAccordionOpen: !ep.isAccordionOpen } : ep
      ),
    })),

  autoDetectOped: async (id) => {
    // Optimistic update: set detecting state
    set((state) => ({
      episodes: state.episodes.map((ep) =>
        ep.id === id ? { ...ep, isDetectingOped: true } : ep
      ),
    }));

    try {
      const state = useVideoStore.getState();
      const ep = state.episodes.find((e) => e.id === id);
      if (!ep || !ep.fileId) throw new Error('Episode not found');

      const res = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: ep.fileId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Detection failed');
      }

      const data = await res.json();

      set((state) => ({
        episodes: state.episodes.map((e) =>
          e.id === id
            ? {
                ...e,
                isDetectingOped: false,
                openingDuration: data.openingDuration,
                endingDuration: data.endingDuration,
              }
            : e
        ),
      }));
    } catch (err: any) {
      console.error(err);
      // Reset detecting state on error, leave durations as they were
      set((state) => ({
        episodes: state.episodes.map((e) =>
          e.id === id ? { ...e, isDetectingOped: false } : e
        ),
      }));
    }
  },

  setPrologScript: (prologScript) => set({ prologScript }),

  setPrologAudio: (prologAudioFileId, prologAudioWords) =>
    set({ prologAudioFileId, prologAudioWords }),

  setFinalExportId: (finalExportId) => set({ finalExportId }),
  setFinalWords: (finalWords) => set({ finalWords }),
  setAssembling: (isAssembling) => set({ isAssembling }),

  clearAll: () =>
    set({
      episodes: [],
      animeTitle: '',
      animeSynopsis: '',
      prologScript: undefined,
      prologAudioFileId: undefined,
      prologAudioWords: undefined,
      finalExportId: undefined,
      finalWords: undefined,
      isAssembling: false,
    }),
}));
