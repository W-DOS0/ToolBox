'use client';

import { useState, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { 
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  FileCode,
  Minimize2,
  Expand,
  Shrink,
  Search,
  X,
  AlignLeft,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface XmlEditorRef {
  getXml: () => string;
  getText: () => string;
}

interface XmlEditorProps {
  initialXml?: string;
  onChange?: (xml: string) => void;
  language?: string;
  initialContent?: string;
}

// XML tree node
interface XmlTreeNode {
  type: 'element' | 'text' | 'comment' | 'cdata';
  tagName?: string;
  attributes?: Record<string, string>;
  children?: XmlTreeNode[];
  value?: string;
  path: string;
  depth: number;
}

// Syntax highlighting colors
const syntaxColors = {
  tag: 'text-blue-600 dark:text-blue-400',
  attrName: 'text-purple-600 dark:text-purple-400',
  attrValue: 'text-green-600 dark:text-green-400',
  text: 'text-gray-700 dark:text-gray-300',
  comment: 'text-gray-500 dark:text-gray-400 italic',
  cdata: 'text-orange-600 dark:text-orange-400',
  error: 'text-red-500 dark:text-red-400',
};

// Translations
const translations: Record<string, Record<string, string>> = {
  en: {
    format: 'Format',
    minify: 'Minify',
    validXml: 'Valid XML',
    invalidXml: 'Invalid XML',
    search: 'Search...',
    expandAll: 'Expand All',
    collapseAll: 'Collapse All',
    copyXml: 'Copy XML',
    copyPath: 'Copy Path',
    copyValue: 'Copy Value',
    lines: 'lines',
    chars: 'chars',
    searchResults: 'results',
    attributes: 'attributes',
  },
  de: {
    format: 'Formatieren',
    minify: 'Komprimieren',
    validXml: 'Gültiges XML',
    invalidXml: 'Ungültiges XML',
    search: 'Suchen...',
    expandAll: 'Alle aufklappen',
    collapseAll: 'Alle einklappen',
    copyXml: 'XML kopieren',
    copyPath: 'Pfad kopieren',
    copyValue: 'Wert kopieren',
    lines: 'Zeilen',
    chars: 'Zeichen',
    searchResults: 'Ergebnisse',
    attributes: 'Attribute',
  },
};

// Simple XML parser (browser native)
function parseXml(xmlString: string): Document | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    const errorNode = doc.querySelector('parsererror');
    if (errorNode) {
      return null;
    }
    return doc;
  } catch {
    return null;
  }
}

// Build tree structure from DOM
function buildXmlTree(node: Node, path = '/', depth = 0): XmlTreeNode[] {
  const result: XmlTreeNode[] = [];

  node.childNodes.forEach((child, index) => {
    const childPath = `${path}/${child.nodeName || 'text'}[${index}]`;

    if (child.nodeType === Node.ELEMENT_NODE) {
      const element = child as Element;
      const attributes: Record<string, string> = {};
      element.getAttributeNames().forEach(name => {
        attributes[name] = element.getAttribute(name) || '';
      });

      // Check if element has only text content
      const hasOnlyText = Array.from(element.childNodes).every(
        n => n.nodeType === Node.TEXT_NODE && !n.textContent?.trim()
      ) || (element.childNodes.length === 1 && element.childNodes[0].nodeType === Node.TEXT_NODE);

      const treeNode: XmlTreeNode = {
        type: 'element',
        tagName: element.nodeName,
        attributes,
        children: hasOnlyText ? undefined : buildXmlTree(element, childPath, depth + 1),
        value: hasOnlyText && element.childNodes[0] ? element.childNodes[0].textContent || '' : undefined,
        path: childPath,
        depth,
      };
      result.push(treeNode);
    } else if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
      result.push({
        type: 'text',
        value: child.textContent.trim(),
        path: childPath,
        depth,
      });
    } else if (child.nodeType === Node.COMMENT_NODE) {
      result.push({
        type: 'comment',
        value: child.textContent || '',
        path: childPath,
        depth,
      });
    } else if (child.nodeType === Node.CDATA_SECTION_NODE) {
      result.push({
        type: 'cdata',
        value: child.textContent || '',
        path: childPath,
        depth,
      });
    }
  });

  return result;
}

// Collect all paths from XML tree
function collectAllPaths(nodes: XmlTreeNode[]): string[] {
  const paths: string[] = [];
  nodes.forEach(node => {
    paths.push(node.path);
    if (node.children) {
      paths.push(...collectAllPaths(node.children));
    }
  });
  return paths;
}

// Format XML with indentation
function formatXml(xml: string, indentSize: number): string {
  try {
    const doc = parseXml(xml);
    if (!doc) return xml;

    const indent = ' '.repeat(indentSize);
    let formatted = '';
    let depth = 0;
    let isInlineElement = false;

    // Serialize to string first
    const serializer = new XMLSerializer();
    let xmlStr = serializer.serializeToString(doc);

    // Remove existing whitespace between tags
    xmlStr = xmlStr.replace(/>\s+</g, '><').trim();

    // Process character by character with state tracking
    let i = 0;
    while (i < xmlStr.length) {
      // Processing instruction <?...?>
      if (xmlStr[i] === '<' && xmlStr[i + 1] === '?') {
        const endIdx = xmlStr.indexOf('?>', i);
        if (endIdx !== -1) {
          formatted += indent.repeat(depth) + xmlStr.slice(i, endIdx + 2) + '\n';
          i = endIdx + 2;
          continue;
        }
      }

      // Comment <!--...-->
      if (xmlStr[i] === '<' && xmlStr[i + 1] === '!') {
        const endIdx = xmlStr.indexOf('-->', i);
        if (endIdx !== -1) {
          formatted += indent.repeat(depth) + xmlStr.slice(i, endIdx + 3) + '\n';
          i = endIdx + 3;
          continue;
        }
      }

      // Closing tag </...>
      if (xmlStr[i] === '<' && xmlStr[i + 1] === '/') {
        const endIdx = xmlStr.indexOf('>', i);
        if (endIdx !== -1) {
          if (!isInlineElement) {
            depth = Math.max(0, depth - 1);
          }
          isInlineElement = false;
          formatted += indent.repeat(depth) + xmlStr.slice(i, endIdx + 1) + '\n';
          i = endIdx + 1;
          continue;
        }
      }

      // Opening tag <...> or self-closing <.../>
      if (xmlStr[i] === '<') {
        const endIdx = xmlStr.indexOf('>', i);
        if (endIdx !== -1) {
          const tagContent = xmlStr.slice(i, endIdx + 1);
          
          // Self-closing tag
          if (tagContent.endsWith('/>')) {
            formatted += indent.repeat(depth) + tagContent + '\n';
            i = endIdx + 1;
            continue;
          }

          // Regular opening tag
          formatted += indent.repeat(depth) + tagContent;
          i = endIdx + 1;
          
          // Check what follows: text content or another tag
          let textContent = '';
          while (i < xmlStr.length && xmlStr[i] !== '<') {
            textContent += xmlStr[i];
            i++;
          }
          
          if (textContent.trim()) {
            formatted += textContent.trim();
            isInlineElement = true;
          } else {
            formatted += '\n';
            depth++;
            isInlineElement = false;
          }
          continue;
        }
      }

      formatted += xmlStr[i];
      i++;
    }

    return formatted.trim();
  } catch {
    return xml;
  }
}

// Minify XML
function minifyXml(xml: string): string {
  return xml
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
}

export default forwardRef<XmlEditorRef, XmlEditorProps>(function XmlEditor({ 
  initialXml = '', 
  onChange,
  language = 'en',
}, ref) {
  const t = (key: string) => translations[language]?.[key] || translations.en[key] || key;
  
  const [xmlText, setXmlText] = useState(initialXml);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['/']));
  const [searchQuery, setSearchQuery] = useState('');
  
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getXml: () => xmlText,
    getText: () => xmlText,
  }), [xmlText]);

  // Validation state
  const validationState = useMemo(() => {
    if (!xmlText.trim()) return { isValid: true, error: null };
    const doc = parseXml(xmlText);
    if (doc) {
      return { isValid: true, error: null };
    }
    return { isValid: false, error: 'Invalid XML' };
  }, [xmlText]);

  // Parse XML
  const parsedXml = useMemo(() => {
    if (!xmlText.trim()) return null;
    return parseXml(xmlText);
  }, [xmlText]);

  // Build tree
  const tree = useMemo(() => {
    if (!parsedXml) return [];
    return buildXmlTree(parsedXml);
  }, [parsedXml]);

  // Format XML
  const handleFormat = useCallback(() => {
    const formatted = formatXml(xmlText, 2);
    setXmlText(formatted);
    onChange?.(formatted);
    setExpandedPaths(new Set(['/']));
  }, [xmlText, onChange]);

  // Minify XML
  const handleMinify = useCallback(() => {
    const minified = minifyXml(xmlText);
    setXmlText(minified);
    onChange?.(minified);
  }, [xmlText, onChange]);

  // Expand all nodes
  const handleExpandAll = useCallback(() => {
    if (tree.length > 0) {
      const allPaths = collectAllPaths(tree);
      setExpandedPaths(new Set(['/', ...allPaths]));
    }
  }, [tree]);

  // Collapse all nodes
  const handleCollapseAll = useCallback(() => {
    setExpandedPaths(new Set(['/']));
  }, []);

  // Copy XML to clipboard
  const handleCopyXml = useCallback(async () => {
    await navigator.clipboard.writeText(xmlText);
    setCopiedPath('xml');
    setTimeout(() => setCopiedPath(null), 2000);
  }, [xmlText]);

  // Copy to clipboard
  const copyToClipboard = useCallback(async (text: string, path?: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedPath(path || 'copied');
    setTimeout(() => setCopiedPath(null), 2000);
  }, []);

  // Toggle node expansion
  const toggleNode = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Handle text input
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setXmlText(newText);
    onChange?.(newText);
  }, [onChange]);

  // Sync scroll between line numbers and text area
  const handleScroll = useCallback(() => {
    if (textAreaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textAreaRef.current.scrollTop;
    }
  }, []);

  // Line count
  const lineCount = xmlText.split('\n').length;

  // Search in tree
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !tree.length) return [];
    const results: string[] = [];
    const lowerQuery = searchQuery.toLowerCase();
    
    const search = (nodes: XmlTreeNode[]) => {
      nodes.forEach(node => {
        if (node.tagName?.toLowerCase().includes(lowerQuery)) {
          results.push(node.path);
        }
        if (node.value?.toLowerCase().includes(lowerQuery)) {
          results.push(node.path);
        }
        if (node.attributes) {
          Object.entries(node.attributes).forEach(([key, value]) => {
            if (key.toLowerCase().includes(lowerQuery) || value.toLowerCase().includes(lowerQuery)) {
              results.push(node.path);
            }
          });
        }
        if (node.children) {
          search(node.children);
        }
      });
    };
    
    search(tree);
    return results;
  }, [searchQuery, tree]);

  // Render tree node
  const renderTreeNode = (node: XmlTreeNode, index: number): React.ReactNode => {
    const isExpanded = expandedPaths.has(node.path);
    const hasChildren = node.children && node.children.length > 0;
    const isSearchMatch = searchResults.includes(node.path);

    if (node.type === 'comment') {
      return (
        <div 
          key={`${node.path}-${index}`}
          className="px-2 py-0.5 text-xs italic text-gray-500"
          style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
        >
          {/* <!-- {node.value} --> */}
        </div>
      );
    }

    if (node.type === 'text' && !node.tagName) {
      return (
        <div 
          key={`${node.path}-${index}`}
          className={cn("px-2 py-0.5 text-xs", syntaxColors.text)}
          style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
        >
          {node.value}
        </div>
      );
    }

    return (
      <div key={`${node.path}-${index}`} className="select-none">
        <div 
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 hover:bg-muted/50 cursor-pointer group',
            isSearchMatch && 'bg-yellow-100 dark:bg-yellow-900/30',
          )}
          style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
          onClick={() => hasChildren && toggleNode(node.path)}
        >
          {/* Expand/Collapse button */}
          {hasChildren ? (
            <button className="p-0.5 hover:bg-muted rounded">
              {isExpanded ? 
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : 
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              }
            </button>
          ) : (
            <span className="w-4" />
          )}
          
          {/* Tag icon */}
          <Tag className="h-3.5 w-3.5 text-blue-500" />
          
          {/* Tag name */}
          <span className={syntaxColors.tag}>{node.tagName}</span>
          
          {/* Attributes */}
          {node.attributes && Object.keys(node.attributes).length > 0 && (
            <span className="text-xs">
              {Object.entries(node.attributes).slice(0, 2).map(([key, value]) => (
                <span key={key}>
                  {' '}
                  <span className={syntaxColors.attrName}>{key}</span>=
                  <span className={syntaxColors.attrValue}>"{value}"</span>
                </span>
              ))}
              {Object.keys(node.attributes).length > 2 && (
                <span className="text-muted-foreground"> +{Object.keys(node.attributes).length - 2}</span>
              )}
            </span>
          )}
          
          {/* Value indicator or count */}
          {node.value ? (
            <span className={cn("text-xs ml-1 truncate max-w-[100px]", syntaxColors.text)}>
              {node.value}
            </span>
          ) : hasChildren ? (
            <span className="text-xs text-muted-foreground ml-1">
              ({node.children!.length})
            </span>
          ) : null}
          
          {/* Actions */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 ml-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(node.path, node.path);
              }}
              className="p-1 hover:bg-muted rounded"
              title={t('copyPath')}
            >
              {copiedPath === node.path ? 
                <Check className="h-3 w-3 text-green-500" /> : 
                <Copy className="h-3 w-3 text-muted-foreground" />
              }
            </button>
          </div>
        </div>
        
        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map((child, i) => renderTreeNode(child, i))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="border-b bg-muted/30 p-2">
        <div className="flex flex-wrap items-center gap-1">
          {/* Format */}
          <button
            onClick={handleFormat}
            disabled={!validationState.isValid || !xmlText.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('format')}
          >
            <AlignLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t('format')}</span>
          </button>

          {/* Minify */}
          <button
            onClick={handleMinify}
            disabled={!validationState.isValid || !xmlText.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('minify')}
          >
            <Minimize2 className="h-4 w-4" />
            <span className="hidden sm:inline">{t('minify')}</span>
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-border mx-1" />

          {/* Expand All */}
          <button
            onClick={handleExpandAll}
            disabled={!parsedXml}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('expandAll')}
          >
            <Expand className="h-4 w-4" />
            <span className="hidden sm:inline">{t('expandAll')}</span>
          </button>

          {/* Collapse All */}
          <button
            onClick={handleCollapseAll}
            disabled={!parsedXml}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('collapseAll')}
          >
            <Shrink className="h-4 w-4" />
            <span className="hidden sm:inline">{t('collapseAll')}</span>
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-border mx-1" />

          {/* Copy XML */}
          <button
            onClick={handleCopyXml}
            disabled={!xmlText.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('copyXml')}
          >
            {copiedPath === 'xml' ? 
              <Check className="h-4 w-4 text-green-500" /> : 
              <Copy className="h-4 w-4" />
            }
            <span className="hidden sm:inline">{t('copyXml')}</span>
          </button>

          {/* Search */}
          <div className="flex-1 flex justify-end">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('search')}
                className="pl-8 pr-8 py-1.5 text-xs rounded-lg bg-muted border-0 outline-none w-40 focus:w-56 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
              {searchResults.length > 0 && (
                <span className="absolute -right-16 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {searchResults.length} {t('searchResults')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex" style={{ height: '400px' }}>
        {/* Text Editor */}
        <div className="flex-1 flex overflow-hidden border-r">
          {/* Line Numbers */}
          <div 
            ref={lineNumbersRef}
            className="w-12 bg-muted/30 text-right pr-2 py-3 text-xs font-mono text-muted-foreground select-none overflow-hidden border-r"
          >
            {Array.from({ length: lineCount }).map((_, i) => (
              <div key={i + 1} className="leading-6 h-6">{i + 1}</div>
            ))}
          </div>
          
          {/* Text Area */}
          <div className="flex-1 relative">
            <textarea
              ref={textAreaRef}
              value={xmlText}
              onChange={handleTextChange}
              onScroll={handleScroll}
              className="w-full h-full p-3 font-mono text-sm resize-none outline-none bg-transparent leading-6"
              placeholder='<?xml version="1.0"?>'
              spellCheck={false}
            />
          </div>
        </div>

        {/* Tree View */}
        <div className="flex-1 overflow-auto p-2 bg-muted/10">
          {parsedXml ? (
            <div className="font-mono text-sm">
              {tree.map((node, i) => renderTreeNode(node, i))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              {xmlText ? t('invalidXml') : 'Enter XML to see tree view'}
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="border-t bg-muted/30 px-4 py-1.5 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>{lineCount} {t('lines')}</span>
          <span>{xmlText.length} {t('chars')}</span>
          {validationState.isValid ? (
            <span className="text-green-600 dark:text-green-400">{t('validXml')}</span>
          ) : (
            <span className="text-red-500" title={validationState.error || ''}>{t('invalidXml')}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {parsedXml && parsedXml.documentElement && (
            <span>
              Root: &lt;{parsedXml.documentElement.nodeName}&gt;
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
