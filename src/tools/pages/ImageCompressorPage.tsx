'use client';

import { useState } from 'react';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { FileDropZone } from '@/tools/components/FileDropZone';
import { ToolContainer } from '@/tools/components/ToolContainer';
import { AdInline } from '@/tools/components/AdSlot';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Download, 
  Image as ImageIcon, 
  ArrowRight,
  Check,
  Loader2
} from 'lucide-react';
import { useImageCompressor } from '@/tools/hooks/useImageCompressor';
import { getToolBySlug } from '@/tools/registry';
import { cn } from '@/lib/utils';

export default function ImageCompressorPage() {
  const tool = getToolBySlug('bild-komprimieren')!;
  const {
    files,
    progress,
    addFiles,
    removeFile,
    compress,
    reset,
  } = useImageCompressor();

  const [quality, setQuality] = useState(80);
  const [maxWidth, setMaxWidth] = useState(1920);
  const [outputFormat, setOutputFormat] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');
  const [hasProcessed, setHasProcessed] = useState(false);

  const handleFilesAccepted = (newFiles: File[]) => {
    addFiles(newFiles);
    setHasProcessed(false);
  };

  const handleCompress = async () => {
    await compress({ quality: quality / 100, maxWidth, outputFormat });
    setHasProcessed(true);
  };

  const handleDownloadAll = async () => {
    if (files.length === 1 && files[0].processed) {
      const ext = outputFormat.split('/')[1];
      saveAs(files[0].processed, files[0].file.name.replace(/\.[^.]+$/, `.${ext}`));
    } else if (files.length > 1) {
      const zip = new JSZip();
      const ext = outputFormat.split('/')[1];
      
      files.forEach((file) => {
        if (file.processed) {
          zip.file(file.file.name.replace(/\.[^.]+$/, `.${ext}`), file.processed);
        }
      });

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'komprimierte-bilder.zip');
    }
  };

  const handleReset = () => {
    reset();
    setHasProcessed(false);
  };

  const totalOriginalSize = files.reduce((sum, f) => sum + f.originalSize, 0);
  const totalCompressedSize = files.reduce((sum, f) => sum + f.compressedSize, 0);
  const totalSaved = totalOriginalSize > 0 
    ? ((1 - totalCompressedSize / totalOriginalSize) * 100).toFixed(1) 
    : '0';

  return (
    <ToolContainer tool={tool} progress={progress} onReset={files.length > 0 ? handleReset : undefined}>
      <div className="space-y-6">
        {/* Upload Area */}
        {!hasProcessed && (
          <>
            <FileDropZone
              onFilesAccepted={handleFilesAccepted}
              accept={{
                'image/jpeg': ['.jpg', '.jpeg'],
                'image/png': ['.png'],
                'image/webp': ['.webp'],
                'image/gif': ['.gif'],
              }}
              files={files.map(f => f.file)}
              onRemoveFile={(index) => removeFile(files[index].id)}
              maxFiles={20}
              maxSize={25 * 1024 * 1024}
              className="min-h-[200px] sm:min-h-[250px]"
            />

            {/* Ad Banner */}
            {files.length === 0 && <AdInline />}
          </>
        )}

        {/* Settings */}
        {files.length > 0 && !hasProcessed && (
          <div className="bg-card border rounded-xl p-4 sm:p-6 space-y-6">
            <h3 className="font-semibold text-lg">Einstellungen</h3>
            
            {/* Quality Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Qualität: {quality}%</Label>
                <span className="text-sm text-muted-foreground">
                  {quality < 50 ? 'Niedrig' : quality < 80 ? 'Mittel' : 'Hoch'}
                </span>
              </div>
              <Slider
                value={[quality]}
                onValueChange={([v]) => setQuality(v)}
                min={10}
                max={100}
                step={5}
                className="w-full"
              />
            </div>

            {/* Max Width */}
            <div className="space-y-3">
              <Label>Maximale Breite (px)</Label>
              <Select value={maxWidth.toString()} onValueChange={(v) => setMaxWidth(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="800">800px (Mobil)</SelectItem>
                  <SelectItem value="1280">1280px (HD)</SelectItem>
                  <SelectItem value="1920">1920px (Full HD)</SelectItem>
                  <SelectItem value="2560">2560px (QHD)</SelectItem>
                  <SelectItem value="3840">3840px (4K)</SelectItem>
                  <SelectItem value="9999">Originalgröße</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Output Format */}
            <div className="space-y-3">
              <Label>Ausgabeformat</Label>
              <Select value={outputFormat} onValueChange={(v) => setOutputFormat(v as typeof outputFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image/jpeg">JPEG (Kleinste Größe)</SelectItem>
                  <SelectItem value="image/png">PNG (Transparenz)</SelectItem>
                  <SelectItem value="image/webp">WebP (Modern)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Compress Button */}
            <Button
              onClick={handleCompress}
              className="w-full h-12 text-base"
              disabled={progress.isProcessing}
            >
              {progress.isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Wird komprimiert...
                </>
              ) : (
                <>
                  Komprimieren
                  <ArrowRight className="h-5 w-5 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}

        {/* Results */}
        {hasProcessed && files.length > 0 && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Check className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">
                    Komprimierung abgeschlossen!
                  </h3>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    {totalSaved}% Größe eingespart
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                    {formatSize(totalOriginalSize)}
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Original</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                    {formatSize(totalCompressedSize)}
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Neu</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                    {totalSaved}%
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Gespart</p>
                </div>
              </div>
            </div>

            {/* Image Results */}
            <div className="grid gap-4">
              {files.map((file) => (
                <div key={file.id} className="border rounded-xl overflow-hidden bg-card">
                  <div className="flex flex-col sm:flex-row">
                    {/* Preview */}
                    <div className="relative w-full sm:w-40 h-40 bg-muted shrink-0">
                      {file.processedUrl && (
                        <img
                          src={file.processedUrl}
                          alt="Compressed"
                          className="w-full h-full object-contain"
                        />
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 p-4">
                      <h4 className="font-medium truncate mb-2">{file.file.name}</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Original:</span>
                          <span className="ml-1 font-medium">{formatSize(file.originalSize)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Neu:</span>
                          <span className="ml-1 font-medium text-emerald-600">{formatSize(file.compressedSize)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Größe:</span>
                          <span className="ml-1 font-medium">{file.width}×{file.height}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Format:</span>
                          <span className="ml-1 font-medium uppercase">{outputFormat.split('/')[1]}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="p-4 flex sm:flex-col gap-2 border-t sm:border-t-0 sm:border-l">
                      <Button
                        size="sm"
                        onClick={() => {
                          const ext = outputFormat.split('/')[1];
                          saveAs(file.processed!, file.file.name.replace(/\.[^.]+$/, `.${ext}`));
                        }}
                        className="flex-1 sm:flex-none"
                      >
                        <Download className="h-4 w-4 sm:mr-2" />
                        <span className="sm:inline">Download</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Download All Button */}
            {files.length > 1 && (
              <Button onClick={handleDownloadAll} className="w-full h-12">
                <Download className="h-5 w-5 mr-2" />
                Alle herunterladen (ZIP)
              </Button>
            )}

            {/* Ad after results */}
            <AdInline />
          </div>
        )}

        {/* Empty State Preview Cards */}
        {files.length === 0 && !hasProcessed && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: ImageIcon, label: 'JPG', color: 'bg-blue-100 text-blue-600' },
              { icon: ImageIcon, label: 'PNG', color: 'bg-green-100 text-green-600' },
              { icon: ImageIcon, label: 'WebP', color: 'bg-purple-100 text-purple-600' },
              { icon: ImageIcon, label: 'GIF', color: 'bg-pink-100 text-pink-600' },
            ].map((item, i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-dashed bg-muted/30"
              >
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-2', item.color)}>
                  <item.icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ToolContainer>
  );
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
