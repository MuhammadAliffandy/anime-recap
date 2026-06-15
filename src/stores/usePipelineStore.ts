import { create } from 'zustand';

interface PipelineStore {
  // Which episode is currently running a stage (globally)
  activeEpisodeId: string | null;
  isRunningAll: boolean;

  setActiveEpisodeId: (id: string | null) => void;
  setRunningAll: (val: boolean) => void;
}

export const usePipelineStore = create<PipelineStore>((set) => ({
  activeEpisodeId: null,
  isRunningAll: false,

  setActiveEpisodeId: (activeEpisodeId) => set({ activeEpisodeId }),
  setRunningAll: (isRunningAll) => set({ isRunningAll }),
}));
