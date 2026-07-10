import { create } from 'zustand';

interface EditorStore {
  mirror: boolean;
  colorGrade: boolean;
  contrast: number;
  saturation: number;
  warmth: number;
  zoom: number;
  panX: number;
  panY: number;
  blurBackground: boolean;
  fadeAudioVideo: boolean;

  isExporting: boolean;
  exportProgress: number;
  exportedFileId: string | null;

  setTransform: <K extends keyof EditorStore>(key: K, value: EditorStore[K]) => void;
  setExporting: (status: boolean) => void;
  setExportProgress: (progress: number) => void;
  setExportedFileId: (id: string | null) => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  mirror: false,
  colorGrade: false,
  contrast: 1.05,
  saturation: 1.1,
  warmth: 3,
  zoom: 1.0,
  panX: 50,
  panY: 50,
  blurBackground: false,
  fadeAudioVideo: false,

  isExporting: false,
  exportProgress: 0,
  exportedFileId: null,

  setTransform: (key, value) => set((state) => ({ ...state, [key]: value, exportedFileId: null })),
  setExporting: (status) => set({ isExporting: status }),
  setExportProgress: (progress) => set({ exportProgress: progress }),
  setExportedFileId: (id) => set({ exportedFileId: id }),
}));
