'use client';

import { useState, useCallback, useMemo, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { 
  Copy,
  Check,
  FileJson,
  Minimize2,
  Expand,
  Shrink,
  Search,
  X,
  AlignLeft,
  Braces,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface JsonEditorRef {
  getJson: () => string;
  getText: () => string;
}

interface JsonEditorProps {
  initialJson?: string;
  onChange?: (json: string) => void;
  language?: string;
}

// Syntax highlighting colors
const syntaxColors = {
  key: 'text-purple-600 dark:text-purple-400',
  string: 'text-green-600 dark:text-green-400',
  number: 'text-orange-600 dark:text-orange-400',
  boolean: 'text-blue-600 dark:text-blue-400',
  null: 'text-red-600 dark:text-red-400',
  bracket: 'text-gray-700 dark:text-gray-300',
};

// Translations
const translations: Record<string, Record<string, string>> = {
  en: {
    format: 'Format',
    minify: 'Minify',
    validJson: 'Valid JSON',
    invalidJson: 'Invalid JSON',
    search: 'Search...',
    expandAll: 'Expand All',
    collapseAll: 'Collapse All',
    copyJson: 'Copy JSON',
    copyPath: 'Copy Path',
    copyValue: 'Copy Value',
    lines: 'lines',
    chars: 'chars',
    searchResults: 'results',
    items: 'items',
  },
  de: {
    format: 'Formatieren',
    minify: 'Komprimieren',
    validJson: 'Gültiges JSON',
    invalidJson: 'Ungültiges JSON',
    search: 'Suchen...',
    expandAll: 'Alle aufklappen',
    collapseAll: 'Alle einklappen',
    copyJson: 'JSON kopieren',
    copyPath: 'Pfad kopieren',
    copyValue: 'Wert kopieren',
    lines: 'Zeilen',
    chars: 'Zeichen',
    searchResults: 'Ergebnisse',
    items: 'Einträge',
  },
};

// JSON tree node
interface JsonTreeNode {
  key: string;
  value: unknown;
  path: string;
  depth: number;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
}

// Parse JSON into tree structure
function parseJsonTree(data: unknown, path = '$', depth = 0): JsonTreeNode[] {
  if (data === null) {
    return [{ key: '', value: null, path, depth, type: 'null' }];
  }
  
  if (Array.isArray(data)) {
    return data.map((item, index) => {
      const childPath = `${path}[${index}]`;
      const type = Array.isArray(item) ? 'array' : item === null ? 'null' : typeof item as 'object' | 'string' | 'number' | 'boolean';
      return {
        key: String(index),
        value: item,
        path: childPath,
        depth,
        type,
      };
    });
  }
  
  if (typeof data === 'object' && data !== null) {
    return Object.entries(data).map(([key, value]) => {
      const childPath = path === '$' ? `$.${key}` : `${path}.${key}`;
      const type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value as 'object' | 'string' | 'number' | 'boolean';
      return {
        key,
        value,
        path: childPath,
        depth,
        type,
      };
    });
  }
  
  return [];
}

// Format JSON with indentation
function formatJson(json: string, indent: number): string {
  try {
    const parsed = JSON.parse(json);
    return JSON.stringify(parsed, null, indent);
  } catch {
    return json;
  }
}

// Minify JSON
function minifyJson(json: string): string {
  try {
    const parsed = JSON.parse(json);
    return JSON.stringify(parsed);
  } catch {
    return json;
  }
}

export default forwardRef<JsonEditorRef, JsonEditorProps>(function JsonEditor({ 
  initialJson = '', 
  onChange,
  language = 'en',
}, ref) {
  const t = (key: string) => translations[language]?.[key] || translations.en[key] || key;
  
  const [jsonText, setJsonText] = useState(initialJson);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['$']));
  const [searchQuery, setSearchQuery] = useState('');
  
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getJson: () => jsonText,
    getText: () => jsonText,
  }), [jsonText]);

  // Validation state
  const validationState = useMemo(() => {
    if (!jsonText.trim()) return { isValid: true, error: null };
    try {
      JSON.parse(jsonText);
      return { isValid: true, error: null };
    } catch (e) {
      return { isValid: false, error: (e as Error).message };
    }
  }, [jsonText]);

  // Parse JSON
  const parsedJson = useMemo(() => {
    if (!jsonText.trim() || !validationState.isValid) return null;
    try {
      return JSON.parse(jsonText);
    } catch {
      return null;
    }
  }, [jsonText, validationState.isValid]);

  // Build tree
  const tree = useMemo(() => {
    if (!parsedJson) return [];
    return parseJsonTree(parsedJson);
  }, [parsedJson]);

  // Count items
  const itemCount = useMemo(() => {
    if (!parsedJson) return 0;
    const count = (obj: unknown): number => {
      if (Array.isArray(obj)) return obj.reduce((sum, item) => sum + count(item), 0);
      if (obj && typeof obj === 'object') return Object.values(obj).reduce((sum: number, item) => sum + count(item), 0);
      return 1;
    };
    return count(parsedJson);
  }, [parsedJson]);

  // Format JSON
  const handleFormat = useCallback(() => {
    const formatted = formatJson(jsonText, 2);
    setJsonText(formatted);
    onChange?.(formatted);
    setExpandedPaths(new Set(['$']));
  }, [jsonText, onChange]);

  // Minify JSON
  const handleMinify = useCallback(() => {
    const minified = minifyJson(jsonText);
    setJsonText(minified);
    onChange?.(minified);
  }, [jsonText, onChange]);

  // Expand all nodes
  const handleExpandAll = useCallback(() => {
    if (!parsedJson) return;
    const allPaths = new Set<string>();
    const collectPaths = (obj: unknown, path = '$') => {
      allPaths.add(path);
      if (Array.isArray(obj)) {
        obj.forEach((item, i) => collectPaths(item, `${path}[${i}]`));
      } else if (obj && typeof obj === 'object') {
        Object.entries(obj).forEach(([key, val]) => {
          const childPath = path === '$' ? `$.${key}` : `${path}.${key}`;
          collectPaths(val, childPath);
        });
      }
    };
    collectPaths(parsedJson);
    setExpandedPaths(allPaths);
  }, [parsedJson]);

  // Collapse all nodes
  const handleCollapseAll = useCallback(() => {
    setExpandedPaths(new Set(['$']));
  }, []);

  // Copy JSON to clipboard
  const handleCopyJson = useCallback(async () => {
    await navigator.clipboard.writeText(jsonText);
    setCopiedPath('json');
    setTimeout(() => setCopiedPath(null), 2000);
  }, [jsonText]);

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
    setJsonText(newText);
    onChange?.(newText);
  }, [onChange]);

  // Sync scroll between line numbers and text area
  const handleScroll = useCallback(() => {
    if (textAreaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textAreaRef.current.scrollTop;
    }
  }, []);

  // Line count
  const lineCount = jsonText.split('\n').length;

  // Search in JSON
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !parsedJson) return [];
    const results: string[] = [];
    const lowerQuery = searchQuery.toLowerCase();
    
    const search = (obj: unknown, path = '$') => {
      if (obj === null) return;
      if (typeof obj === 'string' && obj.toLowerCase().includes(lowerQuery)) {
        results.push(path);
      } else if (typeof obj === 'number' && String(obj).includes(lowerQuery)) {
        results.push(path);
      } else if (typeof obj === 'boolean' && String(obj).toLowerCase().includes(lowerQuery)) {
        results.push(path);
      } else if (Array.isArray(obj)) {
        obj.forEach((item, i) => search(item, `${path}[${i}]`));
      } else if (typeof obj === 'object') {
        Object.entries(obj).forEach(([key, val]) => {
          const childPath = path === '$' ? `$.${key}` : `${path}.${key}`;
          if (key.toLowerCase().includes(lowerQuery)) {
            results.push(childPath);
          }
          search(val, childPath);
        });
      }
    };
    
    search(parsedJson);
    return results;
  }, [searchQuery, parsedJson]);

  // Expand paths that contain search matches
  useEffect(() => {
    if (searchResults.length > 0 && parsedJson) {
      // Collect all parent paths that need to be expanded
      const pathsToExpand = new Set<string>(['$']);
      
      searchResults.forEach(resultPath => {
        // Add all parent paths
        const parts = resultPath.replace(/^\$/, '').split(/\.|\[|\]/).filter(Boolean);
        let currentPath = '$';
        parts.forEach(part => {
          pathsToExpand.add(currentPath);
          if (part.match(/^\d+$/)) {
            currentPath = `${currentPath}[${part}]`;
          } else {
            currentPath = currentPath === '$' ? `$.${part}` : `${currentPath}.${part}`;
          }
          pathsToExpand.add(currentPath);
        });
      });
      
      setExpandedPaths(prev => {
        const newSet = new Set(prev);
        pathsToExpand.forEach(p => newSet.add(p));
        return newSet;
      });
    }
  }, [searchResults, parsedJson]);

  // Render tree node
  const renderTreeNode = (node: JsonTreeNode, index: number): React.ReactNode => {
    const isExpanded = expandedPaths.has(node.path);
    const isSearchMatch = searchResults.includes(node.path);
    const hasChildren = (node.type === 'object' || node.type === 'array') && 
      ((Array.isArray(node.value) && node.value.length > 0) ||
       (typeof node.value === 'object' && node.value !== null && Object.keys(node.value).length > 0));

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
                <span className="text-muted-foreground text-xs">▼</span> : 
                <span className="text-muted-foreground text-xs">▶</span>
              }
            </button>
          ) : (
            <span className="w-4" />
          )}
          
          {/* Key */}
          <span className={syntaxColors.key}>{node.key}</span>
          <span className="text-muted-foreground">:</span>
          
          {/* Value preview */}
          {node.type === 'string' && (
            <span className={syntaxColors.string}>"{String(node.value).slice(0, 50)}{String(node.value).length > 50 ? '...' : ''}"</span>
          )}
          {node.type === 'number' && (
            <span className={syntaxColors.number}>{String(node.value)}</span>
          )}
          {node.type === 'boolean' && (
            <span className={syntaxColors.boolean}>{String(node.value)}</span>
          )}
          {node.type === 'null' && (
            <span className={syntaxColors.null}>null</span>
          )}
          {node.type === 'array' && (
            <span className="text-muted-foreground">
              [{Array.isArray(node.value) ? node.value.length : 0}]
            </span>
          )}
          {node.type === 'object' && (
            <span className="text-muted-foreground">
              {'{'}{typeof node.value === 'object' && node.value !== null ? Object.keys(node.value).length : 0}{'}'}
            </span>
          )}
          
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
            {parseJsonTree(node.value, node.path, node.depth + 1).map((child, i) => renderTreeNode(child, i))}
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
            disabled={!validationState.isValid || !jsonText.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('format')}
          >
            <AlignLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t('format')}</span>
          </button>

          {/* Minify */}
          <button
            onClick={handleMinify}
            disabled={!validationState.isValid || !jsonText.trim()}
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
            disabled={!parsedJson}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('expandAll')}
          >
            <Expand className="h-4 w-4" />
            <span className="hidden sm:inline">{t('expandAll')}</span>
          </button>

          {/* Collapse All */}
          <button
            onClick={handleCollapseAll}
            disabled={!parsedJson}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('collapseAll')}
          >
            <Shrink className="h-4 w-4" />
            <span className="hidden sm:inline">{t('collapseAll')}</span>
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-border mx-1" />

          {/* Copy JSON */}
          <button
            onClick={handleCopyJson}
            disabled={!jsonText.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('copyJson')}
          >
            {copiedPath === 'json' ? 
              <Check className="h-4 w-4 text-green-500" /> : 
              <Copy className="h-4 w-4" />
            }
            <span className="hidden sm:inline">{t('copyJson')}</span>
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
              value={jsonText}
              onChange={handleTextChange}
              onScroll={handleScroll}
              className="w-full h-full p-3 font-mono text-sm resize-none outline-none bg-transparent leading-6"
              placeholder='{"key": "value"}'
              spellCheck={false}
            />
          </div>
        </div>

        {/* Tree View */}
        <div className="flex-1 overflow-auto p-2 bg-muted/10">
          {parsedJson ? (
            <div className="font-mono text-sm">
              {tree.map((node, i) => renderTreeNode(node, i))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              {jsonText ? t('invalidJson') : 'Enter JSON to see tree view'}
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="border-t bg-muted/30 px-4 py-1.5 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>{lineCount} {t('lines')}</span>
          <span>{jsonText.length} {t('chars')}</span>
          <span>{itemCount} {t('items')}</span>
          {validationState.isValid ? (
            <span className="text-green-600 dark:text-green-400">{t('validJson')}</span>
          ) : (
            <span className="text-red-500" title={validationState.error || ''}>{t('invalidJson')}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <FileJson className="h-4 w-4" />
          <span>JSON</span>
        </div>
      </div>
    </div>
  );
});
