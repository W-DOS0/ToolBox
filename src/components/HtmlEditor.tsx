'use client';

import { useState, useCallback, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { 
  Play,
  Copy,
  Check,
  FileCode,
  Code,
  Palette,
  Braces,
  Maximize2,
  Minimize2,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export interface HtmlEditorRef {
  getHtml: () => string;
  getCss: () => string;
  getJs: () => string;
  getFullHtml: () => string;
  getZipBlob: () => Promise<Blob>;
}

interface HtmlEditorProps {
  initialHtml?: string;
  initialCss?: string;
  initialContent?: string;
  initialJs?: string;
  onChange?: (html: string, css: string, js: string) => void;
  language?: string;
}

// Translations
const translations: Record<string, Record<string, string>> = {
  en: {
    html: 'HTML',
    css: 'CSS',
    js: 'JavaScript',
    run: 'Run',
    export: 'Export ZIP',
    copy: 'Copy',
    copied: 'Copied!',
    clear: 'Clear',
    format: 'Format',
    preview: 'Preview',
    lines: 'lines',
    chars: 'chars',
    htmlPlaceholder: '<!DOCTYPE html>\n<html>\n<head>\n  <title>My Page</title>\n</head>\n<body>\n  <h1>Hello World!</h1>\n</body>\n</html>',
    cssPlaceholder: '/* Your CSS here */\nbody {\n  font-family: Arial, sans-serif;\n  margin: 0;\n  padding: 20px;\n}\n\nh1 {\n  color: #333;\n}',
    jsPlaceholder: '// Your JavaScript here\nconsole.log("Hello from JavaScript!");\n\ndocument.addEventListener("DOMContentLoaded", function() {\n  // Your code here\n});',
    openInNewTab: 'Open in New Tab',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit Fullscreen',
    projectReady: 'Project Ready',
    runToPreview: 'Click "Run" to see preview',
  },
  de: {
    html: 'HTML',
    css: 'CSS',
    js: 'JavaScript',
    run: 'Ausführen',
    export: 'ZIP Export',
    copy: 'Kopieren',
    copied: 'Kopiert!',
    clear: 'Löschen',
    format: 'Formatieren',
    preview: 'Vorschau',
    lines: 'Zeilen',
    chars: 'Zeichen',
    htmlPlaceholder: '<!DOCTYPE html>\n<html>\n<head>\n  <title>Meine Seite</title>\n</head>\n<body>\n  <h1>Hallo Welt!</h1>\n</body>\n</html>',
    cssPlaceholder: '/* Dein CSS hier */\nbody {\n  font-family: Arial, sans-serif;\n  margin: 0;\n  padding: 20px;\n}\n\nh1 {\n  color: #333;\n}',
    jsPlaceholder: '// Dein JavaScript hier\nconsole.log("Hallo von JavaScript!");\n\ndocument.addEventListener("DOMContentLoaded", function() {\n  // Dein Code hier\n});',
    openInNewTab: 'In neuem Tab öffnen',
    fullscreen: 'Vollbild',
    exitFullscreen: 'Vollbild beenden',
    projectReady: 'Projekt bereit',
    runToPreview: 'Klicke "Ausführen" für Vorschau',
  },
};

export default forwardRef<HtmlEditorRef, HtmlEditorProps>(function HtmlEditor({ 
  initialHtml = '',
  initialCss = '',
  initialJs = '',
  onChange,
  language = 'en',
}, ref) {
  const t = (key: string) => translations[language]?.[key] || translations.en[key] || key;
  
  const [htmlCode, setHtmlCode] = useState(initialHtml);
  const [cssCode, setCssCode] = useState(initialCss);
  const [jsCode, setJsCode] = useState(initialJs);
  const [activeTab, setActiveTab] = useState<'html' | 'css' | 'js'>('html');
  const [copied, setCopied] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const cssRef = useRef<HTMLTextAreaElement>(null);
  const jsRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);

  // Generate full HTML with embedded CSS and JS
  const generateFullHtml = useCallback(() => {
    const styleTag = cssCode ? `<style>\n${cssCode}\n</style>` : '';
    const scriptTag = jsCode ? `<script>\n${jsCode}\n</script>` : '';
    
    // Check if HTML already has head and body
    const hasHead = /<head[\s>]/i.test(htmlCode);
    const hasBody = /<body[\s>]/i.test(htmlCode);
    
    if (hasHead && hasBody) {
      // Insert style into head and script before </body>
      let result = htmlCode;
      if (cssCode) {
        result = result.replace(/<\/head>/i, `${styleTag}\n</head>`);
      }
      if (jsCode) {
        result = result.replace(/<\/body>/i, `${scriptTag}\n</body>`);
      }
      return result;
    } else {
      // Create a complete HTML structure
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
${styleTag}
</head>
<body>
${htmlCode}
${scriptTag}
</body>
</html>`;
    }
  }, [htmlCode, cssCode, jsCode]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getHtml: () => htmlCode,
    getCss: () => cssCode,
    getJs: () => jsCode,
    getFullHtml: () => generateFullHtml(),
    getZipBlob: async () => {
      const zip = new JSZip();
      
      // Create index.html with links to external files
      const hasHead = /<head[\s>]/i.test(htmlCode);
      const hasBody = /<body[\s>]/i.test(htmlCode);
      
      let indexHtml = htmlCode;
      
      if (hasHead && hasBody) {
        if (cssCode) {
          indexHtml = indexHtml.replace(/<\/head>/i, `  <link rel="stylesheet" href="style.css">\n</head>`);
        }
        if (jsCode) {
          indexHtml = indexHtml.replace(/<\/body>/i, `  <script src="script.js"></script>\n</body>`);
        }
      } else {
        const cssLink = cssCode ? '  <link rel="stylesheet" href="style.css">\n' : '';
        const jsLink = jsCode ? '  <script src="script.js"></script>\n' : '';
        indexHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
${cssLink}</head>
<body>
${htmlCode}
${jsLink}</body>
</html>`;
      }
      
      zip.file('index.html', indexHtml);
      if (cssCode) zip.file('style.css', cssCode);
      if (jsCode) zip.file('script.js', jsCode);
      
      const blob = await zip.generateAsync({ type: 'blob' });
      return blob;
    },
  }), [htmlCode, cssCode, jsCode, generateFullHtml]);

  // Run the code in preview
  const handleRun = useCallback(() => {
    setPreviewKey(prev => prev + 1);
    setHasRun(true);
  }, []);

  // Open in new tab
  const handleOpenInNewTab = useCallback(() => {
    const fullHtml = generateFullHtml();
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [generateFullHtml]);

  // Export as ZIP
  const handleExportZip = useCallback(async () => {
    const zip = new JSZip();
    
    // Create index.html with links to external files
    const hasHead = /<head[\s>]/i.test(htmlCode);
    const hasBody = /<body[\s>]/i.test(htmlCode);
    
    let indexHtml = htmlCode;
    
    if (hasHead && hasBody) {
      if (cssCode) {
        indexHtml = indexHtml.replace(/<\/head>/i, `  <link rel="stylesheet" href="style.css">\n</head>`);
      }
      if (jsCode) {
        indexHtml = indexHtml.replace(/<\/body>/i, `  <script src="script.js"></script>\n</body>`);
      }
    } else {
      const cssLink = cssCode ? '  <link rel="stylesheet" href="style.css">\n' : '';
      const jsLink = jsCode ? '  <script src="script.js"></script>\n' : '';
      indexHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
${cssLink}</head>
<body>
${htmlCode}
${jsLink}</body>
</html>`;
    }
    
    zip.file('index.html', indexHtml);
    if (cssCode) zip.file('style.css', cssCode);
    if (jsCode) zip.file('script.js', jsCode);
    
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, 'project.zip');
  }, [htmlCode, cssCode, jsCode]);

  // Copy to clipboard
  const handleCopy = useCallback(async (type: 'html' | 'css' | 'js') => {
    const text = type === 'html' ? htmlCode : type === 'css' ? cssCode : jsCode;
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }, [htmlCode, cssCode, jsCode]);

  // Clear editor
  const handleClear = useCallback(() => {
    if (activeTab === 'html') setHtmlCode('');
    else if (activeTab === 'css') setCssCode('');
    else setJsCode('');
  }, [activeTab]);

  // Format code (simple indentation fix)
  const handleFormat = useCallback(() => {
    if (activeTab === 'html') {
      const formatted = formatHtml(htmlCode);
      setHtmlCode(formatted);
    } else if (activeTab === 'css') {
      const formatted = formatCss(cssCode);
      setCssCode(formatted);
    } else {
      const formatted = formatJs(jsCode);
      setJsCode(formatted);
    }
  }, [activeTab, htmlCode, cssCode, jsCode]);

  // Simple HTML formatter
  const formatHtml = (html: string): string => {
    let formatted = html
      .replace(/>\s*</g, '>\n<')
      .replace(/</g, '\n<')
      .replace(/>/g, '>\n')
      .split('\n')
      .filter(line => line.trim())
      .join('\n');
    
    let indent = 0;
    const lines = formatted.split('\n');
    formatted = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('</')) indent = Math.max(0, indent - 1);
      const result = '  '.repeat(indent) + trimmed;
      if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.endsWith('/>') && !trimmed.includes('</')) {
        indent++;
      }
      return result;
    }).join('\n');
    
    return formatted;
  };

  // Simple CSS formatter
  const formatCss = (css: string): string => {
    return css
      .replace(/\{/g, ' {\n  ')
      .replace(/;/g, ';\n  ')
      .replace(/\}/g, '\n}\n')
      .replace(/\n\s*\n/g, '\n')
      .replace(/  \}/g, '}')
      .trim();
  };

  // Simple JS formatter
  const formatJs = (js: string): string => {
    return js
      .replace(/\{/g, ' {\n')
      .replace(/\}/g, '\n}\n')
      .replace(/;/g, ';\n')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  };

  // Get current editor content
  const getCurrentCode = () => {
    switch (activeTab) {
      case 'html': return htmlCode;
      case 'css': return cssCode;
      case 'js': return jsCode;
    }
  };

  // Get current line count
  const getLineCount = () => {
    return getCurrentCode().split('\n').length;
  };

  // Get placeholder for current tab
  const getPlaceholder = () => {
    switch (activeTab) {
      case 'html': return t('htmlPlaceholder');
      case 'css': return t('cssPlaceholder');
      case 'js': return t('jsPlaceholder');
    }
  };

  // Notify parent of changes
  useEffect(() => {
    onChange?.(htmlCode, cssCode, jsCode);
  }, [htmlCode, cssCode, jsCode, onChange]);

  return (
    <div className={cn(
      "border rounded-xl bg-card overflow-hidden flex flex-col",
      isFullscreen && "fixed inset-4 z-50"
    )}>
      {/* Toolbar */}
      <div className="border-b bg-muted/30 p-2 flex flex-wrap items-center gap-2">
        {/* Run Button */}
        <Button
          onClick={handleRun}
          size="sm"
          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white"
        >
          <Play className="h-4 w-4" />
          <span>{t('run')}</span>
        </Button>

        {/* Divider */}
        <div className="w-px h-6 bg-border" />

        {/* Open in new tab */}
        <Button
          onClick={handleOpenInNewTab}
          size="sm"
          variant="outline"
          className="flex items-center gap-1.5"
        >
          <ExternalLink className="h-4 w-4" />
          <span className="hidden sm:inline">{t('openInNewTab')}</span>
        </Button>

        {/* Divider */}
        <div className="w-px h-6 bg-border" />

        {/* Copy */}
        <Button
          onClick={() => handleCopy(activeTab)}
          size="sm"
          variant="ghost"
          className="flex items-center gap-1.5"
        >
          {copied === activeTab ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">{copied === activeTab ? t('copied') : t('copy')}</span>
        </Button>

        {/* Format */}
        <Button
          onClick={handleFormat}
          size="sm"
          variant="ghost"
          className="flex items-center gap-1.5"
        >
          <Braces className="h-4 w-4" />
          <span className="hidden sm:inline">{t('format')}</span>
        </Button>

        {/* Clear */}
        <Button
          onClick={handleClear}
          size="sm"
          variant="ghost"
          className="flex items-center gap-1.5"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="hidden sm:inline">{t('clear')}</span>
        </Button>

        {/* Fullscreen toggle */}
        <div className="ml-auto">
          <Button
            onClick={() => setIsFullscreen(!isFullscreen)}
            size="sm"
            variant="ghost"
            className="flex items-center gap-1.5"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0" style={{ height: isFullscreen ? 'calc(100% - 52px)' : '500px' }}>
        {/* Editor Section */}
        <div className="flex-1 flex flex-col border-r min-w-0">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'html' | 'css' | 'js')} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-3 rounded-none border-b bg-muted/30">
              <TabsTrigger value="html" className="flex items-center gap-1.5 data-[state=active]:bg-background">
                <FileCode className="h-4 w-4" />
                <span>{t('html')}</span>
              </TabsTrigger>
              <TabsTrigger value="css" className="flex items-center gap-1.5 data-[state=active]:bg-background">
                <Palette className="h-4 w-4" />
                <span>{t('css')}</span>
              </TabsTrigger>
              <TabsTrigger value="js" className="flex items-center gap-1.5 data-[state=active]:bg-background">
                <Code className="h-4 w-4" />
                <span>{t('js')}</span>
              </TabsTrigger>
            </TabsList>

            {/* HTML Tab */}
            <TabsContent value="html" className="flex-1 mt-0 min-h-0">
              <div className="h-full flex">
                {/* Line Numbers */}
                <div 
                  className="w-12 bg-muted/30 text-right py-3 text-xs font-mono text-muted-foreground select-none overflow-hidden border-r flex-shrink-0"
                >
                  {htmlCode.split('\n').map((_, i) => (
                    <div key={i + 1} className="leading-6 h-6 pr-2">{i + 1}</div>
                  ))}
                </div>
                <textarea
                  ref={htmlRef}
                  value={htmlCode}
                  onChange={(e) => setHtmlCode(e.target.value)}
                  className="flex-1 p-3 font-mono text-sm resize-none outline-none bg-transparent leading-6 min-w-0"
                  placeholder={t('htmlPlaceholder')}
                  spellCheck={false}
                />
              </div>
            </TabsContent>

            {/* CSS Tab */}
            <TabsContent value="css" className="flex-1 mt-0 min-h-0">
              <div className="h-full flex">
                <div 
                  className="w-12 bg-muted/30 text-right py-3 text-xs font-mono text-muted-foreground select-none overflow-hidden border-r flex-shrink-0"
                >
                  {cssCode.split('\n').map((_, i) => (
                    <div key={i + 1} className="leading-6 h-6 pr-2">{i + 1}</div>
                  ))}
                </div>
                <textarea
                  ref={cssRef}
                  value={cssCode}
                  onChange={(e) => setCssCode(e.target.value)}
                  className="flex-1 p-3 font-mono text-sm resize-none outline-none bg-transparent leading-6 min-w-0"
                  placeholder={t('cssPlaceholder')}
                  spellCheck={false}
                />
              </div>
            </TabsContent>

            {/* JS Tab */}
            <TabsContent value="js" className="flex-1 mt-0 min-h-0">
              <div className="h-full flex">
                <div 
                  className="w-12 bg-muted/30 text-right py-3 text-xs font-mono text-muted-foreground select-none overflow-hidden border-r flex-shrink-0"
                >
                  {jsCode.split('\n').map((_, i) => (
                    <div key={i + 1} className="leading-6 h-6 pr-2">{i + 1}</div>
                  ))}
                </div>
                <textarea
                  ref={jsRef}
                  value={jsCode}
                  onChange={(e) => setJsCode(e.target.value)}
                  className="flex-1 p-3 font-mono text-sm resize-none outline-none bg-transparent leading-6 min-w-0"
                  placeholder={t('jsPlaceholder')}
                  spellCheck={false}
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Status Bar */}
          <div className="border-t bg-muted/30 px-4 py-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>{getLineCount()} {t('lines')}</span>
              <span>{getCurrentCode().length} {t('chars')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="uppercase">{activeTab}</span>
            </div>
          </div>
        </div>

        {/* Preview Section */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="border-b bg-muted/30 px-4 py-2 text-sm font-medium flex items-center gap-2">
            <Play className="h-4 w-4" />
            {t('preview')}
          </div>
          <div className="flex-1 bg-white dark:bg-gray-900 relative">
            {hasRun ? (
              <iframe
                key={previewKey}
                ref={previewRef}
                srcDoc={generateFullHtml()}
                className="w-full h-full border-0"
                title="Preview"
                sandbox="allow-scripts allow-same-origin"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Play className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>{t('runToPreview')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
