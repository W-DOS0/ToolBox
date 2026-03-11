'use client';

import { useState, useCallback, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge'; 
import { cn } from '@/lib/utils';
import {
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Crop,
  Minimize2,
  Sliders,
  Droplet,
  Pencil,
  Eraser,
  Undo2,
  Redo2,
  Check,
  X,
  Type,
  Palette,
  Move,
  Trash2,
  Image,
  Gauge,
} from 'lucide-react';

export interface ImageEditorRef {
  getImageBlob: () => Promise<Blob | null>;
}

interface ImageEditorProps {
  initialImage: string;
  language?: string;
  onImageChange?: (edits: ImageEditState) => void;
}

interface Point {
  x: number;
  y: number;
}

interface Drawing {
  points: Point[];
  color: string;
  size: number;
  erase: boolean;
}

interface Watermark {
  id: string;
  type: 'text' | 'image';
  text?: string;
  image?: string;
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  font?: string;
}

interface ImageEditState {
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  grayscale: number;
  sepia: number;
  cropArea: { x: number; y: number; width: number; height: number } | null;
  drawings: Drawing[];
  watermarks: Watermark[];
  quality: number;
}

interface HistoryStep {
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  grayscale: number;
  sepia: number;
  cropArea: { x: number; y: number; width: number; height: number } | null;
  drawings: Drawing[];
  watermarks: Watermark[];
  quality: number;
}

// Compression preview types
interface CompressionPreview {
  png: { size: number; savings: number; blob: Blob | null };
  jpg: { size: number; savings: number; blob: Blob | null };
  webp: { size: number; savings: number; blob: Blob | null };
  gif: { size: number; savings: number; blob: Blob | null };
}

// Translations
const translations: Record<string, Record<string, string>> = {
  en: {
    crop: 'Crop',
    rotate: 'Rotate',
    flipH: 'Flip H',
    flipV: 'Flip V',
    filter: 'Filter',
    watermark: 'Watermark',
    draw: 'Draw',
    erase: 'Erase',
    clearDraw: 'Clear Drawing',
    brightness: 'Brightness',
    contrast: 'Contrast',
    saturation: 'Saturation',
    blur: 'Blur',
    grayscale: 'Grayscale',
    sepia: 'Sepia',
    apply: 'Apply',
    cancel: 'Cancel',
    quality: 'Quality',
    text: 'Text',
    image: 'Image',
    addWatermark: 'Add Watermark',
    resetFilters: 'Reset Filters',
    preview: 'Preview',
    compressionPreview: 'Compression Preview',
    originalSize: 'Original',
    estimatedSize: 'Est. size',
    savings: 'Save',
    currentQuality: 'Quality',
  },
  de: {
    crop: 'Zuschneiden',
    rotate: 'Drehen',
    flipH: 'Spiegeln H',
    flipV: 'Spiegeln V',
    filter: 'Filter',
    watermark: 'Wasserzeichen',
    draw: 'Zeichnen',
    erase: 'Radieren',
    clearDraw: 'Zeichnung löschen',
    brightness: 'Helligkeit',
    contrast: 'Kontrast',
    saturation: 'Sättigung',
    blur: 'Unschärfe',
    grayscale: 'Graustufen',
    sepia: 'Sepia',
    apply: 'Anwenden',
    cancel: 'Abbrechen',
    quality: 'Qualität',
    text: 'Text',
    image: 'Bild',
    addWatermark: 'Wasserzeichen hinzufügen',
    resetFilters: 'Filter zurücksetzen',
    preview: 'Vorschau',
    compressionPreview: 'Komprimierungsvorschau',
    originalSize: 'Original',
    estimatedSize: 'Geschätzte Größe',
    savings: 'Einsparung',
    currentQuality: 'Qualität',
  },
  es: {
    compressionPreview: 'Vista previa de compresión',
    originalSize: 'Original',
    estimatedSize: 'Tamaño estimado',
    savings: 'Ahorro',
    currentQuality: 'Calidad',
  },
  fr: {
    compressionPreview: 'Aperçu de la compression',
    originalSize: 'Original',
    estimatedSize: 'Taille estimée',
    savings: 'Économie',
    currentQuality: 'Qualité',
  },
  it: {
    compressionPreview: 'Anteprima compressione',
    originalSize: 'Originale',
    estimatedSize: 'Dimensioni stimate',
    savings: 'Risparmio',
    currentQuality: 'Qualità',
  },
  pt: {
    compressionPreview: 'Prévia da compressão',
    originalSize: 'Original',
    estimatedSize: 'Tamanho estimado',
    savings: 'Economia',
    currentQuality: 'Qualidade',
  },
  ru: {
    compressionPreview: 'Предпросмотр сжатия',
    originalSize: 'Оригинал',
    estimatedSize: 'Предполагаемый размер',
    savings: 'Экономия',
    currentQuality: 'Качество',
  },
  zh: {
    compressionPreview: '压缩预览',
    originalSize: '原始',
    estimatedSize: '预估大小',
    savings: '节省',
    currentQuality: '质量',
  },
  ja: {
    compressionPreview: '圧縮プレビュー',
    originalSize: 'オリジナル',
    estimatedSize: '推定サイズ',
    savings: '削減量',
    currentQuality: '品質',
  },
};

type Tool = 'none' | 'crop' | 'draw' | 'filter' | 'watermark' | 'compress';

export default forwardRef<ImageEditorRef, ImageEditorProps>(function ImageEditor(
  { initialImage, language = 'en', onImageChange },
  ref
) {
  const t = (key: string) => translations[language]?.[key] || translations.en[key] || key;

  // Main canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Tool state
  const [activeTool, setActiveTool] = useState<Tool>('none');
  const [drawMode, setDrawMode] = useState<'draw' | 'erase'>('draw');
  const [brushColor, setBrushColor] = useState('#ff0000');
  const [brushSize, setBrushSize] = useState(5);

  // Edit state
  const [edits, setEdits] = useState<ImageEditState>(() => {
    const saved = sessionStorage.getItem('imageEdits');
    if (saved) {
      try {
        return JSON.parse(saved) as ImageEditState;
      } catch {}
    }
    return {
      rotation: 0,
      flipH: false,
      flipV: false,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      blur: 0,
      grayscale: 0,
      sepia: 0,
      cropArea: null,
      drawings: [],
      watermarks: [],
      quality: 85,
    };
  });

  // History for undo/redo
  const [history, setHistory] = useState<HistoryStep[]>(() => {
    const saved = sessionStorage.getItem('imageHistory');
    if (saved) {
      try {
        return JSON.parse(saved) as HistoryStep[];
      } catch {}
    }
    return [{
      rotation: 0,
      flipH: false,
      flipV: false,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      blur: 0,
      grayscale: 0,
      sepia: 0,
      cropArea: null,
      drawings: [],
      watermarks: [],
      quality: 85,
    }];
  });

  const [historyIndex, setHistoryIndex] = useState(() => {
    const savedIndex = sessionStorage.getItem('imageHistoryIndex');
    if (savedIndex) {
      const idx = parseInt(savedIndex, 10);
      if (!isNaN(idx)) return idx;
    }
    return 0;
  });

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [cursorPosition, setCursorPosition] = useState<Point | null>(null);

  // Crop state
  const [cropStart, setCropStart] = useState<Point | null>(null);
  const [cropEnd, setCropEnd] = useState<Point | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  // Watermark state
  const [watermarkText, setWatermarkText] = useState('Watermark');
  const [watermarkColor, setWatermarkColor] = useState('#000000');
  const [watermarkSize, setWatermarkSize] = useState(24);
  const [watermarkOpacity, setWatermarkOpacity] = useState(1);
  const [watermarkFont, setWatermarkFont] = useState('Arial');
  const [selectedWatermark, setSelectedWatermark] = useState<string | null>(null);
  const [isDraggingWatermark, setIsDraggingWatermark] = useState(false);

  const fontOptions = [
    'Arial',
    'Verdana',
    'Helvetica',
    'Times New Roman',
    'Courier New',
    'Georgia',
    'Palatino',
    'Garamond',
    'Comic Sans MS',
    'Impact',
    'Tahoma',
    'Trebuchet MS',
  ];

  // Compression preview state
  const [compressionPreview, setCompressionPreview] = useState<CompressionPreview>({
    png: { size: 0, savings: 0, blob: null },
    jpg: { size: 0, savings: 0, blob: null },
    webp: { size: 0, savings: 0, blob: null },
    gif: { size: 0, savings: 0, blob: null },
  });
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [isCalculatingPreview, setIsCalculatingPreview] = useState(false);

  // Push to history
  const pushHistory = useCallback((newEdits: ImageEditState) => {
    const newStep: HistoryStep = {
      rotation: newEdits.rotation,
      flipH: newEdits.flipH,
      flipV: newEdits.flipV,
      brightness: newEdits.brightness,
      contrast: newEdits.contrast,
      saturation: newEdits.saturation,
      blur: newEdits.blur,
      grayscale: newEdits.grayscale,
      sepia: newEdits.sepia,
      cropArea: newEdits.cropArea,
      drawings: newEdits.drawings.map(d => ({ ...d, points: [...d.points] })),
      watermarks: newEdits.watermarks.map(w => ({ ...w })),
      quality: newEdits.quality,
    };
    
    // Remove any future history if we're not at the end
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newStep);
    
    // Limit history to 50 steps
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevStep = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setEdits({
        rotation: prevStep.rotation,
        flipH: prevStep.flipH,
        flipV: prevStep.flipV,
        brightness: prevStep.brightness,
        contrast: prevStep.contrast,
        saturation: prevStep.saturation,
        blur: prevStep.blur,
        grayscale: prevStep.grayscale,
        sepia: prevStep.sepia,
        cropArea: prevStep.cropArea,
        drawings: prevStep.drawings.map(d => ({ ...d, points: [...d.points] })),
        watermarks: prevStep.watermarks.map(w => ({ ...w })),
        quality: prevStep.quality,
      });
    }
  }, [history, historyIndex]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextStep = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setEdits({
        rotation: nextStep.rotation,
        flipH: nextStep.flipH,
        flipV: nextStep.flipV,
        brightness: nextStep.brightness,
        contrast: nextStep.contrast,
        saturation: nextStep.saturation,
        blur: nextStep.blur,
        grayscale: nextStep.grayscale,
        sepia: nextStep.sepia,
        cropArea: nextStep.cropArea,
        drawings: nextStep.drawings.map(d => ({ ...d, points: [...d.points] })),
        watermarks: nextStep.watermarks.map(w => ({ ...w })),
        quality: nextStep.quality,
      });
    }
  }, [history, historyIndex]);

// Export image blob - korrigierte Version
const getImageBlob = useCallback(async (quality?: number, mimeType?: string): Promise<Blob | null> => {
  const img = imageRef.current;
  if (!img) return null;

  // Verwende die übergebene Qualität oder fallback auf State
  const effectiveQuality = quality !== undefined ? quality : edits.quality / 100;
  const effectiveMimeType = mimeType || 'image/png';

  console.log('Exporting with quality:', effectiveQuality, 'mime:', effectiveMimeType);

  // Berechne die Basis-Dimensionen mit Rotation
  let baseWidth = img.width;
  let baseHeight = img.height;

  if (edits.rotation === 90 || edits.rotation === 270) {
    baseWidth = img.height;
    baseHeight = img.width;
  }

  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = baseWidth;
  baseCanvas.height = baseHeight;

  const ctx = baseCanvas.getContext('2d');
  if (!ctx) return null;

  // Filter anwenden
  ctx.filter = [
    `brightness(${edits.brightness}%)`,
    `contrast(${edits.contrast}%)`,
    `saturate(${edits.saturation}%)`,
    `blur(${edits.blur}px)`,
    `grayscale(${edits.grayscale}%)`,
    `sepia(${edits.sepia}%)`,
  ].join(' ');

  // Rotation und Flip anwenden
  ctx.save();
  ctx.translate(baseWidth / 2, baseHeight / 2);
  ctx.rotate((edits.rotation * Math.PI) / 180);
  if (edits.flipH) ctx.scale(-1, 1);
  if (edits.flipV) ctx.scale(1, -1);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();

  // Zeichnungen malen
  edits.drawings.forEach(d => {
    if (d.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (d.erase) ctx.globalCompositeOperation = 'destination-out';

    ctx.moveTo(d.points[0].x, d.points[0].y);
    d.points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  });

  // Watermarks malen
  edits.watermarks.forEach(wm => {
    if (!wm.text) return;
    ctx.globalAlpha = wm.opacity;
    ctx.font = `${wm.size}px ${wm.font || 'Arial'}`;
    ctx.fillStyle = wm.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;

    ctx.strokeText(wm.text, wm.x, wm.y);
    ctx.fillText(wm.text, wm.x, wm.y);
    ctx.globalAlpha = 1;
  });

  // Crop anwenden, falls gesetzt
  if (edits.cropArea) {
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = edits.cropArea.width;
    cropCanvas.height = edits.cropArea.height;
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) return null;

    cropCtx.drawImage(
      baseCanvas,
      edits.cropArea.x,
      edits.cropArea.y,
      edits.cropArea.width,
      edits.cropArea.height,
      0,
      0,
      edits.cropArea.width,
      edits.cropArea.height
    );

    // Bei JPG/WebP Qualität anwenden, bei PNG/GIF ignorieren
    return new Promise(resolve => {
      if (effectiveMimeType === 'image/jpeg' || effectiveMimeType === 'image/webp') {
        cropCanvas.toBlob(blob => resolve(blob), effectiveMimeType, effectiveQuality);
      } else {
        cropCanvas.toBlob(blob => resolve(blob), effectiveMimeType);
      }
    });
  }

  // Ohne Crop
  return new Promise(resolve => {
    if (effectiveMimeType === 'image/jpeg' || effectiveMimeType === 'image/webp') {
      baseCanvas.toBlob(blob => resolve(blob), effectiveMimeType, effectiveQuality);
    } else {
      baseCanvas.toBlob(blob => resolve(blob), effectiveMimeType);
    }
  });
}, [edits]);

  // Calculate compression preview for all formats
// Calculate compression preview for all formats
const calculateCompressionPreview = useCallback(async () => {
  if (!imageRef.current) return;

  setIsCalculatingPreview(true);
  
  try {
    // Original mit 100% PNG für Referenz
    const currentBlob = await getImageBlob(1.0, 'image/png'); 
    if (!currentBlob) return;

    const originalSizeBytes = currentBlob.size;
    setOriginalSize(originalSizeBytes);

    // Teste verschiedene Formate mit aktueller Qualität
    const formats = [
      { type: 'png', mime: 'image/png', quality: 1.0 },
      { type: 'jpg', mime: 'image/jpeg', quality: edits.quality / 100 },
      { type: 'webp', mime: 'image/webp', quality: edits.quality / 100 },
      { type: 'gif', mime: 'image/gif', quality: 1.0 },
    ];

    const previews: CompressionPreview = {
      png: { size: 0, savings: 0, blob: null },
      jpg: { size: 0, savings: 0, blob: null },
      webp: { size: 0, savings: 0, blob: null },
      gif: { size: 0, savings: 0, blob: null },
    };

    for (const format of formats) {
      const blob = await getImageBlob(format.quality, format.mime);
      if (blob) {
        const size = blob.size;
        const savings = originalSizeBytes > 0 
          ? Math.round((1 - size / originalSizeBytes) * 100) 
          : 0;

        previews[format.type as keyof CompressionPreview] = {
          size,
          savings,
          blob,
        };
        
        console.log(`${format.type}: ${size} bytes (${savings}% savings)`);
      }
    }

    setCompressionPreview(previews);
  } catch (error) {
    console.error('Error calculating compression preview:', error);
  } finally {
    setIsCalculatingPreview(false);
  }
}, [edits.quality, getImageBlob]);

  // Recalculate preview when quality changes
  useEffect(() => {
    if (activeTool === 'compress') {
      const debounceTimer = setTimeout(() => {
        calculateCompressionPreview();
      }, 300);
      return () => clearTimeout(debounceTimer);
    }
  }, [edits.quality, activeTool, calculateCompressionPreview]);

// Render image with all edits
const renderImage = useCallback(() => {
  const canvas = canvasRef.current;
  const overlay = overlayCanvasRef.current;
  const img = imageRef.current;

  if (!canvas || !overlay || !img) return;

  const ctx = canvas.getContext('2d');
  const overlayCtx = overlay.getContext('2d');
  if (!ctx || !overlayCtx) return;

  let displayWidth = img.width;
  let displayHeight = img.height;

  if (edits.rotation === 90 || edits.rotation === 270) {
    [displayWidth, displayHeight] = [displayHeight, displayWidth];
  }

  const maxWidth = Math.min(600, window.innerWidth - 48);
  const maxHeight = Math.min(400, window.innerHeight - 300);

  const scale = Math.min(
    maxWidth / displayWidth,
    maxHeight / displayHeight,
    1
  );

  const scaledWidth = displayWidth * scale;
  const scaledHeight = displayHeight * scale;

  const off = document.createElement('canvas');
  off.width = scaledWidth;
  off.height = scaledHeight;
  const offCtx = off.getContext('2d');
  if (!offCtx) return;

  offCtx.save();
  offCtx.translate(off.width / 2, off.height / 2);
  offCtx.rotate((edits.rotation * Math.PI) / 180);

  if (edits.flipH) offCtx.scale(-1, 1);
  if (edits.flipV) offCtx.scale(1, -1);

  offCtx.drawImage(
    img,
    -img.width * scale / 2,
    -img.height * scale / 2,
    img.width * scale,
    img.height * scale
  );

  offCtx.restore();

  offCtx.filter = [
    `brightness(${edits.brightness}%)`,
    `contrast(${edits.contrast}%)`,
    `saturate(${edits.saturation}%)`,
    `blur(${edits.blur}px)`,
    `grayscale(${edits.grayscale}%)`,
    `sepia(${edits.sepia}%)`,
  ].join(' ');

  const crop = edits.cropArea;

  if (crop) {
    canvas.width = crop.width;
    canvas.height = crop.height;
  } else {
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
  }

  overlay.width = canvas.width;
  overlay.height = canvas.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (crop) {
    ctx.drawImage(
      off,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height
    );
  } else {
    ctx.drawImage(off, 0, 0);
  }

  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

  // Zuerst die Zeichnungen auf das overlayCanvas zeichnen
  edits.drawings.forEach(drawing => {
    if (drawing.points.length < 2) return;

    overlayCtx.beginPath();
    overlayCtx.strokeStyle = drawing.color;
    overlayCtx.lineWidth = drawing.size;
    overlayCtx.lineCap = 'round';
    overlayCtx.lineJoin = 'round';

    if (drawing.erase) {
      overlayCtx.globalCompositeOperation = 'destination-out';
    }

    overlayCtx.moveTo(drawing.points[0].x - (crop?.x || 0), drawing.points[0].y - (crop?.y || 0));
    drawing.points.forEach(p =>
      overlayCtx.lineTo(p.x - (crop?.x || 0), p.y - (crop?.y || 0))
    );

    overlayCtx.stroke();
    overlayCtx.globalCompositeOperation = 'source-over';
  });

  // Aktuellen Pfad zeichnen (während des Zeichnens)
  if (currentPath.length > 1) {
    overlayCtx.beginPath();
    overlayCtx.strokeStyle = brushColor;
    overlayCtx.lineWidth = brushSize;
    overlayCtx.lineCap = 'round';
    overlayCtx.lineJoin = 'round';

    overlayCtx.moveTo(currentPath[0].x - (crop?.x || 0), currentPath[0].y - (crop?.y || 0));
    currentPath.forEach(p =>
      overlayCtx.lineTo(p.x - (crop?.x || 0), p.y - (crop?.y || 0))
    );

    overlayCtx.stroke();
  }

  // Watermarks zeichnen - mit Schriftart
  edits.watermarks.forEach(wm => {
    overlayCtx.globalAlpha = wm.opacity;

    if (wm.type === 'text' && wm.text) {
      overlayCtx.font = `${wm.size}px ${wm.font || 'Arial'}`;
      overlayCtx.fillStyle = wm.color;
      overlayCtx.strokeStyle = 'rgba(0,0,0,0.5)';
      overlayCtx.lineWidth = 2;

      const drawX = wm.x - (crop?.x || 0);
      const drawY = wm.y - (crop?.y || 0);

      overlayCtx.strokeText(wm.text, drawX, drawY);
      overlayCtx.fillText(wm.text, drawX, drawY);
    }

    overlayCtx.globalAlpha = 1;
  });

  // JETZT den Crop-Overlay zeichnen - aber anders!
  if (activeTool === 'crop' && cropStart && cropEnd) {
    const x = Math.min(cropStart.x, cropEnd.x);
    const y = Math.min(cropStart.y, cropEnd.y);
    const w = Math.abs(cropEnd.x - cropStart.x);
    const h = Math.abs(cropEnd.y - cropStart.y);

    // Wichtig: Wir zeichnen den Overlay in einem separaten Durchgang
    // und verwenden 'destination-out' um die Zeichnungen freizustellen
    
    // Temporäres Canvas für den Overlay
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = overlay.width;
    tempCanvas.height = overlay.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // Halbtransparenten schwarzen Overlay auf tempCanvas zeichnen
    tempCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Den ausgewählten Bereich ausschneiden
    tempCtx.clearRect(x, y, w, h);
    
    // Rahmen und Eckmarkierungen auf tempCanvas zeichnen
    tempCtx.strokeStyle = 'white';
    tempCtx.lineWidth = 2;
    tempCtx.setLineDash([5, 5]);
    tempCtx.strokeRect(x, y, w, h);
    tempCtx.setLineDash([]);
    
    tempCtx.strokeStyle = 'white';
    tempCtx.lineWidth = 3;
    
    const markerSize = 10;
    tempCtx.beginPath();
    // Oben links
    tempCtx.moveTo(x, y + markerSize);
    tempCtx.lineTo(x, y);
    tempCtx.lineTo(x + markerSize, y);
    // Oben rechts
    tempCtx.moveTo(x + w - markerSize, y);
    tempCtx.lineTo(x + w, y);
    tempCtx.lineTo(x + w, y + markerSize);
    // Unten rechts
    tempCtx.moveTo(x + w, y + h - markerSize);
    tempCtx.lineTo(x + w, y + h);
    tempCtx.lineTo(x + w - markerSize, y + h);
    // Unten links
    tempCtx.moveTo(x + markerSize, y + h);
    tempCtx.lineTo(x, y + h);
    tempCtx.lineTo(x, y + h - markerSize);
    tempCtx.stroke();
    
    // Jetzt kombinieren wir das overlayCanvas mit dem tempCanvas
    // Wir verwenden 'source-atop' um den Overlay nur über den Bereichen zu zeichnen,
    // die nicht freigestellt wurden
    overlayCtx.globalCompositeOperation = 'source-over';
    overlayCtx.drawImage(tempCanvas, 0, 0);
    
    // Composite-Operation zurücksetzen
    overlayCtx.globalCompositeOperation = 'source-over';
  }

}, [
  edits,
  activeTool,
  cropStart,
  cropEnd,
  currentPath,
  brushColor,
  brushSize
]);

  useEffect(() => {
    sessionStorage.setItem('imageEdits', JSON.stringify(edits));
    sessionStorage.setItem('imageHistory', JSON.stringify(history));
    sessionStorage.setItem('imageHistoryIndex', historyIndex.toString());
  }, [edits, history, historyIndex]);

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      imageRef.current = img;
      renderImage(); // rendere das Bild einmal nach dem Laden
    };
    img.src = initialImage;
  }, [initialImage, renderImage]);

  // Re-render when edits change
  useEffect(() => {
    if (imageRef.current) {
      renderImage();
    }
  }, [edits, renderImage]);

  // Notify parent of changes
  useEffect(() => {
    onImageChange?.(edits);
  }, [edits, onImageChange]);

  // Get canvas point from event
const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): Point => {
  const canvas = overlayCanvasRef.current;
  if (!canvas) return { x: 0, y: 0 };

  const rect = canvas.getBoundingClientRect();

  const clientX =
    'touches' in e
      ? e.touches[0]?.clientX || 0
      : e.clientX;

  const clientY =
    'touches' in e
      ? e.touches[0]?.clientY || 0
      : e.clientY;

  // Mauskoordinaten relativ zum Canvas (sichtbarer Bereich)
  const visibleX = clientX - rect.left;
  const visibleY = clientY - rect.top;

  // Für Watermark-Tool: Wir wollen relative Koordinaten zum sichtbaren Bereich
  // da wir den Crop-Offset später in handleCanvasMouseMove addieren
  if (activeTool === 'watermark') {
    return {
      x: visibleX,
      y: visibleY,
    };
  }

  // Für Crop-Tool: Auch relative Koordinaten
  if (activeTool === 'crop') {
    return {
      x: visibleX,
      y: visibleY,
    };
  }

  // Für andere Tools (draw): Absolute Koordinaten (mit Crop-Offset)
  const crop = edits.cropArea;
  return {
    x: visibleX + (crop?.x || 0),
    y: visibleY + (crop?.y || 0),
  };
};

  // Mouse/Touch handlers
  const handleCanvasMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const point = getCanvasPoint(e);

if (activeTool === 'crop') {
  if (!isCropping) {
    // Stelle sicher, dass der Startpunkt innerhalb des Canvas liegt
    const canvas = overlayCanvasRef.current;
    if (canvas) {
      const clampedPoint = {
        x: Math.max(0, Math.min(point.x, canvas.width)),
        y: Math.max(0, Math.min(point.y, canvas.height)),
      };
      setCropStart(clampedPoint);
      setCropEnd(clampedPoint);
      setIsCropping(true);
    }
  }
} else if (activeTool === 'draw') {
      setIsDrawing(true);
      setCurrentPath([point]);
    } else if (activeTool === 'watermark') {
  const clickedWm = edits.watermarks.find(wm => {
    if (wm.type === 'text' && wm.text) {
      // Berechne die sichtbaren Koordinaten des Watermarks
      const crop = edits.cropArea;
      const visibleX = wm.x - (crop?.x || 0);
      const visibleY = wm.y - (crop?.y || 0);
      
      // Schätze die Breite des Textes
      const approxWidth = wm.text.length * wm.size * 0.6; // Grobe Schätzung
      const approxHeight = wm.size * 1.2; // Grobe Schätzung
      
      // Prüfe ob der Klick innerhalb des Watermark-Bereichs liegt
      // point.x/y sind bereits relativ zum sichtbaren Bereich
      return point.x >= visibleX - 10 &&
             point.x <= visibleX + approxWidth + 10 &&
             point.y >= visibleY - approxHeight &&
             point.y <= visibleY + 10;
    }
    return false;
  });

  if (clickedWm) {
    setSelectedWatermark(clickedWm.id);
    setWatermarkText(clickedWm.text || 'Watermark');
    setWatermarkColor(clickedWm.color);
    setWatermarkSize(clickedWm.size);
    setIsDraggingWatermark(true);
  } else {
    setSelectedWatermark(null);
    setIsDraggingWatermark(false);
  }
}
  };

  const handleCanvasMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const point = getCanvasPoint(e);

    if (activeTool === 'draw' || activeTool === 'watermark') {
      setCursorPosition(point);
    }

    if (activeTool === 'crop' && isCropping && cropStart) {
  // Stelle sicher, dass die Koordinaten innerhalb des Canvas bleiben
  const canvas = overlayCanvasRef.current;
  if (canvas) {
    const clampedPoint = {
      x: Math.max(0, Math.min(point.x, canvas.width)),
      y: Math.max(0, Math.min(point.y, canvas.height)),
    };
    setCropEnd(clampedPoint);
  }
} else if (activeTool === 'draw' && isDrawing) {
      setCurrentPath(prev => [...prev, point]);
   // In handleCanvasMouseMove, ersetze den Watermark-Drag-Teil:
} else if (activeTool === 'watermark' && selectedWatermark && isDraggingWatermark) {
  const wm = edits.watermarks.find(w => w.id === selectedWatermark);
  if (wm) {
    const crop = edits.cropArea;
    
    // Berechne die neuen Koordinaten
    // point.x/y sind bereits relativ zum sichtbaren Bereich (durch getCanvasPoint)
    // Wir addieren den Crop-Offset, um absolute Koordinaten zu erhalten
    // KEIN Text-Längen-Offset mehr, da der Watermark bereits mit Offset gespeichert wurde
    const newX = point.x + (crop?.x || 0);
    const newY = point.y + (crop?.y || 0);
    
    const newWatermarks = edits.watermarks.map(w =>
      w.id === selectedWatermark
        ? {
            ...w,
            x: newX,
            y: newY,
          }
        : w
    );
    setEdits(prev => ({ ...prev, watermarks: newWatermarks }));
  }
}
  };

  const handleCanvasMouseUp = () => {
    if (activeTool === 'crop' && isCropping) {
      setIsCropping(false);
    } else if (activeTool === 'draw' && isDrawing && currentPath.length > 1) {
      const newDrawing: Drawing = {
        points: [...currentPath],
        color: brushColor,
        size: brushSize,
        erase: drawMode === 'erase',
      };
      const newEdits = {
        ...edits,
        drawings: [...edits.drawings, newDrawing],
      };
      setEdits(newEdits);
      pushHistory(newEdits);
    } else if (activeTool === 'watermark' && selectedWatermark && isDraggingWatermark) {
      // Push Watermark-Move als History-Step
      pushHistory(edits);
    }

    setIsDrawing(false);
    setIsDraggingWatermark(false);
    setCurrentPath([]);
  };

  // Apply crop - verbessert für mehrfaches Zuschneiden
const applyCrop = () => {
  if (!cropStart || !cropEnd) return;

  // Die Koordinaten sind jetzt relativ zum aktuell sichtbaren Bereich
  const x = Math.min(cropStart.x, cropEnd.x);
  const y = Math.min(cropStart.y, cropEnd.y);
  const width = Math.abs(cropEnd.x - cropStart.x);
  const height = Math.abs(cropEnd.y - cropStart.y);

  if (width < 10 || height < 10) return;

  // Wenn bereits ein Crop existiert, müssen wir die neuen Koordinaten relativ zum Originalbild berechnen
  let newX = x;
  let newY = y;
  
  if (edits.cropArea) {
    // Die Crop-Koordinaten sind relativ zum aktuell sichtbaren Bereich (der bereits ein Crop ist)
    // Also müssen wir sie auf das Originalbild beziehen
    newX = edits.cropArea.x + x;
    newY = edits.cropArea.y + y;
  }

  const newEdits = {
    ...edits,
    cropArea: { x: newX, y: newY, width, height },
  };
  
  setEdits(newEdits);
  pushHistory(newEdits);
  setActiveTool('none');
  setCropStart(null);
  setCropEnd(null);
};

  // Rotate with history - korrigiert für Crop
  const handleRotate = () => {
    const newRotation = (edits.rotation + 90) % 360;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Aktuelle Dimensionen
    const width = canvas.width;
    const height = canvas.height;

    // Neue Dimensionen nach Rotation (getauscht bei 90/270 Grad)
    const newWidth = (newRotation === 90 || newRotation === 270) ? height : width;
    const newHeight = (newRotation === 90 || newRotation === 270) ? width : height;

    // Zeichnungen transformieren - relativ zum sichtbaren Bereich
    const newDrawings = edits.drawings.map(drawing => {
      const newPoints = drawing.points.map(p => {
        // Koordinaten relativ zum sichtbaren Bereich (nach Crop)
        const relX = p.x - (edits.cropArea?.x || 0);
        const relY = p.y - (edits.cropArea?.y || 0);
        
        // Rotation um die Mitte des sichtbaren Bereichs
        const cx = (edits.cropArea?.width || width) / 2;
        const cy = (edits.cropArea?.height || height) / 2;
        
        const dx = relX - cx;
        const dy = relY - cy;
        
        let newX, newY;
        
        if (newRotation === 90) {
          newX = cx - dy;
          newY = cy + dx;
        } else if (newRotation === 180) {
          newX = cx - dx;
          newY = cy - dy;
        } else if (newRotation === 270) {
          newX = cx + dy;
          newY = cy - dx;
        } else {
          newX = relX;
          newY = relY;
        }
        
        // Zurück zu absoluten Koordinaten
        return {
          x: newX + (edits.cropArea?.x || 0),
          y: newY + (edits.cropArea?.y || 0),
        };
      });
      return { ...drawing, points: newPoints };
    });

    const newEdits = {
      ...edits,
      rotation: newRotation,
      drawings: newDrawings,
    };
    setEdits(newEdits);
    pushHistory(newEdits);
  };

  // Flip horizontal with history - korrigiert für Crop
  const handleFlipH = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.width;

    const newDrawings = edits.drawings.map(drawing => {
      const newPoints = drawing.points.map(p => {
        // Koordinaten relativ zum sichtbaren Bereich (nach Crop)
        const relX = p.x - (edits.cropArea?.x || 0);
        const cropWidth = edits.cropArea?.width || width;
        
        // Horizontal spiegeln relativ zur Mitte des sichtbaren Bereichs
        const newRelX = cropWidth - relX;
        
        // Zurück zu absoluten Koordinaten
        return {
          ...p,
          x: newRelX + (edits.cropArea?.x || 0),
        };
      });
      return { ...drawing, points: newPoints };
    });

    const newEdits = {
      ...edits,
      flipH: !edits.flipH,
      drawings: newDrawings,
    };
    setEdits(newEdits);
    pushHistory(newEdits);
  };

  // Flip vertical with history - korrigiert für Crop
  const handleFlipV = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const height = canvas.height;

    const newDrawings = edits.drawings.map(drawing => {
      const newPoints = drawing.points.map(p => {
        // Koordinaten relativ zum sichtbaren Bereich (nach Crop)
        const relY = p.y - (edits.cropArea?.y || 0);
        const cropHeight = edits.cropArea?.height || height;
        
        // Vertikal spiegeln relativ zur Mitte des sichtbaren Bereichs
        const newRelY = cropHeight - relY;
        
        // Zurück zu absoluten Koordinaten
        return {
          ...p,
          y: newRelY + (edits.cropArea?.y || 0),
        };
      });
      return { ...drawing, points: newPoints };
    });

    const newEdits = {
      ...edits,
      flipV: !edits.flipV,
      drawings: newDrawings,
    };
    setEdits(newEdits);
    pushHistory(newEdits);
  };

  // Add watermark - korrigiert für Crop mit erweiterten Einstellungen
  const addTextWatermark = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Berechne die Mitte des aktuell sichtbaren Bereichs
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Wenn ein Crop existiert, müssen wir die Koordinaten auf das Originalbild beziehen
    let absoluteX = centerX;
    let absoluteY = centerY;
    
    if (edits.cropArea) {
      // Verschiebe die Koordinaten um den Crop-Offset
      absoluteX = edits.cropArea.x + centerX;
      absoluteY = edits.cropArea.y + centerY;
    }

    const wm: Watermark = {
      id: Date.now().toString(),
      type: 'text',
      text: watermarkText || 'Watermark',
      x: absoluteX - (watermarkText.length * watermarkSize * 0.25), // Zentriere den Text horizontal
      y: absoluteY,
      size: watermarkSize,
      color: watermarkColor,
      opacity: watermarkOpacity,
      font: watermarkFont, // Neue Eigenschaft
    };
    
    const newEdits = {
      ...edits,
      watermarks: [...edits.watermarks, wm],
    };
    setEdits(newEdits);
    pushHistory(newEdits);
    setSelectedWatermark(wm.id);
  };

  // Update watermark text
  const updateWatermarkText = (text: string) => {
    setWatermarkText(text);
    if (selectedWatermark) {
      const newEdits = {
        ...edits,
        watermarks: edits.watermarks.map(wm =>
          wm.id === selectedWatermark ? { ...wm, text } : wm
        ),
      };
      setEdits(newEdits);
      // Don't push to history on every character change
    }
  };

  // Remove watermark
  const removeWatermark = () => {
    if (!selectedWatermark) return;
    const newEdits = {
      ...edits,
      watermarks: edits.watermarks.filter(wm => wm.id !== selectedWatermark),
    };
    setEdits(newEdits);
    pushHistory(newEdits);
    setSelectedWatermark(null);
  };

  // Clear drawings
  const clearDrawings = () => {
    const newEdits = {
      ...edits,
      drawings: [],
    };
    setEdits(newEdits);
    pushHistory(newEdits);
  };

  // Reset filters
  const resetFilters = () => {
    const newEdits = {
      ...edits,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      blur: 0,
      grayscale: 0,
      sepia: 0,
    };
    setEdits(newEdits);
    pushHistory(newEdits);
  };

  // Format size helper
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Export image blob - updated to accept quality and mime type

useImperativeHandle(ref, () => ({
  getImageBlob: () => getImageBlob(edits.quality / 100, undefined),
}));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-card border rounded-xl p-2 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {/* Undo/Redo - Always visible with step counter */}
          <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className={cn(
                "gap-1 h-7 px-2",
                historyIndex > 0 && "text-primary hover:text-primary hover:bg-primary/10"
              )}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Undo</span>
            </Button>
            <div className="px-2 text-xs text-muted-foreground font-mono min-w-[40px] text-center">
              {historyIndex + 1}/{history.length}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className={cn(
                "gap-1 h-7 px-2",
                historyIndex < history.length - 1 && "text-primary hover:text-primary hover:bg-primary/10"
              )}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Redo</span>
            </Button>
          </div>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Tools */}
          <Button
            variant={activeTool === 'crop' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTool(activeTool === 'crop' ? 'none' : 'crop')}
          >
            <Crop className="h-4 w-4 mr-1" />
            {t('crop')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRotate}
          >
            <RotateCw className="h-4 w-4 mr-1" />
            {t('rotate')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFlipH}
          >
            <FlipHorizontal className="h-4 w-4 mr-1" />
            {t('flipH')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFlipV}
          >
            <FlipVertical className="h-4 w-4 mr-1" />
            {t('flipV')}
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          <Button
            variant={activeTool === 'filter' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTool(activeTool === 'filter' ? 'none' : 'filter')}
          >
            <Sliders className="h-4 w-4 mr-1" />
            {t('filter')}
          </Button>

          <Button
            variant={activeTool === 'watermark' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTool(activeTool === 'watermark' ? 'none' : 'watermark')}
          >
            <Droplet className="h-4 w-4 mr-1" />
            {t('watermark')}
          </Button>

          <Button
            variant={activeTool === 'draw' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTool(activeTool === 'draw' ? 'none' : 'draw')}
          >
            <Pencil className="h-4 w-4 mr-1" />
            {t('draw')}
          </Button>

          <Button
            variant={activeTool === 'compress' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTool(activeTool === 'compress' ? 'none' : 'compress')}
          >
            <Gauge className="h-4 w-4 mr-1" />
            {t('compressionPreview')}
          </Button>
        </div>
      </div>

      {/* Tool Options */}
      {activeTool === 'filter' && (
        <div className="border rounded-xl p-4 space-y-4 bg-card">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">{t('filter')}</h3>
            <Button variant="outline" size="sm" onClick={resetFilters}>
              {t('resetFilters')}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'brightness', label: t('brightness'), max: 200 },
              { key: 'contrast', label: t('contrast'), max: 200 },
              { key: 'saturation', label: t('saturation'), max: 200 },
              { key: 'blur', label: t('blur'), max: 20 },
              { key: 'grayscale', label: t('grayscale'), max: 100 },
              { key: 'sepia', label: t('sepia'), max: 100 },
            ].map(({ key, label, max }) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <Label className="text-xs">{label}</Label>
                  <span className="text-xs text-muted-foreground">
                    {edits[key as keyof ImageEditState] as number}{key !== 'blur' ? '%' : 'px'}
                  </span>
                </div>
                <Slider
                  value={[edits[key as keyof ImageEditState] as number]}
                  onValueChange={([v]) => {
                    const newEdits = { ...edits, [key]: v };
                    setEdits(newEdits);
                  }}
                  onValueCommit={([v]) => {
                    const newEdits = { ...edits, [key]: v };
                    pushHistory(newEdits);
                  }}
                  max={max}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTool === 'draw' && (
        <div className="border rounded-xl p-4 space-y-4 bg-card">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs">{t('color')}</Label>
              <input
                type="color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-[150px]">
              <Label className="text-xs">Size</Label>
              <Slider
                value={[brushSize]}
                onValueChange={([v]) => setBrushSize(v)}
                max={50}
                min={1}
                className="w-24"
              />
              <span className="text-xs text-muted-foreground w-6">{brushSize}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant={drawMode === 'draw' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDrawMode('draw')}
              >
                <Pencil className="h-4 w-4 mr-1" />
                {t('draw')}
              </Button>
              <Button
                variant={drawMode === 'erase' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDrawMode('erase')}
              >
                <Eraser className="h-4 w-4 mr-1" />
                {t('erase')}
              </Button>
              <Button variant="outline" size="sm" onClick={clearDrawings}>
                <Trash2 className="h-4 w-4 mr-1" />
                {t('clearDraw')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeTool === 'watermark' && (
        <div className="border rounded-xl p-4 space-y-4 bg-card">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">{t('watermark')}</h3>
            <Button size="sm" onClick={addTextWatermark}>
              {t('addWatermark')}
            </Button>
          </div>

          {/* Watermark Einstellungen - immer sichtbar */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-3">
         

            {/* Selected Watermark Controls */}
            {selectedWatermark && (
              <div className="border-t pt-3 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium"></span>
                 
                </div>
                
                {/* Aktualisiere selected watermark wenn sich Einstellungen ändern */}
                <div className="grid grid-cols-2 gap-2">
                  
                  <div className="col-span-2 flex items-center gap-1.5 bg-background rounded-md px-2 py-1">
                    <Type className="h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={edits.watermarks.find(w => w.id === selectedWatermark)?.text || ''}
                      onChange={(e) => {
                        const newText = e.target.value;
                        setEdits(prev => ({
                          ...prev,
                          watermarks: prev.watermarks.map(wm =>
                            wm.id === selectedWatermark ? { ...wm, text: newText } : wm
                          ),
                        }));
                      }}
                      onBlur={() => pushHistory(edits)}
                      className="flex-1 bg-transparent border-0 outline-none text-xs h-6"
                      placeholder="Text..."
                    /> <Button variant="destructive" size="sm" className="h-6 px-2" onClick={removeWatermark}>
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remove
                  </Button>
                  </div>

                  <div className="flex items-center gap-1.5 bg-background rounded-md px-2 py-1">
                    <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="color"
                      value={edits.watermarks.find(w => w.id === selectedWatermark)?.color || '#ffffff'}
                      onChange={(e) => {
                        const color = e.target.value;
                        setEdits(prev => ({
                          ...prev,
                          watermarks: prev.watermarks.map(wm =>
                            wm.id === selectedWatermark ? { ...wm, color } : wm
                          ),
                        }));
                      }}
                      onBlur={() => pushHistory(edits)}
                      className="w-5 h-5 rounded cursor-pointer border-0"
                    />
                  </div>

<div className="flex items-center gap-2">
  <div className="flex items-center gap-1.5 bg-background rounded-md px-2 py-1 min-w-[60px]">
    <Type className="h-3.5 w-3.5 text-muted-foreground" />
    <span className="text-xs text-muted-foreground">Size</span>
  </div>
  <div className="flex items-center gap-1 bg-background rounded-md px-1 py-1">
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 rounded-md"
      onClick={() => {
        const currentSize = edits.watermarks.find(w => w.id === selectedWatermark)?.size || 24;
        const newSize = Math.max(8, currentSize - 1);
        setEdits(prev => ({
          ...prev,
          watermarks: prev.watermarks.map(wm =>
            wm.id === selectedWatermark ? { ...wm, size: newSize } : wm
          ),
        }));
      }}
    >
      <span className="text-sm">−</span>
    </Button>
    
    <span className="text-xs font-medium w-8 text-center">
      {edits.watermarks.find(w => w.id === selectedWatermark)?.size || 24}
    </span>
    
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 rounded-md"
      onClick={() => {
        const currentSize = edits.watermarks.find(w => w.id === selectedWatermark)?.size || 24;
        const newSize = Math.min(72, currentSize + 1);
        setEdits(prev => ({
          ...prev,
          watermarks: prev.watermarks.map(wm =>
            wm.id === selectedWatermark ? { ...wm, size: newSize } : wm
          ),
        }));
      }}
    >
      <span className="text-sm">+</span>
    </Button>
  </div>
</div>

                  <div className="col-span-2">
                    <select
                      value={edits.watermarks.find(w => w.id === selectedWatermark)?.font || 'Arial'}
                      onChange={(e) => {
                        const font = e.target.value;
                        setEdits(prev => ({
                          ...prev,
                          watermarks: prev.watermarks.map(wm =>
                            wm.id === selectedWatermark ? { ...wm, font } : wm
                          ),
                        }));
                      }}
                      onBlur={() => pushHistory(edits)}
                      className="w-full bg-background rounded-md px-2 py-1 text-xs border-0 outline-none"
                    >
                      {fontOptions.map(font => (
                        <option key={font} value={font} style={{ fontFamily: font }}>
                          {font}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2 space-y-1">
                    <div className="flex justify-between text-xs">
                      <Label className="text-xs">Transparency</Label>
                      <span className="text-muted-foreground">
                        {Math.round((edits.watermarks.find(w => w.id === selectedWatermark)?.opacity || 0.8) * 100)}%
                      </span>
                    </div>
                    <Slider
                      value={[(edits.watermarks.find(w => w.id === selectedWatermark)?.opacity || 0.8) * 100]}
                      onValueChange={([v]) => {
                        const opacity = v / 100;
                        setEdits(prev => ({
                          ...prev,
                          watermarks: prev.watermarks.map(wm =>
                            wm.id === selectedWatermark ? { ...wm, opacity } : wm
                          ),
                        }));
                      }}
                      onValueCommit={() => pushHistory(edits)}
                      min={0}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                  </div>
                </div>

             
              </div>
            )}
          </div>
        </div>
      )}

      {activeTool === 'compress' && (
        <div className="border rounded-xl p-4 space-y-4 bg-card">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              {t('compressionPreview')}
            </h3>
            <Badge variant="outline" className="text-xs">
              {t('currentQuality')}: {edits.quality}%
            </Badge>
          </div>

          {/* Quality Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <Label>{t('quality')}</Label>
              <span className="text-muted-foreground">{edits.quality}%</span>
            </div>
            <Slider
              value={[edits.quality]}
              onValueChange={([v]) => {
                const newEdits = { ...edits, quality: v };
                setEdits(newEdits);
              }}
              onValueCommit={([v]) => {
                const newEdits = { ...edits, quality: v };
                pushHistory(newEdits);
              }}
              min={1}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          {/* Compression Preview Grid */}
          {isCalculatingPreview ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Calculating compression...
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {/* PNG */}
              <div className={cn(
                "border rounded-lg p-3 transition-all",
                compressionPreview.png.size > 0 ? "bg-card" : "opacity-50"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Image className="h-4 w-4" />
                  <span className="font-medium text-sm">PNG</span>
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('estimatedSize')}:</span>
                    <span>{formatSize(compressionPreview.png.size)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('savings')}:</span>
                    <span className={compressionPreview.png.savings > 0 ? 'text-green-600' : 'text-muted-foreground'}>
                      {compressionPreview.png.savings}%
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">{t('originalSize')}:</span>
                    <span>{formatSize(originalSize)}</span>
                  </div>
                </div>
              </div>

              {/* JPG */}
              <div className={cn(
                "border rounded-lg p-3 transition-all",
                compressionPreview.jpg.size > 0 ? "bg-card" : "opacity-50"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Image className="h-4 w-4" />
                  <span className="font-medium text-sm">JPG</span>
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('estimatedSize')}:</span>
                    <span>{formatSize(compressionPreview.jpg.size)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('savings')}:</span>
                    <span className={compressionPreview.jpg.savings > 0 ? 'text-green-600' : 'text-muted-foreground'}>
                      {compressionPreview.jpg.savings}%
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">{t('originalSize')}:</span>
                    <span>{formatSize(originalSize)}</span>
                  </div>
                </div>
              </div>

              {/* WebP */}
              <div className={cn(
                "border rounded-lg p-3 transition-all",
                compressionPreview.webp.size > 0 ? "bg-card" : "opacity-50"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Image className="h-4 w-4" />
                  <span className="font-medium text-sm">WebP</span>
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('estimatedSize')}:</span>
                    <span>{formatSize(compressionPreview.webp.size)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('savings')}:</span>
                    <span className={compressionPreview.webp.savings > 0 ? 'text-green-600' : 'text-muted-foreground'}>
                      {compressionPreview.webp.savings}%
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">{t('originalSize')}:</span>
                    <span>{formatSize(originalSize)}</span>
                  </div>
                </div>
              </div>

              {/* GIF */}
              <div className={cn(
                "border rounded-lg p-3 transition-all",
                compressionPreview.gif.size > 0 ? "bg-card" : "opacity-50"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Image className="h-4 w-4" />
                  <span className="font-medium text-sm">GIF</span>
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('estimatedSize')}:</span>
                    <span>{formatSize(compressionPreview.gif.size)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('savings')}:</span>
                    <span className={compressionPreview.gif.savings > 0 ? 'text-green-600' : 'text-muted-foreground'}>
                      {compressionPreview.gif.savings}%
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">{t('originalSize')}:</span>
                    <span>{formatSize(originalSize)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-center">
            Live preview - Adjust slider to see estimated file sizes
          </p>
        </div>
      )}

      {activeTool === 'crop' && cropStart && cropEnd && (
        <div className="border rounded-xl p-4 space-y-3 bg-card">
          <h3 className="font-medium text-sm">{t('crop')}</h3>
          <div className="flex gap-2">
            <Button size="sm" onClick={applyCrop}>
              <Check className="h-4 w-4 mr-1" />
              {t('apply')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setCropStart(null); setCropEnd(null); setIsCropping(false); }}>
              <X className="h-4 w-4 mr-1" />
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      {/* Canvas Preview */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="p-2 border-b bg-muted/30">
          <h3 className="text-xs font-medium">{t('preview')}</h3>
        </div>
        <div className="p-4 flex items-center justify-center bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] dark:bg-[repeating-conic-gradient(#374151_0%_25%,transparent_0%_50%)]">
          <div className="relative">
            <canvas ref={canvasRef} className="rounded-lg shadow-sm" />
            <canvas
              ref={overlayCanvasRef}
              className="absolute top-0 left-0 rounded-lg"
              style={{ cursor: activeTool === 'crop' ? 'crosshair' : activeTool === 'draw' ? 'crosshair' : activeTool === 'watermark' ? 'move' : 'default' }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={() => { handleCanvasMouseUp(); setCursorPosition(null); }}
              onTouchStart={handleCanvasMouseDown}
              onTouchMove={handleCanvasMouseMove}
              onTouchEnd={handleCanvasMouseUp}
            />
          </div>
        </div>
      </div>
    </div>
  );
});