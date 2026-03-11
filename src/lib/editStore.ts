import { create } from 'zustand';
import type { DetectedFile, ExportFormat } from '@/lib/fileDetector';

export interface EditState {
  // Step 1: Upload
  file: File | null;
  detectedFile: DetectedFile | null;
  preview: string | null;
  
  // Step 2: Edit
  activeEdits: Record<string, unknown>;
  editHistory: Record<string, unknown>[];
  currentHistoryIndex: number;
  
  // Step 3: Export
  selectedFormat: ExportFormat | null;
  processedBlob: Blob | null;
  processedUrl: string | null;
  
  // Progress
  isProcessing: boolean;
  progress: number;
  progressMessage: string;
}

export interface EditActions {
  // Step 1
  setFile: (file: File, detected: DetectedFile, preview: string | null) => void;
  
  // Step 2
  updateEdit: (key: string, value: unknown) => void;
  applyEdits: (blob: Blob, url: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  
  // Step 3
  setExportFormat: (format: ExportFormat) => void;
  setProcessedFile: (blob: Blob, url: string) => void;
  
  // Progress
  setProgress: (percent: number, message: string) => void;
  setIsProcessing: (processing: boolean) => void;
  
  // Reset
  reset: () => void;
}

const initialState: EditState = {
  file: null,
  detectedFile: null,
  preview: null,
  activeEdits: {},
  editHistory: [],
  currentHistoryIndex: -1,
  selectedFormat: null,
  processedBlob: null,
  processedUrl: null,
  isProcessing: false,
  progress: 0,
  progressMessage: '',
};

export const useEditStore = create<EditState & EditActions>((set, get) => ({
  ...initialState,

  setFile: (file, detectedFile, preview) => {
    // Clean up previous preview URL
    const prev = get().preview;
    if (prev?.startsWith('blob:')) {
      URL.revokeObjectURL(prev);
    }
    
    set({
      file,
      detectedFile,
      preview,
      activeEdits: {},
      editHistory: [],
      currentHistoryIndex: -1,
      selectedFormat: detectedFile.exportFormats[0] || null,
      processedBlob: null,
      processedUrl: null,
    });
  },

  updateEdit: (key, value) => {
    set(state => ({
      activeEdits: { ...state.activeEdits, [key]: value },
    }));
  },

  applyEdits: (blob, url) => {
    const { editHistory, currentHistoryIndex, activeEdits } = get();
    
    // Clean up previous processed URL
    const prevUrl = get().processedUrl;
    if (prevUrl) {
      URL.revokeObjectURL(prevUrl);
    }
    
    // Add to history
    const newHistory = editHistory.slice(0, currentHistoryIndex + 1);
    newHistory.push(activeEdits);
    
    set({
      processedBlob: blob,
      processedUrl: url,
      editHistory: newHistory,
      currentHistoryIndex: newHistory.length - 1,
    });
  },

  undo: () => {
    const { currentHistoryIndex, editHistory } = get();
    if (currentHistoryIndex > 0) {
      set({
        currentHistoryIndex: currentHistoryIndex - 1,
        activeEdits: editHistory[currentHistoryIndex - 1] || {},
      });
    }
  },

  redo: () => {
    const { currentHistoryIndex, editHistory } = get();
    if (currentHistoryIndex < editHistory.length - 1) {
      set({
        currentHistoryIndex: currentHistoryIndex + 1,
        activeEdits: editHistory[currentHistoryIndex + 1],
      });
    }
  },

  canUndo: () => get().currentHistoryIndex > 0,
  canRedo: () => get().currentHistoryIndex < get().editHistory.length - 1,

  setExportFormat: (format) => set({ selectedFormat: format }),

  setProcessedFile: (blob, url) => {
    // Clean up previous URL
    const prevUrl = get().processedUrl;
    if (prevUrl) {
      URL.revokeObjectURL(prevUrl);
    }
    set({ processedBlob: blob, processedUrl: url });
  },

  setProgress: (percent, message) => set({ progress: percent, progressMessage: message }),
  setIsProcessing: (isProcessing) => set({ isProcessing }),

  reset: () => {
    const prev = get().preview;
    if (prev?.startsWith('blob:')) {
      URL.revokeObjectURL(prev);
    }
    const prevUrl = get().processedUrl;
    if (prevUrl) {
      URL.revokeObjectURL(prevUrl);
    }
    set(initialState);
  },
}));
