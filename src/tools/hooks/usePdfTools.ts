'use client';

import { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import type { ToolProgress, FileItem } from '../types';

interface PDFFile extends FileItem {
  pageCount?: number;
  pages?: Uint8Array[];
}

export function usePdfMerge() {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [progress, setProgress] = useState<ToolProgress>({
    percent: 0,
    stage: '',
    isProcessing: false,
  });
  const [mergedPdf, setMergedPdf] = useState<{ blob: Blob; url: string } | null>(null);

  const addFiles = useCallback(async (newFiles: File[]) => {
    setProgress({ percent: 0, stage: 'Lade PDFs...', isProcessing: true });

    const items: PDFFile[] = [];
    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      const percent = Math.round(((i + 1) / newFiles.length) * 50);
      setProgress({ percent, stage: `Lade ${file.name}...`, isProcessing: true });

      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        items.push({
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          pageCount: pdfDoc.getPageCount(),
        });
      } catch (error) {
        console.error(`Failed to load ${file.name}:`, error);
      }
    }

    setFiles((prev) => [...prev, ...items]);
    setProgress({ percent: 0, stage: '', isProcessing: false });
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setMergedPdf(null);
  }, []);

  const reorderFiles = useCallback((fromIndex: number, toIndex: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      const [removed] = newFiles.splice(fromIndex, 1);
      newFiles.splice(toIndex, 0, removed);
      return newFiles;
    });
    setMergedPdf(null);
  }, []);

  const merge = useCallback(async () => {
    if (files.length < 2) return;

    setProgress({ percent: 0, stage: 'Zusammenfügen...', isProcessing: true });

    try {
      const mergedDoc = await PDFDocument.create();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const percent = Math.round(((i + 1) / files.length) * 100);
        setProgress({ percent, stage: `Füge ${file.file.name} hinzu...`, isProcessing: true });

        const arrayBuffer = await file.file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pages = await mergedDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
        pages.forEach((page) => mergedDoc.addPage(page));
      }

      const pdfBytes = await mergedDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      setMergedPdf({ blob, url });
      setProgress({ percent: 100, stage: 'Fertig!', isProcessing: false });

      return { blob, url };
    } catch (error) {
      console.error('Merge failed:', error);
      setProgress({ percent: 0, stage: 'Fehler beim Zusammenfügen', isProcessing: false });
      return null;
    }
  }, [files]);

  const reset = useCallback(() => {
    if (mergedPdf?.url) URL.revokeObjectURL(mergedPdf.url);
    setFiles([]);
    setMergedPdf(null);
    setProgress({ percent: 0, stage: '', isProcessing: false });
  }, [mergedPdf]);

  return {
    files,
    progress,
    mergedPdf,
    addFiles,
    removeFile,
    reorderFiles,
    merge,
    reset,
  };
}

export function usePdfSplit() {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [progress, setProgress] = useState<ToolProgress>({
    percent: 0,
    stage: '',
    isProcessing: false,
  });
  const [splitPdfs, setSplitPdfs] = useState<{ blob: Blob; url: string; pageNumber: number }[]>([]);

  const loadFile = useCallback(async (newFile: File) => {
    setProgress({ percent: 0, stage: 'Lade PDF...', isProcessing: true });

    try {
      const arrayBuffer = await newFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      setFile({
        id: `${newFile.name}-${Date.now()}`,
        file: newFile,
        pageCount: pdfDoc.getPageCount(),
      });
      setSplitPdfs([]);
      setProgress({ percent: 100, stage: 'Bereit', isProcessing: false });
    } catch (error) {
      console.error('Failed to load PDF:', error);
      setProgress({ percent: 0, stage: 'Fehler beim Laden', isProcessing: false });
    }
  }, []);

  const split = useCallback(async (pageRanges: string) => {
    if (!file) return;

    setProgress({ percent: 0, stage: 'Teile PDF...', isProcessing: true });

    try {
      const arrayBuffer = await file.file.arrayBuffer();
      const originalPdf = await PDFDocument.load(arrayBuffer);
      const totalPages = originalPdf.getPageCount();

      // Parse page ranges (e.g., "1-3, 5, 7-10")
      const pagesToExtract: number[] = [];
      const ranges = pageRanges.split(',');
      
      for (const range of ranges) {
        const trimmed = range.trim();
        if (trimmed.includes('-')) {
          const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()));
          for (let i = start; i <= end; i++) {
            if (i > 0 && i <= totalPages) pagesToExtract.push(i - 1);
          }
        } else {
          const pageNum = parseInt(trimmed);
          if (pageNum > 0 && pageNum <= totalPages) pagesToExtract.push(pageNum - 1);
        }
      }

      // Split into individual PDFs
      const results: { blob: Blob; url: string; pageNumber: number }[] = [];
      
      for (let i = 0; i < pagesToExtract.length; i++) {
        const pageIndex = pagesToExtract[i];
        const percent = Math.round(((i + 1) / pagesToExtract.length) * 100);
        setProgress({ percent, stage: `Extrahiere Seite ${pageIndex + 1}...`, isProcessing: true });

        const newPdf = await PDFDocument.create();
        const [page] = await newPdf.copyPages(originalPdf, [pageIndex]);
        newPdf.addPage(page);

        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        results.push({
          blob,
          url: URL.createObjectURL(blob),
          pageNumber: pageIndex + 1,
        });
      }

      setSplitPdfs(results);
      setProgress({ percent: 100, stage: 'Fertig!', isProcessing: false });
      return results;
    } catch (error) {
      console.error('Split failed:', error);
      setProgress({ percent: 0, stage: 'Fehler beim Teilen', isProcessing: false });
      return null;
    }
  }, [file]);

  const splitAll = useCallback(async () => {
    if (!file) return;
    await split(`1-${file.pageCount}`);
  }, [file, split]);

  const reset = useCallback(() => {
    splitPdfs.forEach(pdf => URL.revokeObjectURL(pdf.url));
    setFile(null);
    setSplitPdfs([]);
    setProgress({ percent: 0, stage: '', isProcessing: false });
  }, [splitPdfs]);

  return {
    file,
    progress,
    splitPdfs,
    loadFile,
    split,
    splitAll,
    reset,
  };
}
