// Tool Types - Central type definitions for all browser tools

export type ToolCategory = 
  | 'image' 
  | 'pdf' 
  | 'text' 
  | 'developer' 
  | 'calculator' 
  | 'converter' 
  | 'utility'
  | 'audio'
  | 'video'
  | 'security';

export interface ToolMetadata {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  description: string;
  shortDescription: string;
  category: ToolCategory;
  keywords: string[];
  icon: string;
  acceptsFiles: string[];
  outputsFiles: string[];
  features: string[];
  faq: FAQItem[];
  howTo: string[];
  relatedTools: string[];
  isPro?: boolean;
  isNew?: boolean;
  isPopular?: boolean;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface CategoryInfo {
  id: ToolCategory;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface ToolProgress {
  percent: number;
  stage: string;
  isProcessing: boolean;
}

export interface FileItem {
  id: string;
  file: File;
  preview?: string;
  processed?: Blob;
  processedUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolProps {
  onProgress?: (progress: ToolProgress) => void;
  onComplete?: (result: unknown) => void;
  onError?: (error: string) => void;
}

export type FileType = 
  | 'image' 
  | 'pdf' 
  | 'text' 
  | 'json' 
  | 'csv' 
  | 'xml' 
  | 'audio' 
  | 'video' 
  | 'archive'
  | 'unknown';

export interface DetectedFile {
  type: FileType;
  mimeType: string;
  extension: string;
  canProcess: boolean;
  suggestedTools: string[];
}
