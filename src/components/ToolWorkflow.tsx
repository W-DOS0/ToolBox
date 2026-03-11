'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { 
  Upload, 
  FileText, 
  Link as LinkIcon, 
  Type,
  ArrowLeft,
  Check,
  Loader2,
  Image as ImageIcon,
  FileJson,
  Sparkles,
  X,
  Globe,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import HtmlEditor, { HtmlEditorRef } from '@/components/HtmlEditor';
import JsonEditor, { JsonEditorRef } from '@/components/JsonEditor';
import XmlEditor, { XmlEditorRef } from '@/components/XmlEditor';
import RichTextEditor, { RichTextEditorRef } from '@/components/RichTextEditor';
import ImageEditor, { ImageEditorRef } from '@/components/ImageEditor';
import QrCodeGenerator, { getQrBlob } from '@/components/QrCodeGenerator';
import dynamic from 'next/dynamic';
import type { PdfEditorRef, PageState } from '@/components/PdfEditor';
import { 
  detectFileType, 
  detectTextType,
  getEditOperations,
  getExportFormats,
  type DetectedType,
  type DetectedFile,
  type ExportFormat,
} from '@/tools/utils/fileDetection';
import { AdInline } from '@/tools/components/AdSlot';

// Dynamic import for PDF Editor to avoid SSR issues with pdf.js
const PdfEditorDynamic = dynamic(() => import('@/components/PdfEditor'), {
  ssr: false,
  loading: () => <div className="border rounded-xl p-8 text-center text-muted-foreground">Loading PDF Editor...</div>,
});

// Language types and translations
type Language = 'en' | 'de' | 'es' | 'fr' | 'it' | 'pt' | 'ru' | 'zh' | 'ja';

const languages: { code: Language; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
];

const translations: Record<Language, Record<string, string>> = {
  en: {
    toolbox: 'ToolBox',
    subtitle: 'One tool for everything',
    upload: 'Upload',
    edit: 'Edit',
    export: 'Export',
    dropFile: 'Drop file here',
    orClick: 'or click to browse',
    supportedTypes: 'Images, PDF, JSON, CSV, Text and more',
    textInput: 'Paste text, JSON, code or Markdown...',
    urlInput: 'Enter URL for QR code...',
    detected: 'Detected',
    files: 'files',
    file: 'file',
    back: 'Back',
    settings: 'Settings',
    preview: 'Preview',
    continue: 'Continue',
    processing: 'Processing',
    readyExport: 'Ready to Export!',
    chooseFormat: 'Choose format',
    download: 'Download',
    newFile: 'Process new file',
    localProcessing: 'All processing happens locally in your browser. 100% private & secure.',
  },
  de: {
    toolbox: 'ToolBox',
    subtitle: 'Ein Tool für alles',
    upload: 'Hochladen',
    edit: 'Bearbeiten',
    export: 'Export',
    dropFile: 'Datei hier ablegen',
    orClick: 'oder klicken zum Durchsuchen',
    supportedTypes: 'Bilder, PDF, JSON, CSV, Text und mehr',
    textInput: 'Text, JSON, Code oder Markdown einfügen...',
    urlInput: 'URL für QR-Code eingeben...',
    detected: 'Erkannt',
    files: 'Dateien',
    file: 'Datei',
    back: 'Zurück',
    settings: 'Einstellungen',
    preview: 'Vorschau',
    continue: 'Weiter',
    processing: 'Verarbeite',
    readyExport: 'Bereit zum Export!',
    chooseFormat: 'Format wählen',
    download: 'Herunterladen',
    newFile: 'Neue Datei verarbeiten',
    localProcessing: 'Alle Verarbeitung erfolgt lokal in deinem Browser. 100% privat & sicher.',
  },
  es: {
    toolbox: 'ToolBox', subtitle: 'Una herramienta para todo', upload: 'Subir', edit: 'Editar', export: 'Exportar', dropFile: 'Suelta el archivo aquí', orClick: 'o haz clic para explorar', supportedTypes: 'Imágenes, PDF, JSON, CSV, Texto y más', textInput: 'Pega texto, JSON, código o Markdown...', urlInput: 'Introduce URL para código QR...', detected: 'Detectado', files: 'archivos', file: 'archivo', back: 'Atrás', settings: 'Configuración', preview: 'Vista previa', continue: 'Continuar', processing: 'Procesando', readyExport: '¡Listo para exportar!', chooseFormat: 'Elegir formato', download: 'Descargar', newFile: 'Procesar nuevo archivo', localProcessing: 'Todo el procesamiento ocurre localmente en tu navegador. 100% privado y seguro.',
  },
  fr: {
    toolbox: 'ToolBox', subtitle: 'Un outil pour tout', upload: 'Télécharger', edit: 'Modifier', export: 'Exporter', dropFile: 'Déposez le fichier ici', orClick: 'ou cliquez pour parcourir', supportedTypes: 'Images, PDF, JSON, CSV, Texte et plus', textInput: 'Collez texte, JSON, code ou Markdown...', urlInput: 'Entrez URL pour code QR...', detected: 'Détecté', files: 'fichiers', file: 'fichier', back: 'Retour', settings: 'Paramètres', preview: 'Aperçu', continue: 'Continuer', processing: 'Traitement', readyExport: 'Prêt à exporter!', chooseFormat: 'Choisir le format', download: 'Télécharger', newFile: 'Traiter un nouveau fichier', localProcessing: 'Tout le traitement se fait localement dans votre navigateur. 100% privé et sécurisé.',
  },
  it: { toolbox: 'ToolBox', subtitle: 'Uno strumento per tutto', upload: 'Carica', edit: 'Modifica', export: 'Esporta', dropFile: 'Trascina il file qui', orClick: 'o clicca per sfogliare', supportedTypes: 'Immagini, PDF, JSON, CSV, Testo e altro', textInput: 'Incolla testo, JSON, codice o Markdown...', urlInput: 'Inserisci URL per codice QR...', detected: 'Rilevato', files: 'file', file: 'file', back: 'Indietro', settings: 'Impostazioni', preview: 'Anteprima', continue: 'Continua', processing: 'Elaborazione', readyExport: 'Pronto per esportare!', chooseFormat: 'Scegli formato', download: 'Scarica', newFile: 'Elabora nuovo file', localProcessing: 'Tutta l\'elaborazione avviene localmente nel browser. 100% privato e sicuro.' },
  pt: { toolbox: 'ToolBox', subtitle: 'Uma ferramenta para tudo', upload: 'Carregar', edit: 'Editar', export: 'Exportar', dropFile: 'Solte o arquivo aqui', orClick: 'ou clique para navegar', supportedTypes: 'Imagens, PDF, JSON, CSV, Texto e mais', textInput: 'Cole texto, JSON, código ou Markdown...', urlInput: 'Digite URL para código QR...', detected: 'Detectado', files: 'arquivos', file: 'arquivo', back: 'Voltar', settings: 'Configurações', preview: 'Visualizar', continue: 'Continuar', processing: 'Processando', readyExport: 'Pronto para exportar!', chooseFormat: 'Escolher formato', download: 'Baixar', newFile: 'Processar novo arquivo', localProcessing: 'Todo o processamento acontece localmente no navegador. 100% privado e seguro.' },
  ru: { toolbox: 'ToolBox', subtitle: 'Один инструмент для всего', upload: 'Загрузить', edit: 'Редактировать', export: 'Экспорт', dropFile: 'Перетащите файл сюда', orClick: 'или нажмите для просмотра', supportedTypes: 'Изображения, PDF, JSON, CSV, Текст и др.', textInput: 'Вставьте текст, JSON, код или Markdown...', urlInput: 'Введите URL для QR-кода...', detected: 'Обнаружено', files: 'файлов', file: 'файл', back: 'Назад', settings: 'Настройки', preview: 'Предпросмотр', continue: 'Продолжить', processing: 'Обработка', readyExport: 'Готово к экспорту!', chooseFormat: 'Выбрать формат', download: 'Скачать', newFile: 'Обработать новый файл', localProcessing: 'Вся обработка происходит локально в браузере. 100% приватно и безопасно.' },
  zh: { toolbox: 'ToolBox', subtitle: '一个工具搞定一切', upload: '上传', edit: '编辑', export: '导出', dropFile: '将文件拖放到此处', orClick: '或点击浏览', supportedTypes: '图片、PDF、JSON、CSV、文本等', textInput: '粘贴文本、JSON、代码或Markdown...', urlInput: '输入URL生成二维码...', detected: '检测到', files: '个文件', file: '文件', back: '返回', settings: '设置', preview: '预览', continue: '继续', processing: '处理中', readyExport: '准备导出!', chooseFormat: '选择格式', download: '下载', newFile: '处理新文件', localProcessing: '所有处理都在浏览器本地进行。100%私密安全。' },
  ja: { toolbox: 'ToolBox', subtitle: 'すべてを1つのツールで', upload: 'アップロード', edit: '編集', export: 'エクスポート', dropFile: 'ファイルをここにドロップ', orClick: 'またはクリックして参照', supportedTypes: '画像、PDF、JSON、CSV、テキストなど', textInput: 'テキスト、JSON、コード、Markdownを貼り付け...', urlInput: 'QRコードのURLを入力...', detected: '検出済み', files: 'ファイル', file: 'ファイル', back: '戻る', settings: '設定', preview: 'プレビュー', continue: '続行', processing: '処理中', readyExport: 'エクスポート準備完了!', chooseFormat: '形式を選択', download: 'ダウンロード', newFile: '新しいファイルを処理', localProcessing: 'すべての処理はブラウザ内でローカルに行われます。100%プライベートで安全。' },
};

// Step types
type Step = 'input' | 'edit' | 'export';

export default function ToolWorkflow() {
  // Language state - default English
  const [language, setLanguage] = useState<Language>('en');
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  
  // Translation helper
  const t = useCallback((key: string): string => {
    return translations[language][key] || key;
  }, [language]);
  
  const [currentStep, setCurrentStep] = useState<Step>('input');
  const [inputMode, setInputMode] = useState<'file' | 'text' | 'url'>('file');
  const [detectedFiles, setDetectedFiles] = useState<DetectedFile[]>([]);
  const [activeOperations, setActiveOperations] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedData, setProcessedData] = useState<Map<string, Blob>>(new Map());
  const [exportFormat, setExportFormat] = useState<ExportFormat | null>(null);
  
  // Editor states
  const [editorValues, setEditorValues] = useState<Record<string, unknown>>({});
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  
  // Saved editor content for export (stored when clicking Continue)
  const [savedEditorContent, setSavedEditorContent] = useState<{
    html: string;
    markdown: string;
    docxBlob: Blob | null;
  } | null>(null);
  
  // Saved HTML editor content for export
  const [savedHtmlContent, setSavedHtmlContent] = useState<{
    fullHtml: string;
    zipBlob: Blob | null;
  } | null>(null);
  
  // Saved image blob for export
  const [savedImageBlob, setSavedImageBlob] = useState<Blob | null>(null);

  // Refs
  const htmlEditorRef = useRef<HtmlEditorRef>(null);
  const jsonEditorRef = useRef<JsonEditorRef>(null);
  const xmlEditorRef = useRef<XmlEditorRef>(null);
  const richTextEditorRef = useRef<RichTextEditorRef>(null);
  const pdfEditorRef = useRef<PdfEditorRef>(null);
  const imageEditorRef = useRef<ImageEditorRef>(null);

  // PDF Editor state
  const [pdfPageStates, setPdfPageStates] = useState<Map<string, PageState>>(new Map());
  
  // QR Code settings
  const [qrSettings, setQrSettings] = useState<{
    size: number;
    fgColor: string;
    bgColor: string;
    errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  }>({
    size: 256,
    fgColor: '#000000',
    bgColor: '#ffffff',
    errorCorrectionLevel: 'M',
  });

  
  // Get detected type (first file or from text/url)
  const detectedType = detectedFiles[0]?.type || 
    (inputMode === 'text' && textInput ? detectTextType(textInput) : null) ||
    (inputMode === 'url' && urlInput ? 'url' : null);

  const editOperations = detectedType ? getEditOperations(detectedType) : [];
  const exportFormats = detectedType ? getExportFormats(detectedType) : [];

  // File upload handler
  const handleFileDrop = useCallback((files: FileList | null) => {
    if (!files) return;
    
    Array.from(files).forEach(file => {
      const type = detectFileType(file);
      const reader = new FileReader();
      
      reader.onload = () => {
        const detected: DetectedFile = {
          type,
          mimeType: file.type,
          extension: file.name.split('.').pop()?.toLowerCase() || '',
          name: file.name,
          size: file.size,
          file,
          content: (type === 'image' || type === 'pdf') ? undefined : reader.result as string,
          preview: (type === 'image' || type === 'pdf') ? reader.result as string : undefined,
        };
        
        setDetectedFiles(prev => [...prev, detected]);
      };
      
      if (type === 'image' || type === 'pdf') {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
  }, []);

  useEffect(() => {
  if (currentStep === 'input') {
    // SessionStorage komplett leeren
    sessionStorage.removeItem('imageEdits');
    sessionStorage.removeItem('imageHistory');
    sessionStorage.removeItem('imageHistoryIndex');
    sessionStorage.removeItem('pdfEdits');
    sessionStorage.removeItem('editorContent');

    // Lokale States zurücksetzen
    setDetectedFiles([]);
    setActiveOperations([]);
    setProcessedData(new Map());
    setEditorValues({});
    setTextInput('');
    setUrlInput('');
    setProgress(0);
    setExportFormat(null);
    setSavedEditorContent(null);
    setSavedHtmlContent(null);
    setSavedImageBlob(null);
    setPdfPageStates(new Map());

    console.log('Reset everything because we went back to Input step');
  }
}, [currentStep]);


  // Process files
  const handleProcess = async () => {
    setIsProcessing(true);
    setProgress(0);
    
    const total = detectedFiles.length || 1;
    const newProcessed = new Map<string, Blob>();
    
    // Handle HTML content from HtmlEditor - save for later export
    if (detectedType === 'html' && htmlEditorRef.current) {
      const fullHtml = htmlEditorRef.current.getFullHtml();
      const zipBlob = await htmlEditorRef.current.getZipBlob();
      setSavedHtmlContent({
        fullHtml,
        zipBlob,
      });
      setIsProcessing(false);
      setCurrentStep('export');
      return;
    }
    
    // Handle JSON content from JsonEditor
    if (detectedType === 'json' && jsonEditorRef.current) {
      const json = jsonEditorRef.current.getJson();
      const name = detectedFiles[0]?.name || 'data.json';
      newProcessed.set(name, new Blob([json], { type: 'application/json' }));
      
      setProcessedData(newProcessed);
      setIsProcessing(false);
      setCurrentStep('export');
      return;
    }
    
    // Handle XML content from XmlEditor
    if (detectedType === 'xml' && xmlEditorRef.current) {
      const xml = xmlEditorRef.current.getXml();
      const name = detectedFiles[0]?.name || 'data.xml';
      newProcessed.set(name, new Blob([xml], { type: 'application/xml' }));
      
      setProcessedData(newProcessed);
      setIsProcessing(false);
      setCurrentStep('export');
      return;
    }
    
    // Handle PDF content from PdfEditor
    if (detectedType === 'pdf' && pdfEditorRef.current) {
      const pdfBytes = await pdfEditorRef.current.getPdfBytes();
      if (pdfBytes) {
        const name = detectedFiles[0]?.name || 'document.pdf';
        newProcessed.set(name, new Blob([pdfBytes], { type: 'application/pdf' }));
        
        setProcessedData(newProcessed);
        setIsProcessing(false);
        setCurrentStep('export');
      }
      return;
    }
    
    // Handle Image content from ImageEditor
    if (detectedType === 'image' && imageEditorRef.current) {
      // Get the image blob with current quality settings
      const imageBlob = await imageEditorRef.current.getImageBlob();
      if (imageBlob) {
        // Store the blob for later export
        setSavedImageBlob(imageBlob);
        
        // Also store in processedData with original name
        const name = detectedFiles[0]?.name || 'image.png';
        newProcessed.set(name, imageBlob);
        
        setProcessedData(newProcessed);
        setIsProcessing(false);
        setCurrentStep('export');
      }
      return;
    }
    
    // Handle URL/QR Code
    if (detectedType === 'url') {
      const urlText = urlInput || textInput;
      if (urlText) {
        const blob = await getQrBlob(urlText, qrSettings);
        if (blob) {
          newProcessed.set('qrcode.png', blob);
          setProcessedData(newProcessed);
          setIsProcessing(false);
          setCurrentStep('export');
        }
      }
      return;
    }
    
    // Handle text/markdown/csv - SAVE content before moving to export step
    if (detectedType === 'text' || detectedType === 'markdown' || detectedType === 'csv') {
      if (richTextEditorRef.current) {
        const docxBlob = await richTextEditorRef.current.getDocx();
        setSavedEditorContent({
          html: richTextEditorRef.current.getHtml(),
          markdown: richTextEditorRef.current.getMarkdown(),
          docxBlob: docxBlob,
        });
      }
      setIsProcessing(false);
      setCurrentStep('export');
      return;
    }
    
    setProcessedData(newProcessed);
    setIsProcessing(false);
    setCurrentStep('export');
  };

  // Export files
  const handleExport = async () => {
    if (detectedFiles.length === 0) return;
    
    const format = exportFormat || exportFormats[0];
    if (!format) return;

    // Handle HTML export - use saved content
    if (detectedType === 'html') {
      if (!savedHtmlContent) return;
      
      let blob: Blob;
      let extension: string;
      
      if (format.id === 'zip') {
        blob = savedHtmlContent.zipBlob || new Blob([], { type: 'application/zip' });
        extension = 'zip';
      } else {
        blob = new Blob([savedHtmlContent.fullHtml], { type: 'text/html' });
        extension = 'html';
      }
      
      let name = detectedFiles[0]?.name || `project.${extension}`;
      name = name.replace(/\.[^.]+$/, `.${extension}`);
      
      saveAs(blob, name);
      return;
    }

    // Handle text/markdown/csv export - use saved content
    if (detectedType === 'text' || detectedType === 'markdown' || detectedType === 'csv') {
      if (!savedEditorContent) return;
      
      let blob: Blob;
      let extension: string;
      
      if (format.id === 'md') {
        blob = new Blob([savedEditorContent.markdown], { type: 'text/markdown' });
        extension = 'md';
      } else if (format.id === 'html') {
        const fullHtml = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1 { font-size: 2em; margin: 0.5em 0; }
    h2 { font-size: 1.5em; margin: 0.5em 0; }
    h3 { font-size: 1.25em; margin: 0.5em 0; }
    p { margin: 0.5em 0; }
    ul, ol { margin: 0.5em 0; padding-left: 2em; }
    li { margin: 0.25em 0; }
    blockquote { border-left: 4px solid #ccc; padding-left: 1em; margin: 0.5em 0; color: #666; }
    strong { font-weight: bold; }
    em { font-style: italic; }
    u { text-decoration: underline; }
    s { text-decoration: line-through; }
    code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; font-family: monospace; }
  </style>
</head>
<body>
${savedEditorContent.html}
</body>
</html>`;
        blob = new Blob([fullHtml], { type: 'text/html' });
        extension = 'html';
      } else if (format.id === 'docx') {
        blob = savedEditorContent.docxBlob || new Blob([], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        extension = 'docx';
      } else {
        blob = new Blob([savedEditorContent.markdown], { type: 'text/markdown' });
        extension = 'md';
      }
      
      let name = detectedFiles[0]?.name || `document.${extension}`;
      name = name.replace(/\.[^.]+$/, `.${extension}`);
      
      saveAs(blob, name);
      return;
    }

    // Handle image export
    if (detectedType === 'image' && savedImageBlob) {
      const format = exportFormat || exportFormats[0];
      const extension = format?.extension || 'png';
      let name = detectedFiles[0]?.name || `image.${extension}`;
      name = name.replace(/\.[^.]+$/, `.${extension}`);
      saveAs(savedImageBlob, name);
      return;
    }

    if (detectedFiles.length === 1) {
      const originalName = detectedFiles[0].name;
      
      let processedEntry: [string, Blob] | undefined;
      processedData.forEach((blob, name) => {
        if (name.startsWith(originalName.replace(/\.[^.]+$/, '')) || 
            originalName.replace(/\.[^.]+$/, '').startsWith(name.replace(/\.[^.]+$/, ''))) {
          processedEntry = [name, blob];
        }
      });
      
      if (!processedEntry) {
        const blob = processedData.get(originalName);
        if (blob) {
          processedEntry = [originalName, blob];
        }
      }
      
      if (processedEntry) {
        const [name, blob] = processedEntry;
        saveAs(blob, name);
      }
    } else if (detectedFiles.length > 1) {
      const zip = new JSZip();
      processedData.forEach((blob, name) => {
        zip.file(name, blob);
      });
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'export.zip');
    }
  };

  // Reset
  const handleReset = () => {
    setCurrentStep('input');
    setDetectedFiles([]);
    setActiveOperations([]);
    setProcessedData(new Map());
    setEditorValues({});
    setTextInput('');
    setUrlInput('');
    setProgress(0);
    setExportFormat(null);
    setSavedEditorContent(null);
    setSavedHtmlContent(null);
    setSavedImageBlob(null);
    setPdfPageStates(new Map());
  };

  // Auto-detect and proceed to edit step
  useEffect(() => {
    if (detectedFiles.length > 0) {
      if (currentStep === 'input') {
        const timer = setTimeout(() => setCurrentStep('edit'), 500);
        return () => clearTimeout(timer);
      }
    }
  }, [detectedFiles, currentStep]);

  // Global paste listener (Ctrl+V anywhere)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (currentStep !== 'input') return;
      
      const items = e.clipboardData?.items;
      if (items) {
        for (const item of items) {
          if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              const type = detectFileType(file);
              const reader = new FileReader();
              reader.onload = () => {
                const detected: DetectedFile = {
                  type,
                  mimeType: file.type,
                  extension: file.name.split('.').pop()?.toLowerCase() || '',
                  name: file.name || 'pasted-file',
                  size: file.size,
                  file,
                  content: (type === 'image' || type === 'pdf') ? undefined : reader.result as string,
                  preview: (type === 'image' || type === 'pdf') ? reader.result as string : undefined,
                };
                setDetectedFiles(prev => [...prev, detected]);
              };
              if (type === 'image' || type === 'pdf') {
                reader.readAsDataURL(file);
              } else {
                reader.readAsText(file);
              }
              return;
            }
          }
        }
      }
      
      const html = e.clipboardData?.getData('text/html');
      if (html && html.trim()) {
        e.preventDefault();
        const detected: DetectedFile = {
          type: 'html',
          mimeType: 'text/html',
          extension: 'html',
          name: 'pasted-content.html',
          size: html.length,
          content: html,
        };
        setDetectedFiles(prev => [...prev, detected]);
        return;
      }
      
      const text = e.clipboardData?.getData('text');
      if (text && text.trim()) {
        e.preventDefault();
        const type = detectTextType(text);
        const detected: DetectedFile = {
          type,
          mimeType: 'text/plain',
          extension: type === 'json' ? 'json' : 'txt',
          name: `pasted-${type}.${type === 'json' ? 'json' : 'txt'}`,
          size: text.length,
          content: text,
        };
        setDetectedFiles(prev => [...prev, detected]);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [currentStep]);

  // Reset when going back to input step
  const handleBack = useCallback(() => {
    setDetectedFiles([]);
    setActiveOperations([]);
    setProcessedData(new Map());
    setEditorValues({});
    setTextInput('');
    setUrlInput('');
    setProgress(0);
    setExportFormat(null);
    setSavedEditorContent(null);
    setSavedHtmlContent(null);
    setSavedImageBlob(null);
    setPdfPageStates(new Map());
    setCurrentStep('input');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 flex flex-col select-none">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b select-none">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
  <img
    src="/icons/icon-512.png"
    alt="Icon"
    className="h-9 w-9 rounded-xl"
  />
</div>
              <div>
                <h1 className="text-lg font-bold">{t('toolbox')}</h1>
                <p className="text-[10px] text-muted-foreground hidden sm:block">{t('subtitle')}</p>
              </div>
            </a>
            
            {/* Center - Step Indicator */}
            <div className="flex items-center gap-1">
              {(['input', 'edit', 'export'] as Step[]).map((step, i) => (
                <div key={step} className="flex items-center">
                  <div className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                    currentStep === step && 'bg-primary text-primary-foreground shadow-sm',
                    currentStep === 'edit' && step === 'input' && 'bg-primary/20 text-primary',
                    currentStep === 'export' && (step === 'input' || step === 'edit') && 'bg-primary/20 text-primary',
                    currentStep !== step && !['input', 'edit', 'export'].slice(0, ['input', 'edit', 'export'].indexOf(currentStep) + 1).includes(step) && 
                      'bg-muted text-muted-foreground'
                  )}>
                    <span className="w-4 h-4 rounded-full bg-background/20 flex items-center justify-center text-[10px]">
                      {i + 1}
                    </span>
                    <span className="hidden sm:inline capitalize">{t(step === 'input' ? 'upload' : step === 'edit' ? 'edit' : 'export')}</span>
                  </div>
                  {i < 2 && (
                    <div className={cn(
                      'w-3 sm:w-6 h-0.5 mx-0.5',
                      ['input', 'edit', 'export'].indexOf(currentStep) > i ? 'bg-primary' : 'bg-muted'
                    )} />
                  )}
                </div>
              ))}
            </div>
            
            {/* Right - Language Selector */}
            <div className="relative">
              <button
                onClick={() => setShowLangDropdown(!showLangDropdown)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors text-sm"
              >
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">{languages.find(l => l.code === language)?.flag}</span>
                <ChevronDown className="h-3 w-3" />
              </button>
              
              {showLangDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowLangDropdown(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-card border rounded-xl shadow-lg py-1 min-w-[140px]">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setShowLangDropdown(false);
                        }}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 text-sm w-full text-left hover:bg-muted transition-colors',
                          language === lang.code && 'bg-primary/10 text-primary'
                        )}
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        {/* INPUT STEP */}
        {currentStep === 'input' && (
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Simplified File Upload */}
            <div
              onDrop={(e) => { e.preventDefault(); handleFileDrop(e.dataTransfer.files); }}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => document.getElementById('file-input')?.click()}
              className="border-2 border-dashed rounded-2xl p-12 sm:p-16 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
            >
              <input
                id="file-input"
                type="file"
                multiple
                onChange={(e) => handleFileDrop(e.target.files)}
                className="hidden"
              />
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Upload className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('dropFile')}</h3>
              <p className="text-muted-foreground text-sm mb-4">{t('orClick')}</p>
              <div className="flex flex-wrap justify-center gap-1.5 mb-4">
                {['JPG', 'PNG', 'PDF', 'JSON', 'TXT', 'CSV', 'HTML', 'XML'].map((type) => (
                  <Badge key={type} variant="secondary" className="text-[10px] px-2 py-0.5">{type}</Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{t('supportedTypes')}</p>
              <p className="text-xs text-muted-foreground mt-2 opacity-60">Ctrl+V to paste code or images</p>
            </div>

            {/* Preview uploaded files */}
            {detectedFiles.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-sm">{t('detected')} ({detectedFiles.length})</h3>
                <div className="grid gap-1.5">
                  {detectedFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
                      {file.preview ? (
                        <img src={file.preview} alt="" className="w-10 h-10 object-cover rounded" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          <Badge variant="outline" className="mr-1.5 text-[10px]">{file.type}</Badge>
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); setDetectedFiles(prev => prev.filter((_, idx) => idx !== i)); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <AdInline />
          </div>
        )}

        {/* EDIT STEP */}
        {currentStep === 'edit' && (
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Back button */}
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('back')}
            </button>

            {/* Type Badge */}
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-sm px-3 py-0.5">
                {detectedType === 'image' && <ImageIcon className="h-3 w-3 mr-1.5" />}
                {detectedType === 'json' && <FileJson className="h-3 w-3 mr-1.5" />}
                {detectedType === 'pdf' && <FileText className="h-3 w-3 mr-1.5" />}
                {detectedType === 'text' && <Type className="h-3 w-3 mr-1.5" />}
                {detectedType === 'url' && <LinkIcon className="h-3 w-3 mr-1.5" />}
                {detectedType?.toUpperCase()}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {detectedFiles.length > 0 && `${detectedFiles.length} ${t(detectedFiles.length > 1 ? 'files' : 'file')}`}
              </span>
            </div>

            {/* Image Editor - Using Separate Component */}
            {detectedType === 'image' && detectedFiles[0]?.preview && (
              <ImageEditor
                ref={imageEditorRef}
                initialImage={detectedFiles[0].preview}
                language={language}
              />
            )}

            {/* PDF Editor */}
            {detectedType === 'pdf' && detectedFiles[0]?.file && (
              <PdfEditorDynamic
                ref={pdfEditorRef}
                initialFile={detectedFiles[0].file}
                initialPageStates={pdfPageStates}
                onPageStatesChange={setPdfPageStates}
              />
            )}

            {/* JSON Editor */}
            {detectedType === 'json' && detectedFiles[0]?.content && (
              <JsonEditor
                ref={jsonEditorRef}
                initialJson={detectedFiles[0].content}
              />
            )}

            {/* XML Editor */}
            {detectedType === 'xml' && detectedFiles[0]?.content && (
              <XmlEditor
                ref={xmlEditorRef}
                initialContent={detectedFiles[0].content}
              />
            )}

            {/* HTML Editor */}
            {detectedType === 'html' && detectedFiles[0]?.content && (
              <HtmlEditor
                ref={htmlEditorRef}
                initialContent={detectedFiles[0].content}
              />
            )}

            {/* Rich Text Editor for text/markdown/csv */}
            {(detectedType === 'text' || detectedType === 'markdown' || detectedType === 'csv') && detectedFiles[0]?.content && (
              <RichTextEditor
                ref={richTextEditorRef}
                initialContent={detectedFiles[0].content}
                language={language}
              />
            )}

            {/* QR Code Generator */}
            {detectedType === 'url' && (
              <QrCodeGenerator
                url={urlInput || textInput}
                settings={qrSettings}
                onSettingsChange={setQrSettings}
                onUrlChange={setUrlInput}
              />
            )}

            {/* Continue Button */}
            <div className="flex justify-end pt-4">
              <Button
                onClick={handleProcess}
                disabled={isProcessing}
                size="lg"
                className="gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('processing')}...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {t('continue')}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* EXPORT STEP */}
        {currentStep === 'export' && (
          <div className="max-w-md mx-auto space-y-6">
            {/* Back button */}
            <button
              onClick={() => setCurrentStep('edit')}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('back')}
            </button>
            
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">{t('readyExport')}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {detectedFiles.length} {t(detectedFiles.length > 1 ? 'files' : 'file')}
              </p>
            </div>

            {/* Format Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium">{t('chooseFormat')}</label>
              <div className="grid gap-2">
                {exportFormats.map((format) => (
                  <button
                    key={format.id}
                    onClick={() => setExportFormat(format)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                      exportFormat?.id === format.id 
                        ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <span className="text-xs font-bold uppercase">{format.extension}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{format.labelKey}</p>
                      <p className="text-xs text-muted-foreground">.{format.extension}</p>
                    </div>
                    {exportFormat?.id === format.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Download Button */}
            <Button
              onClick={handleExport}
              size="lg"
              className="w-full gap-2"
            >
              <span>{t('download')}</span>
            </Button>

            {/* New File Button */}
            <Button
              variant="outline"
              onClick={handleReset}
              className="w-full"
            >
              {t('newFile')}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              {t('localProcessing')}
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-card/50 py-4">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          <p>{t('localProcessing')}</p>
        </div>
      </footer>
    </div>
  );
}
