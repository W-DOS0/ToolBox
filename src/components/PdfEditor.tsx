'use client';

import { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  GripVertical,
  Pencil,
  Eraser,
  Undo2,
  Redo2,
  Check,
  X,
  Loader2,
  Plus,
  FileUp,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface PdfAnnotation {
  id: string;
  type: 'draw' | 'erase';
  points: { x: number; y: number }[];
  color: string;
  lineWidth: number;
}

export interface PageState {
  annotations: PdfAnnotation[];
  history: PdfAnnotation[][];
  historyIndex: number;
}

export interface PdfEditorRef {
  getPdfBytes: () => Promise<Uint8Array | null>;
}

interface PdfPage {
  id: string;
  file: File;
  pageIndex: number;
}

interface PdfEditorProps {
  initialFile: File;
  language?: string;
  onPagesChange?: (pages: PdfPage[]) => void;
  initialPageStates?: Map<string, PageState>;
  onPageStatesChange?: (states: Map<string, PageState>) => void;
}

// Translations
const translations: Record<string, Record<string, string>> = {
  en: {
    page: 'Page',
    of: 'of',
    draw: 'Draw',
    erase: 'Eraser',
    undo: 'Undo',
    redo: 'Redo',
    done: 'Done',
    delete: 'Delete Page',
    noPages: 'No pages remaining',
    loading: 'Loading PDF...',
    dropPdf: 'Drop PDF here to add pages',
    addPdf: 'Add PDF',
    addPdfTitle: 'Add PDF Pages',
    dropOrClick: 'Drag & drop a PDF file here or click to select',
    onlyPdf: 'Only PDF files are supported',
    addPages: 'Add Pages',
  },
  de: {
    page: 'Seite',
    of: 'von',
    draw: 'Zeichnen',
    erase: 'Radieren',
    undo: 'Rückgängig',
    redo: 'Wiederholen',
    done: 'Fertig',
    delete: 'Seite löschen',
    noPages: 'Keine Seiten vorhanden',
    loading: 'Lade PDF...',
    dropPdf: 'PDF hier ablegen um Seiten hinzuzufügen',
    addPdf: 'PDF hinzufügen',
    addPdfTitle: 'PDF-Seiten hinzufügen',
    dropOrClick: 'PDF-Datei hierher ziehen oder klicken zum Auswählen',
    onlyPdf: 'Nur PDF-Dateien werden unterstützt',
    addPages: 'Seiten hinzufügen',
  },
};

// Get PDF.js library dynamically
async function getPdfjsLib() {
  if (typeof window === 'undefined') return null;
  
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  return pdfjsLib;
}

// Sortable page item component
function SortablePageItem({ 
  page, 
  index, 
  isSelected, 
  onSelect, 
  onDelete,
  thumbnail,
}: { 
  page: PdfPage; 
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  thumbnail: string | null;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group bg-card border rounded-lg overflow-hidden cursor-pointer transition-all",
        isSelected && "ring-2 ring-primary",
        isDragging && "opacity-50 shadow-lg"
      )}
      onClick={onSelect}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 z-10 p-1 bg-background/80 rounded opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      
      {/* Delete Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-1 right-1 z-10 p-1 bg-destructive/80 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive transition-colors"
      >
        <Trash2 className="h-4 w-4 text-white" />
      </button>
      
      {/* Thumbnail */}
      <div className="w-20 h-28 bg-muted flex items-center justify-center">
        {thumbnail ? (
          <img src={thumbnail} alt={`Page ${index + 1}`} className="w-full h-full object-contain" />
        ) : (
          <div className="text-muted-foreground text-xs">{index + 1}</div>
        )}
      </div>
      
      {/* Page Number */}
      <div className="absolute bottom-0 left-0 right-0 bg-background/80 text-center py-0.5 text-xs">
        {index + 1}
      </div>
    </div>
  );
}

export default forwardRef<PdfEditorRef, PdfEditorProps>(function PdfEditor(
  { initialFile, language = 'en', onPagesChange, initialPageStates, onPageStatesChange },
  ref
) {
  const t = (key: string) => translations[language]?.[key] || translations.en[key] || key;

  // State
  const [pages, setPages] = useState<PdfPage[]>([]);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotationTool, setAnnotationTool] = useState<'draw' | 'erase'>('draw');
  const [annotationColor, setAnnotationColor] = useState('#ff0000');
  const [annotationLineWidth, setAnnotationLineWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddPdfModal, setShowAddPdfModal] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  
  // Page states (annotations + history)
  const [pageStates, setPageStates] = useState<Map<string, PageState>>(
    initialPageStates || new Map()
  );
  
  // Thumbnails
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<any>(null);
  const pdfArrayBufferRef = useRef<ArrayBuffer | null>(null);
  const renderTaskRef = useRef<any>(null);
  const canvasWidthRef = useRef(0);
  const canvasHeightRef = useRef(0);
  const pagesRef = useRef<PdfPage[]>(pages);
  const pageStatesRef = useRef(pageStates);
  const prevPagesRef = useRef<string>('');

  // Keep refs in sync
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  useEffect(() => {
    pageStatesRef.current = pageStates;
    onPageStatesChange?.(pageStates);
  }, [pageStates, onPageStatesChange]);

  // Sync pages changes to parent - only when pages actually change
  useEffect(() => {
    if (pages.length > 0) {
      const pagesKey = pages.map(p => p.id).join(',');
      if (prevPagesRef.current !== pagesKey) {
        prevPagesRef.current = pagesKey;
        onPagesChange?.(pages);
      }
    }
  }, [pages]); // Intentionally exclude onPagesChange to prevent infinite loops

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load PDF file
  const loadPdf = useCallback(async (file: File) => {
    const lib = await getPdfjsLib();
    if (!lib) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      // Create a copy of the ArrayBuffer for pdf-lib (since PDF.js detaches it)
      const arrayBufferCopy = arrayBuffer.slice(0);
      pdfArrayBufferRef.current = arrayBufferCopy;
      const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
      pdfDocRef.current = pdf;

      const newPages: PdfPage[] = [];
      const newThumbnails = new Map<string, string>();
      const newPageStates = new Map(pageStatesRef.current);

      for (let i = 0; i < pdf.numPages; i++) {
        const pageId = `${file.name}-${i}`;
        newPages.push({
          id: pageId,
          file,
          pageIndex: i,
        });

        // Initialize page state if not exists
        if (!newPageStates.has(pageId)) {
          newPageStates.set(pageId, {
            annotations: [],
            history: [[]],
            historyIndex: 0,
          });
        }

        // Generate thumbnail
        const page = await pdf.getPage(i + 1);
        const viewport = page.getViewport({ scale: 0.3 });
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = viewport.width;
        thumbCanvas.height = viewport.height;
        const ctx = thumbCanvas.getContext('2d');
        if (ctx) {
          await (page as any).render({
            canvasContext: ctx,
            viewport: viewport,
          }).promise;
          newThumbnails.set(pageId, thumbCanvas.toDataURL());
        }
      }

      setPages(newPages);
      setThumbnails(newThumbnails);
      setPageStates(newPageStates);
      setIsLoading(false);

      // Render first page
      if (newPages.length > 0) {
        setSelectedPageIndex(0);
      }
    } catch (error) {
      console.error('Error loading PDF:', error);
      setIsLoading(false);
    }
  }, []);

  // Load initial file
  useEffect(() => {
    if (initialFile) {
      setIsLoading(true);
      loadPdf(initialFile);
    }
  }, [initialFile, loadPdf]);

  // Render a page
  const renderPage = useCallback(async (page: PdfPage) => {
    const lib = await getPdfjsLib();
    if (!lib || !pdfDocRef.current) return;

    const canvas = canvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!canvas || !overlay) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Cancel previous render
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }

    try {
      const pdfPage = await pdfDocRef.current.getPage(page.pageIndex + 1);
      const viewport = pdfPage.getViewport({ scale: 1.5 });

      // Scale to fit container
      const maxWidth = 600;
      const scale = Math.min(1, maxWidth / viewport.width);
      const scaledViewport = pdfPage.getViewport({ scale: scale * 1.5 });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      overlay.width = scaledViewport.width;
      overlay.height = scaledViewport.height;
      
      canvasWidthRef.current = scaledViewport.width;
      canvasHeightRef.current = scaledViewport.height;

      // Render PDF page
      const renderContext = {
        canvasContext: ctx,
        viewport: scaledViewport,
      };
      renderTaskRef.current = pdfPage.render(renderContext);
      await renderTaskRef.current.promise;

      // Render annotations
      renderAnnotations(page.id);
    } catch (error: any) {
      if (error?.name !== 'RenderingCancelledException') {
        console.error('Error rendering page:', error);
      }
    }
  }, []);

  // Render annotations
  const renderAnnotations = useCallback((pageId: string) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;

    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const state = pageStatesRef.current.get(pageId);
    if (!state) return;

    state.annotations.forEach(annotation => {
      if (annotation.points.length < 2) return;

      if (annotation.type === 'erase') {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.strokeStyle = annotation.color;
      ctx.lineWidth = annotation.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Draw the entire path as one continuous stroke
      ctx.beginPath();
      ctx.moveTo(
        annotation.points[0].x * canvasWidthRef.current,
        annotation.points[0].y * canvasHeightRef.current
      );
      
      for (let i = 1; i < annotation.points.length; i++) {
        ctx.lineTo(
          annotation.points[i].x * canvasWidthRef.current,
          annotation.points[i].y * canvasHeightRef.current
        );
      }
      
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    });
  }, []);

  // Render current page when selected
  useEffect(() => {
    if (pages.length > 0 && selectedPageIndex >= 0 && selectedPageIndex < pages.length) {
      renderPage(pages[selectedPageIndex]);
    }
  }, [pages, selectedPageIndex, renderPage]);

  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setPages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  // Delete page
  const handleDeletePage = useCallback((pageId: string) => {
    setPages(prev => prev.filter(p => p.id !== pageId));
    setPageStates(prev => {
      const newStates = new Map(prev);
      newStates.delete(pageId);
      return newStates;
    });
    setSelectedPageIndex(prev => Math.max(0, prev - 1));
  }, []);

  // Get normalized coordinates
  const getNormalizedCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  }, []);

  // Convert normalized to canvas coordinates
  const normalizedToCanvas = useCallback((point: { x: number; y: number }) => {
    return {
      x: point.x * canvasWidthRef.current,
      y: point.y * canvasHeightRef.current,
    };
  }, []);

  // Mouse handlers for drawing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isAnnotating) return;
    e.preventDefault();
    setIsDrawing(true);
    const coords = getNormalizedCoordinates(e);
    setCurrentPath([coords]);
  }, [isAnnotating, getNormalizedCoordinates]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !isAnnotating) return;
    e.preventDefault();

    const coords = getNormalizedCoordinates(e);
    setCurrentPath(prev => {
      const newPath = [...prev, coords];

      // Redraw annotations + current path
      const overlay = overlayCanvasRef.current;
      if (!overlay) return newPath;
      const ctx = overlay?.getContext('2d');
      if (!ctx || newPath.length < 2) return newPath;

      // First, re-render existing annotations
      const pageId = pages[selectedPageIndex]?.id;
      if (pageId) {
        const state = pageStatesRef.current.get(pageId);
        if (state) {
          ctx.clearRect(0, 0, overlay.width, overlay.height);
          
          // Draw existing annotations
          state.annotations.forEach(annotation => {
            if (annotation.points.length < 2) return;
            
            if (annotation.type === 'erase') {
              ctx.globalCompositeOperation = 'destination-out';
            } else {
              ctx.globalCompositeOperation = 'source-over';
            }

            ctx.strokeStyle = annotation.color;
            ctx.lineWidth = annotation.lineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.beginPath();
            ctx.moveTo(
              annotation.points[0].x * canvasWidthRef.current,
              annotation.points[0].y * canvasHeightRef.current
            );
            
            for (let i = 1; i < annotation.points.length; i++) {
              ctx.lineTo(
                annotation.points[i].x * canvasWidthRef.current,
                annotation.points[i].y * canvasHeightRef.current
              );
            }
            
            ctx.stroke();
          });
        }
      }

      // Now draw current path as one continuous stroke
      if (annotationTool === 'erase') {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.beginPath();
      ctx.strokeStyle = annotationColor;
      ctx.lineWidth = annotationLineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const startPoint = normalizedToCanvas(newPath[0]);
      ctx.moveTo(startPoint.x, startPoint.y);
      
      for (let i = 1; i < newPath.length; i++) {
        const point = normalizedToCanvas(newPath[i]);
        ctx.lineTo(point.x, point.y);
      }
      
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';

      return newPath;
    });
  }, [isDrawing, isAnnotating, annotationColor, annotationLineWidth, annotationTool, getNormalizedCoordinates, normalizedToCanvas, pages, selectedPageIndex]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || currentPath.length < 2) {
      setIsDrawing(false);
      setCurrentPath([]);
      return;
    }

    const pageId = pages[selectedPageIndex]?.id;
    if (!pageId) return;

    // Save annotation
    setPageStates(prev => {
      const newStates = new Map(prev);
      const state = newStates.get(pageId) || {
        annotations: [],
        history: [[]],
        historyIndex: 0,
      };

      const newAnnotation: PdfAnnotation = {
        id: Date.now().toString(),
        type: annotationTool,
        points: currentPath,
        color: annotationColor,
        lineWidth: annotationLineWidth,
      };

      const newAnnotations = [...state.annotations, newAnnotation];
      const newHistory = [...state.history.slice(0, state.historyIndex + 1), newAnnotations];

      newStates.set(pageId, {
        annotations: newAnnotations,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      });

      return newStates;
    });

    setIsDrawing(false);
    setCurrentPath([]);
  }, [isDrawing, currentPath, pages, selectedPageIndex, annotationTool, annotationColor, annotationLineWidth]);

  // Handle cursor position for draw/erase indicator
  const handleOverlayMouseMove = useCallback((e: React.MouseEvent) => {
    if (isAnnotating) {
      const rect = overlayCanvasRef.current?.getBoundingClientRect();
      if (rect) {
        setCursorPos({ x: e.clientX, y: e.clientY });
      }
    }
    handleMouseMove(e);
  }, [isAnnotating, handleMouseMove]);

  const handleOverlayMouseLeave = useCallback(() => {
    setCursorPos(null);
    handleMouseUp();
  }, [handleMouseUp]);

  // Undo
  const handleUndo = useCallback(() => {
    const pageId = pages[selectedPageIndex]?.id;
    if (!pageId) return;

    setPageStates(prev => {
      const newStates = new Map(prev);
      const state = newStates.get(pageId);
      if (!state || state.historyIndex <= 0) return prev;

      const newIndex = state.historyIndex - 1;
      newStates.set(pageId, {
        ...state,
        annotations: state.history[newIndex],
        historyIndex: newIndex,
      });

      return newStates;
    });

    renderAnnotations(pageId);
  }, [pages, selectedPageIndex, renderAnnotations]);

  // Redo
  const handleRedo = useCallback(() => {
    const pageId = pages[selectedPageIndex]?.id;
    if (!pageId) return;

    setPageStates(prev => {
      const newStates = new Map(prev);
      const state = newStates.get(pageId);
      if (!state || state.historyIndex >= state.history.length - 1) return prev;

      const newIndex = state.historyIndex + 1;
      newStates.set(pageId, {
        ...state,
        annotations: state.history[newIndex],
        historyIndex: newIndex,
      });

      return newStates;
    });

    renderAnnotations(pageId);
  }, [pages, selectedPageIndex, renderAnnotations]);

  // Done editing
  const handleDone = useCallback(() => {
    setIsAnnotating(false);
    setCursorPos(null);
    const pageId = pages[selectedPageIndex]?.id;
    if (pageId) {
      renderAnnotations(pageId);
    }
  }, [pages, selectedPageIndex, renderAnnotations]);

  // Handle adding new PDF
  const handleAddPdf = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      return;
    }

    const lib = await getPdfjsLib();
    if (!lib || !pdfDocRef.current) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await lib.getDocument({ data: arrayBuffer }).promise;

      const newPages: PdfPage[] = [];
      const newThumbnails = new Map(thumbnails);
      const newPageStates = new Map(pageStatesRef.current);

      for (let i = 0; i < pdf.numPages; i++) {
        const pageId = `${file.name}-${Date.now()}-${i}`;
        newPages.push({
          id: pageId,
          file,
          pageIndex: i,
        });

        // Initialize page state
        newPageStates.set(pageId, {
          annotations: [],
          history: [[]],
          historyIndex: 0,
        });

        // Generate thumbnail
        const page = await pdf.getPage(i + 1);
        const viewport = page.getViewport({ scale: 0.3 });
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = viewport.width;
        thumbCanvas.height = viewport.height;
        const ctx = thumbCanvas.getContext('2d');
        if (ctx) {
          await (page as any).render({ 
            canvasContext: ctx, 
            viewport: viewport 
          }).promise;
          newThumbnails.set(pageId, thumbCanvas.toDataURL());
        }
      }

      // Merge with existing pages from the same PDF document
      setPages(prev => [...prev, ...newPages]);
      setThumbnails(newThumbnails);
      setPageStates(newPageStates);
      setShowAddPdfModal(false);
    } catch (error) {
      console.error('Error adding PDF:', error);
    }
  }, [thumbnails]);

  // Export PDF
  const getPdfBytes = useCallback(async (): Promise<Uint8Array | null> => {
    const lib = await import('pdf-lib');
    
    if (!pdfArrayBufferRef.current) return null;

    try {
      // Load the original PDF with pdf-lib
      const srcDoc = await lib.PDFDocument.load(pdfArrayBufferRef.current);
      const pdfDoc = await lib.PDFDocument.create();

      for (const page of pages) {
        // Get the page dimensions from the original document
        const [embeddedPage] = await pdfDoc.embedPdf(srcDoc, [page.pageIndex]);
        
        // Create a new page with the same dimensions
        const srcPage = srcDoc.getPage(page.pageIndex);
        const { width, height } = srcPage.getSize();
        const newPage = pdfDoc.addPage([width, height]);
        
        // Draw the original page
        newPage.drawPage(embeddedPage, {
          x: 0,
          y: 0,
          width: width,
          height: height,
        });

        // Draw annotations
        const state = pageStatesRef.current.get(page.id);
        if (state && state.annotations.length > 0) {
          state.annotations.forEach(annotation => {
            if (annotation.points.length < 2) return;

            // Convert points to PDF coordinates
            const pdfPoints = annotation.points.map(p => ({
              x: p.x * width,
              y: height - p.y * height
            }));

            // Parse color
            const r = parseInt(annotation.color.slice(1, 3), 16) / 255;
            const g = parseInt(annotation.color.slice(3, 5), 16) / 255;
            const b = parseInt(annotation.color.slice(5, 7), 16) / 255;

            // Build path operators for smooth line
            const pathOperators = [
              lib.pushGraphicsState(),
              lib.setLineCap(lib.LineCapStyle.Round),
              lib.setLineJoin(lib.LineJoinStyle.Round),
              lib.setLineWidth(annotation.lineWidth),
              lib.setStrokingColor(lib.rgb(r, g, b)),
              lib.moveTo(pdfPoints[0].x, pdfPoints[0].y),
            ];

            for (let i = 1; i < pdfPoints.length; i++) {
              pathOperators.push(lib.lineTo(pdfPoints[i].x, pdfPoints[i].y));
            }

            pathOperators.push(lib.stroke());
            pathOperators.push(lib.popGraphicsState());

            newPage.pushOperators(...pathOperators);
          });
        }
      }

      return await pdfDoc.save();
    } catch (error) {
      console.error('Error exporting PDF:', error);
      return null;
    }
  }, [pages]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getPdfBytes,
  }), [getPdfBytes]);

  if (isLoading) {
    return (
      <div className="border rounded-xl p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
        <p className="text-muted-foreground">{t('loading')}</p>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="border rounded-xl p-8 text-center text-muted-foreground">
        {t('noPages')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Annotation Toolbar */}
      {isAnnotating && (
        <div className="flex items-center gap-2 p-2 bg-card border rounded-xl">
          <Button
            size="sm"
            variant={annotationTool === 'draw' ? 'default' : 'outline'}
            onClick={() => setAnnotationTool('draw')}
          >
            <Pencil className="h-4 w-4 mr-1" />
            {t('draw')}
          </Button>
          <Button
            size="sm"
            variant={annotationTool === 'erase' ? 'default' : 'outline'}
            onClick={() => setAnnotationTool('erase')}
          >
            <Eraser className="h-4 w-4 mr-1" />
            {t('erase')}
          </Button>
          <input
            type="color"
            value={annotationColor}
            onChange={(e) => setAnnotationColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer"
          />
          <input
            type="range"
            min="1"
            max="20"
            value={annotationLineWidth}
            onChange={(e) => setAnnotationLineWidth(Number(e.target.value))}
            className="w-24"
          />
          <span className="text-xs text-muted-foreground">{annotationLineWidth}px</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={handleUndo}>
            <Undo2 className="h-4 w-4 mr-1" />
            {t('undo')}
          </Button>
          <Button size="sm" variant="outline" onClick={handleRedo}>
            <Redo2 className="h-4 w-4 mr-1" />
            {t('redo')}
          </Button>
          <Button size="sm" onClick={handleDone}>
            <Check className="h-4 w-4 mr-1" />
            {t('done')}
          </Button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-col gap-4">
        {/* PDF Viewer */}
        <div className="flex flex-col items-center">
          {/* Navigation */}
          <div className="flex items-center gap-2 mb-2">
            <Button
              size="sm"
              variant="outline"
              disabled={selectedPageIndex === 0}
              onClick={() => setSelectedPageIndex(prev => prev - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {t('page')} {selectedPageIndex + 1} {t('of')} {pages.length}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={selectedPageIndex >= pages.length - 1}
              onClick={() => setSelectedPageIndex(prev => prev + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isAnnotating && (
              <>
                <Button size="sm" onClick={() => setIsAnnotating(true)} title={t('draw')}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setShowAddPdfModal(true)}
                  title={t('addPdf')}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>

          {/* Canvas */}
          <div className="relative border rounded-lg shadow-sm bg-white">
            <canvas ref={canvasRef} />
            <canvas
              ref={overlayCanvasRef}
              className="absolute top-0 left-0"
              style={{ cursor: isAnnotating ? 'none' : 'default' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleOverlayMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleOverlayMouseLeave}
            />
          </div>
        </div>

        {/* Page Thumbnails - Drag to reorder */}
        <div className="w-full">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={pages.map(p => p.id)} strategy={undefined}>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {pages.map((page, index) => (
                  <SortablePageItem
                    key={page.id}
                    page={page}
                    index={index}
                    isSelected={index === selectedPageIndex}
                    onSelect={() => setSelectedPageIndex(index)}
                    onDelete={() => handleDeletePage(page.id)}
                    thumbnail={thumbnails.get(page.id) || null}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* Cursor size indicator */}
      {isAnnotating && cursorPos && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: cursorPos.x,
            top: cursorPos.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className="rounded-full border-2 border-dashed"
            style={{
              width: annotationLineWidth * 2,
              height: annotationLineWidth * 2,
              borderColor: annotationTool === 'erase' ? 'rgba(0,0,0,0.5)' : annotationColor,
            }}
          />
        </div>
      )}

      {/* Add PDF Modal */}
      {showAddPdfModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border rounded-xl p-6 w-full max-w-md mx-4 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{t('addPdfTitle')}</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAddPdfModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
                isDraggingOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-muted-foreground/50"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingOver(false);
                const file = e.dataTransfer.files[0];
                if (file) {
                  handleAddPdf(file);
                }
              }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf,application/pdf';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    handleAddPdf(file);
                  }
                };
                input.click();
              }}
            >
              <FileUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">{t('dropOrClick')}</p>
              <p className="text-xs text-muted-foreground/60 mt-2">{t('onlyPdf')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
