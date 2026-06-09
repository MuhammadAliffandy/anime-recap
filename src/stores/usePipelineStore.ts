import { create } from 'zustand';

export interface Word {
  word: string;
  start: number;
  end: number;
}

interface PipelineStore {
  transcriptText: string;
  transcriptWords: Word[];
  generatedScript: string;
  
  isTranscribing: boolean;
  isGeneratingScript: boolean;

  setTranscript: (text: string, words: Word[]) => void;
  setScript: (script: string) => void;
  
  setTranscribing: (status: boolean) => void;
  setGeneratingScript: (status: boolean) => void;
}

export const usePipelineStore = create<PipelineStore>((set) => ({
  transcriptText: '',
  transcriptWords: [],
  generatedScript: '',
  
  isTranscribing: false,
  isGeneratingScript: false,

  setTranscript: (text, words) => set({ transcriptText: text, transcriptWords: words }),
  setScript: (script) => set({ generatedScript: script }),
  
  setTranscribing: (status) => set({ isTranscribing: status }),
  setGeneratingScript: (status) => set({ isGeneratingScript: status }),
}));
