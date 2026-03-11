// File type detection and handling utilities

export type DetectedType = 
  | 'image'
  | 'pdf'
  | 'json'
  | 'text'
  | 'csv'
  | 'xml'
  | 'html'
  | 'css'
  | 'javascript'
  | 'url'
  | 'markdown'
  | 'unknown';

export interface DetectedFile {
  type: DetectedType;
  mimeType: string;
  extension: string;
  name: string;
  size: number;
  content?: string;
  file?: File;
  preview?: string;
}

export interface InputMode {
  id: 'file' | 'text' | 'url';
  labelKey: string;
  icon: string;
  placeholderKey: string;
  descriptionKey: string;
}

export const inputModes: InputMode[] = [
  {
    id: 'file',
    labelKey: 'upload',
    icon: 'Upload',
    placeholderKey: 'dropFile',
    descriptionKey: 'supportedTypes',
  },
  {
    id: 'text',
    labelKey: 'text',
    icon: 'Type',
    placeholderKey: 'textInput',
    descriptionKey: 'textDescription',
  },
  {
    id: 'url',
    labelKey: 'url',
    icon: 'Link',
    placeholderKey: 'urlInput',
    descriptionKey: 'urlDescription',
  },
];

// File type detection
export function detectFileType(file: File): DetectedType {
  const mimeType = file.type.toLowerCase();
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  // Image types
  if (mimeType.startsWith('image/')) return 'image';
  
  // PDF
  if (mimeType === 'application/pdf' || extension === 'pdf') return 'pdf';
  
  // JSON
  if (mimeType === 'application/json' || extension === 'json') return 'json';
  
  // CSV
  if (mimeType === 'text/csv' || extension === 'csv') return 'csv';
  
  // XML
  if (mimeType === 'application/xml' || mimeType === 'text/xml' || ['xml', 'svg'].includes(extension)) return 'xml';
  
  // HTML
  if (mimeType === 'text/html' || extension === 'html' || extension === 'htm') return 'html';
  
  // CSS
  if (mimeType === 'text/css' || extension === 'css') return 'css';
  
  // JavaScript
  if (mimeType === 'application/javascript' || mimeType === 'text/javascript' || ['js', 'mjs', 'ts', 'tsx', 'jsx'].includes(extension)) return 'javascript';
  
  // Markdown
  if (extension === 'md' || extension === 'markdown') return 'markdown';
  
  // Text
  if (mimeType.startsWith('text/') || ['txt', 'log', 'rtf'].includes(extension)) return 'text';
  
  return 'unknown';
}

// Detect content type from text
export function detectTextType(text: string): DetectedType {
  const trimmed = text.trim();
  
  // Empty
  if (!trimmed) return 'text';
  
  // URL
  if (trimmed.match(/^https?:\/\/.+/i)) return 'url';
  
  // JSON
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not valid JSON
    }
  }
  
  // HTML
  if (trimmed.match(/<!DOCTYPE\s+html/i) || trimmed.match(/<html[\s>]/i)) return 'html';
  
  // XML
  if (trimmed.startsWith('<?xml') || (trimmed.startsWith('<') && trimmed.endsWith('>') && trimmed.includes('</'))) {
    return 'xml';
  }
  
  // CSS
  if (trimmed.match(/[.#]?[\w-]+\s*\{[\s\S]*\}/)) return 'css';
  
  // JavaScript
  if (trimmed.match(/^(function|const|let|var|class|import|export)\s/m) ||
      trimmed.match(/=>\s*[\({]/m)) {
    return 'javascript';
  }
  
  // Markdown
  if (trimmed.match(/^(#{1,6}\s|[-*+]\s|\d+\.\s|```)/m)) return 'markdown';
  
  // CSV (simple check)
  const lines = trimmed.split('\n');
  if (lines.length > 1 && lines[0].includes(',') && lines[1].includes(',')) {
    return 'csv';
  }
  
  return 'text';
}

// Get supported operations for file type - using translation keys
export interface EditOperation {
  id: string;
  labelKey: string;
  icon: string;
  descriptionKey: string;
  category: 'transform' | 'convert' | 'compress' | 'edit' | 'generate';
}

export function getEditOperations(type: DetectedType): EditOperation[] {
  switch (type) {
    case 'image':
      return [
        { id: 'compress', labelKey: 'op_compress', icon: 'Minimize2', descriptionKey: 'op_compress_desc', category: 'compress' },
        { id: 'resize', labelKey: 'op_resize', icon: 'Maximize2', descriptionKey: 'op_resize_desc', category: 'edit' },
        { id: 'crop', labelKey: 'op_crop', icon: 'Crop', descriptionKey: 'op_crop_desc', category: 'edit' },
        { id: 'rotate', labelKey: 'op_rotate', icon: 'RotateCw', descriptionKey: 'op_rotate_desc', category: 'transform' },
        { id: 'flipH', labelKey: 'op_flipH', icon: 'FlipHorizontal', descriptionKey: 'op_flipH_desc', category: 'transform' },
        { id: 'flipV', labelKey: 'op_flipV', icon: 'FlipVertical', descriptionKey: 'op_flipV_desc', category: 'transform' },
        { id: 'filter', labelKey: 'op_filter', icon: 'Sparkles', descriptionKey: 'op_filter_desc', category: 'edit' },
        { id: 'watermark', labelKey: 'op_watermark', icon: 'Droplet', descriptionKey: 'op_watermark_desc', category: 'edit' },
        { id: 'draw', labelKey: 'op_draw', icon: 'Palette', descriptionKey: 'op_draw_desc', category: 'edit' },
      ];
      
    case 'pdf':
      return [
        { id: 'merge', labelKey: 'op_merge', icon: 'Layers', descriptionKey: 'op_merge_desc', category: 'edit' },
        { id: 'split', labelKey: 'op_split', icon: 'Scissors', descriptionKey: 'op_split_desc', category: 'edit' },
        { id: 'compress', labelKey: 'op_compress', icon: 'Minimize2', descriptionKey: 'op_compress_desc', category: 'compress' },
        { id: 'rotate', labelKey: 'op_rotate', icon: 'RotateCw', descriptionKey: 'op_rotate_desc', category: 'transform' },
        { id: 'reorder', labelKey: 'op_reorder', icon: 'ArrowUpDown', descriptionKey: 'op_reorder_desc', category: 'edit' },
      ];
      
    case 'json':
      return [
        { id: 'format', labelKey: 'op_format', icon: 'Indent', descriptionKey: 'op_format_desc', category: 'transform' },
        { id: 'minify', labelKey: 'op_minify', icon: 'Minimize2', descriptionKey: 'op_minify_desc', category: 'compress' },
        { id: 'validate', labelKey: 'op_validate', icon: 'CheckCircle', descriptionKey: 'op_validate_desc', category: 'edit' },
        { id: 'toCsv', labelKey: 'op_toCsv', icon: 'Table', descriptionKey: 'op_toCsv_desc', category: 'convert' },
        { id: 'toXml', labelKey: 'op_toXml', icon: 'FileCode', descriptionKey: 'op_toXml_desc', category: 'convert' },
        { id: 'sort', labelKey: 'op_sort', icon: 'ArrowUpDown', descriptionKey: 'op_sort_desc', category: 'transform' },
      ];
      
    case 'text':
      return [
        { id: 'uppercase', labelKey: 'op_uppercase', icon: 'ArrowUp', descriptionKey: 'op_uppercase_desc', category: 'transform' },
        { id: 'lowercase', labelKey: 'op_lowercase', icon: 'ArrowDown', descriptionKey: 'op_lowercase_desc', category: 'transform' },
        { id: 'titlecase', labelKey: 'op_titlecase', icon: 'Type', descriptionKey: 'op_titlecase_desc', category: 'transform' },
        { id: 'wordCount', labelKey: 'op_wordCount', icon: 'Hash', descriptionKey: 'op_wordCount_desc', category: 'edit' },
        { id: 'reverse', labelKey: 'op_reverse', icon: 'ArrowLeftRight', descriptionKey: 'op_reverse_desc', category: 'transform' },
        { id: 'trim', labelKey: 'op_trim', icon: 'Scissors', descriptionKey: 'op_trim_desc', category: 'edit' },
      ];
      
    case 'url':
      return [
        { id: 'qrCode', labelKey: 'op_qrCode', icon: 'QrCode', descriptionKey: 'op_qrCode_desc', category: 'generate' },
        { id: 'shorten', labelKey: 'op_shorten', icon: 'Link', descriptionKey: 'op_shorten_desc', category: 'transform' },
        { id: 'encode', labelKey: 'op_encode', icon: 'Lock', descriptionKey: 'op_encode_desc', category: 'transform' },
        { id: 'decode', labelKey: 'op_decode', icon: 'Unlock', descriptionKey: 'op_decode_desc', category: 'transform' },
      ];
      
    case 'csv':
      return [
        { id: 'toJson', labelKey: 'op_toJson', icon: 'Braces', descriptionKey: 'op_toJson_desc', category: 'convert' },
        { id: 'format', labelKey: 'op_format', icon: 'Table', descriptionKey: 'op_format_desc', category: 'transform' },
        { id: 'sort', labelKey: 'op_sort', icon: 'ArrowUpDown', descriptionKey: 'op_sort_desc', category: 'edit' },
        { id: 'filter', labelKey: 'op_filter', icon: 'Filter', descriptionKey: 'op_filter_desc', category: 'edit' },
      ];
      
    case 'html':
    case 'css':
    case 'javascript':
    case 'xml':
    case 'markdown':
      return [
        { id: 'format', labelKey: 'op_format', icon: 'Indent', descriptionKey: 'op_format_desc', category: 'transform' },
        { id: 'minify', labelKey: 'op_minify', icon: 'Minimize2', descriptionKey: 'op_minify_desc', category: 'compress' },
        { id: 'validate', labelKey: 'op_validate', icon: 'CheckCircle', descriptionKey: 'op_validate_desc', category: 'edit' },
      ];
      
    default:
      return [
        { id: 'convert', labelKey: 'op_convert', icon: 'RefreshCw', descriptionKey: 'op_convert_desc', category: 'convert' },
      ];
  }
}

// Export formats per type
export interface ExportFormat {
  id: string;
  labelKey: string;
  mimeType: string;
  extension: string;
  icon: string;
}

export function getExportFormats(type: DetectedType): ExportFormat[] {
  switch (type) {
    case 'image':
      return [
        { id: 'png', labelKey: 'fmt_png', mimeType: 'image/png', extension: 'png', icon: 'Image' },
        { id: 'jpeg', labelKey: 'fmt_jpeg', mimeType: 'image/jpeg', extension: 'jpg', icon: 'Image' },
        { id: 'webp', labelKey: 'fmt_webp', mimeType: 'image/webp', extension: 'webp', icon: 'Image' },
        { id: 'gif', labelKey: 'fmt_gif', mimeType: 'image/gif', extension: 'gif', icon: 'Image' },
      ];
      
    case 'pdf':
      return [
        { id: 'pdf', labelKey: 'fmt_pdf', mimeType: 'application/pdf', extension: 'pdf', icon: 'FileText' },
        { id: 'images', labelKey: 'fmt_images', mimeType: 'image/jpeg', extension: 'jpg', icon: 'Image' },
      ];
      
    case 'json':
      return [
        { id: 'json', labelKey: 'fmt_json', mimeType: 'application/json', extension: 'json', icon: 'Braces' },
        { id: 'csv', labelKey: 'fmt_csv', mimeType: 'text/csv', extension: 'csv', icon: 'Table' },
        { id: 'xml', labelKey: 'fmt_xml', mimeType: 'application/xml', extension: 'xml', icon: 'FileCode' },
      ];
      
    case 'text':
    case 'markdown':
    case 'csv':
      return [
        { id: 'md', labelKey: 'fmt_md', mimeType: 'text/markdown', extension: 'md', icon: 'FileText' },
        { id: 'html', labelKey: 'fmt_html', mimeType: 'text/html', extension: 'html', icon: 'Code' },
        { id: 'docx', labelKey: 'fmt_docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: 'docx', icon: 'FileText' },
      ];
      
    case 'url':
      return [
        { id: 'png', labelKey: 'fmt_png', mimeType: 'image/png', extension: 'png', icon: 'Image' },
        { id: 'svg', labelKey: 'fmt_svg', mimeType: 'image/svg+xml', extension: 'svg', icon: 'Image' },
      ];
      
    case 'html':
      return [
        { id: 'zip', labelKey: 'fmt_zip', mimeType: 'application/zip', extension: 'zip', icon: 'FileArchive' },
      ];
      
    case 'css':
      return [
        { id: 'css', labelKey: 'fmt_css', mimeType: 'text/css', extension: 'css', icon: 'Palette' },
      ];
      
    case 'javascript':
      return [
        { id: 'js', labelKey: 'fmt_js', mimeType: 'application/javascript', extension: 'js', icon: 'Code' },
        { id: 'json', labelKey: 'fmt_json', mimeType: 'application/json', extension: 'json', icon: 'Braces' },
      ];
      
    case 'xml':
      return [
        { id: 'xml', labelKey: 'fmt_xml', mimeType: 'application/xml', extension: 'xml', icon: 'FileCode' },
        { id: 'json', labelKey: 'fmt_json', mimeType: 'application/json', extension: 'json', icon: 'Braces' },
      ];
      
    default:
      return [
        { id: 'original', labelKey: 'fmt_original', mimeType: 'application/octet-stream', extension: 'bin', icon: 'File' },
      ];
  }
}
