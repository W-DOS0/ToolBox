'use client';

import { useState, useCallback } from 'react';
import type { ToolProgress, FileItem } from '../types';

interface UseImageCompressorOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  outputFormat?: 'image/jpeg' | 'image/png' | 'image/webp';
}

interface CompressedImage extends FileItem {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  width: number;
  height: number;
}

export function useImageCompressor() {
  const [files, setFiles] = useState<CompressedImage[]>([]);
  const [progress, setProgress] = useState<ToolProgress>({
    percent: 0,
    stage: '',
    isProcessing: false,
  });

  const addFiles = useCallback((newFiles: File[]) => {
    const items: CompressedImage[] = newFiles.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      preview: URL.createObjectURL(file),
      originalSize: file.size,
      compressedSize: 0,
      compressionRatio: 0,
      width: 0,
      height: 0,
    }));
    setFiles((prev) => [...prev, ...items]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      if (file?.processedUrl) URL.revokeObjectURL(file.processedUrl);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const compress = useCallback(async (options: UseImageCompressorOptions = {}) => {
    const {
      quality = 0.8,
      maxWidth = 1920,
      maxHeight = 1080,
      outputFormat = 'image/jpeg',
    } = options;

    setProgress({ percent: 0, stage: 'Vorbereitung...', isProcessing: true });

    const results: CompressedImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const percent = Math.round(((i + 1) / files.length) * 100);
      
      setProgress({ 
        percent: Math.round(percent * 0.9), 
        stage: `Komprimiere ${file.file.name}...`,
        isProcessing: true 
      });

      try {
        const result = await compressImage(file.file, {
          quality,
          maxWidth,
          maxHeight,
          outputFormat,
        });

        results.push({
          ...file,
          processed: result.blob,
          processedUrl: result.url,
          compressedSize: result.blob.size,
          compressionRatio: (1 - result.blob.size / file.originalSize) * 100,
          width: result.width,
          height: result.height,
        });
      } catch (error) {
        console.error(`Failed to compress ${file.file.name}:`, error);
      }
    }

    setFiles(results);
    setProgress({ percent: 100, stage: 'Fertig!', isProcessing: false });

    return results;
  }, [files]);

  const reset = useCallback(() => {
    files.forEach((file) => {
      if (file.preview) URL.revokeObjectURL(file.preview);
      if (file.processedUrl) URL.revokeObjectURL(file.processedUrl);
    });
    setFiles([]);
    setProgress({ percent: 0, stage: '', isProcessing: false });
  }, [files]);

  return {
    files,
    progress,
    addFiles,
    removeFile,
    compress,
    reset,
  };
}

async function compressImage(
  file: File,
  options: {
    quality: number;
    maxWidth: number;
    maxHeight: number;
    outputFormat: 'image/jpeg' | 'image/png' | 'image/webp';
  }
): Promise<{ blob: Blob; url: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      const aspectRatio = width / height;

      if (width > options.maxWidth) {
        width = options.maxWidth;
        height = width / aspectRatio;
      }
      if (height > options.maxHeight) {
        height = options.maxHeight;
        width = height * aspectRatio;
      }

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Draw image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({
              blob,
              url: URL.createObjectURL(blob),
              width: canvas.width,
              height: canvas.height,
            });
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        options.outputFormat,
        options.quality
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}
