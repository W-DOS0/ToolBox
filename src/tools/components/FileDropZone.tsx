'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileDropZoneProps {
  onFilesAccepted: (files: File[]) => void;
  accept?: Record<string, string[]>;
  maxFiles?: number;
  maxSize?: number;
  className?: string;
  disabled?: boolean;
  files?: File[];
  onRemoveFile?: (index: number) => void;
}

export function FileDropZone({
  onFilesAccepted,
  accept,
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB
  className,
  disabled = false,
  files = [],
  onRemoveFile,
}: FileDropZoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFilesAccepted(acceptedFiles);
  }, [onFilesAccepted]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept,
    maxFiles,
    maxSize,
    disabled,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all duration-200 cursor-pointer',
          'hover:border-primary/50 hover:bg-primary/5',
          isDragActive && 'border-primary bg-primary/10 scale-[1.01]',
          isDragReject && 'border-red-500 bg-red-50',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3 text-center">
          <div className={cn(
            'rounded-full p-4 transition-colors',
            isDragActive ? 'bg-primary/20' : 'bg-muted'
          )}>
            <Upload className={cn(
              'h-8 w-8 transition-transform',
              isDragActive && 'scale-110'
            )} />
          </div>
          <div>
            <p className="text-base font-medium">
              {isDragActive ? 'Dateien loslassen...' : 'Dateien hier ablegen'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              oder klicken zum Durchsuchen
            </p>
          </div>
          {maxSize && (
            <p className="text-xs text-muted-foreground">
              Max. {(maxSize / 1024 / 1024).toFixed(0)}MB pro Datei
            </p>
          )}
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border"
            >
              <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              {onRemoveFile && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFile(index);
                  }}
                  className="p-1 hover:bg-destructive/10 rounded-full transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
