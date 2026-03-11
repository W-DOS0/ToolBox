'use client';

import { useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { Download, Check, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

export interface QrCodeSettings {
  size: number;
  fgColor: string;
  bgColor: string;
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
}

interface QrCodeGeneratorProps {
  url: string; 
  initialUrl?: string;
  language?: string;
  onQrChange?: (dataUrl: string, settings: QrCodeSettings) => void;
  settings: QrCodeSettings;
  onSettingsChange: (settings: QrCodeSettings) => void;
  onUrlChange: (url: string) => void;   
}

// Translations
const translations: Record<string, Record<string, string>> = {
  en: {
    title: 'QR Code Generator',
    urlLabel: 'URL or Text',
    urlPlaceholder: 'https://example.com',
    size: 'Size',
    fgColor: 'Foreground Color',
    bgColor: 'Background Color',
    errorCorrection: 'Error Correction',
    download: 'Download QR Code',
    downloadPng: 'Download PNG',
    downloadSvg: 'Download SVG',
    generate: 'Generate QR Code',
    low: 'Low (7%)',
    medium: 'Medium (15%)',
    quartile: 'Quartile (25%)',
    high: 'High (30%)',
  },
  de: {
    title: 'QR-Code Generator',
    urlLabel: 'URL oder Text',
    urlPlaceholder: 'https://beispiel.de',
    size: 'Größe',
    fgColor: 'Vordergrundfarbe',
    bgColor: 'Hintergrundfarbe',
    errorCorrection: 'Fehlerkorrektur',
    download: 'QR-Code herunterladen',
    downloadPng: 'PNG herunterladen',
    downloadSvg: 'SVG herunterladen',
    generate: 'QR-Code generieren',
    low: 'Niedrig (7%)',
    medium: 'Mittel (15%)',
    quartile: 'Quartil (25%)',
    high: 'Hoch (30%)',
  },
};

// Generate QR code using a simple canvas-based approach
async function generateQrCode(
  text: string,
  settings: QrCodeSettings
): Promise<string> {
  // Use QRCode library if available, otherwise use a fallback
  const QRCode = (await import('qrcode')).default;
  
  const dataUrl = await QRCode.toDataURL(text, {
    width: settings.size,
    color: {
      dark: settings.fgColor,
      light: settings.bgColor,
    },
    errorCorrectionLevel: settings.errorCorrectionLevel,
    margin: 2,
  });
  
  return dataUrl;
}

export async function getQrBlob(
  text: string,
  settings: QrCodeSettings
): Promise<Blob | null> {
  try {
    const QRCode = (await import('qrcode')).default;
    
    const blob = await (QRCode as any).toBlob(text, {
      type: 'image/png',
      width: settings.size,
      color: {
        dark: settings.fgColor,
        light: settings.bgColor,
      },
      errorCorrectionLevel: settings.errorCorrectionLevel,
      margin: 2,
    });
    
    return blob;
  } catch {
    return null;
  }
}

export default forwardRef<{ getQrBlob: () => Promise<Blob | null> }, QrCodeGeneratorProps>(
  function QrCodeGenerator({ initialUrl = '', language = 'en', onQrChange }, ref) {
    const t = (key: string) => translations[language]?.[key] || translations.en[key] || key;

    const [url, setUrl] = useState(initialUrl);
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [settings, setSettings] = useState<QrCodeSettings>({
      size: 256,
      fgColor: '#000000',
      bgColor: '#ffffff',
      errorCorrectionLevel: 'M',
    });
    const [copied, setCopied] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Generate QR code
    const handleGenerate = useCallback(async () => {
      if (!url.trim()) return;

      try {
        const dataUrl = await generateQrCode(url, settings);
        setQrDataUrl(dataUrl);
        onQrChange?.(dataUrl, settings);
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    }, [url, settings, onQrChange]);

    // Download as PNG
    const handleDownloadPng = useCallback(async () => {
      if (!url.trim()) return;

      const blob = await getQrBlob(url, settings);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'qrcode.png';
        a.click();
        URL.revokeObjectURL(url);
      }
    }, [url, settings]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      getQrBlob: async () => {
        if (!url.trim()) return null;
        return getQrBlob(url, settings);
      },
    }), [url, settings]);

    // Generate on mount and when settings change
    useState(() => {
      if (initialUrl) {
        handleGenerate();
      }
    });

    return (
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="p-4 border-b bg-muted/30">
          <h3 className="font-medium flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            {t('title')}
          </h3>
        </div>

        <div className="p-4 grid gap-6 md:grid-cols-2">
          {/* Settings */}
          <div className="space-y-4">
            {/* URL Input */}
            <div className="space-y-2">
              <Label>{t('urlLabel')}</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('urlPlaceholder')}
              />
            </div>

            {/* Size */}
            <div className="space-y-2">
              <Label>{t('size')}: {settings.size}px</Label>
              <Slider
                value={[settings.size]}
                onValueChange={([v]) => setSettings(prev => ({ ...prev, size: v }))}
                min={128}
                max={512}
                step={32}
              />
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('fgColor')}</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.fgColor}
                    onChange={(e) => setSettings(prev => ({ ...prev, fgColor: e.target.value }))}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <Input
                    value={settings.fgColor}
                    onChange={(e) => setSettings(prev => ({ ...prev, fgColor: e.target.value }))}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('bgColor')}</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.bgColor}
                    onChange={(e) => setSettings(prev => ({ ...prev, bgColor: e.target.value }))}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <Input
                    value={settings.bgColor}
                    onChange={(e) => setSettings(prev => ({ ...prev, bgColor: e.target.value }))}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Error Correction */}
            <div className="space-y-2">
              <Label>{t('errorCorrection')}</Label>
              <select
                value={settings.errorCorrectionLevel}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  errorCorrectionLevel: e.target.value as 'L' | 'M' | 'Q' | 'H' 
                }))}
                className="w-full p-2 rounded-lg border bg-background"
              >
                <option value="L">{t('low')}</option>
                <option value="M">{t('medium')}</option>
                <option value="Q">{t('quartile')}</option>
                <option value="H">{t('high')}</option>
              </select>
            </div>

            {/* Generate Button */}
            <Button onClick={handleGenerate} className="w-full" disabled={!url.trim()}>
              <QrCode className="h-4 w-4 mr-2" />
              {t('generate')}
            </Button>
          </div>

          {/* Preview */}
          <div className="flex flex-col items-center justify-center gap-4">
            <div 
              className="border rounded-lg p-4 bg-white"
              style={{ backgroundColor: settings.bgColor }}
            >
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" className="max-w-full" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-muted-foreground">
                  <QrCode className="h-16 w-16 opacity-30" />
                </div>
              )}
            </div>

            {/* Download Buttons */}
            {qrDataUrl && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleDownloadPng}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('downloadPng')}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Hidden canvas for export */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }
);
