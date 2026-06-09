import { create } from 'zustand';

export interface VideoFile {
  id: string; // The fileId returned from backend
  originalName: string;
  size: number;
  progress: number;
  status: 'uploading' | 'done' | 'error';
}

interface VideoStore {
  files: VideoFile[];
  mergedFileId: string | null;
  isMerging: boolean;
  mergeProgress: number;

  addFile: (file: VideoFile) => void;
  updateFile: (id: string, updates: Partial<VideoFile>) => void;
  removeFile: (id: string) => void;
  reorderFiles: (startIndex: number, endIndex: number) => void;
  
  setMerging: (isMerging: boolean) => void;
  setMergeProgress: (progress: number) => void;
  setMergedFileId: (id: string) => void;
  
  clearAll: () => void;
}

export const useVideoStore = create<VideoStore>((set) => ({
  files: [],
  mergedFileId: null,
  isMerging: false,
  mergeProgress: 0,

  addFile: (file) => set((state) => ({ files: [...state.files, file] })),
  
  updateFile: (id, updates) => set((state) => ({
    files: state.files.map(f => f.id === id ? { ...f, ...updates } : f)
  })),
  
  removeFile: (id) => set((state) => ({
    files: state.files.filter(f => f.id !== id)
  })),

  reorderFiles: (startIndex, endIndex) => set((state) => {
    const result = Array.from(state.files);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return { files: result };
  }),

  setMerging: (isMerging) => set({ isMerging }),
  setMergeProgress: (mergeProgress) => set({ mergeProgress }),
  setMergedFileId: (mergedFileId) => set({ mergedFileId }),

  clearAll: () => set({ files: [], mergedFileId: null, isMerging: false, mergeProgress: 0 }),
}));
