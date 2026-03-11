'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { searchTools } from '../registry';
import * as LucideIcons from 'lucide-react';
import type { ToolMetadata } from '../types';

interface SearchBarProps {
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onToolSelect?: (tool: ToolMetadata) => void;
}

export function SearchBar({ 
  className, 
  placeholder = 'Tools suchen...', 
  autoFocus = false,
  onToolSelect 
}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ToolMetadata[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSearch = useCallback((q: string) => {
    setIsLoading(true);
    // Simulate slight delay for better UX
    setTimeout(() => {
      const searchResults = searchTools(q);
      setResults(searchResults.slice(0, 8));
      setIsLoading(false);
    }, 100);
  }, []);

  const handleQueryChange = useCallback((newQuery: string) => {
    setQuery(newQuery);
    if (newQuery.trim().length > 0) {
      handleSearch(newQuery);
      setIsOpen(true);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [handleSearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToolClick = (tool: ToolMetadata) => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    if (onToolSelect) {
      onToolSelect(tool);
    } else {
      router.push(`/tools/${tool.slug}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const clearQuery = useCallback(() => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  }, []);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => query.trim() && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="pl-10 pr-10 h-11 sm:h-12 text-base bg-background"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={clearQuery}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in-0 zoom-in-95">
          <div className="max-h-[400px] overflow-y-auto">
            {results.map((tool) => (
              <SearchResultItem 
                key={tool.id} 
                tool={tool} 
                onClick={() => handleToolClick(tool)} 
              />
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {isOpen && query.trim() && results.length === 0 && !isLoading && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-xl shadow-xl p-6 text-center z-50">
          <p className="text-muted-foreground">Keine Tools gefunden für "{query}"</p>
        </div>
      )}
    </div>
  );
}

function SearchResultItem({ tool, onClick }: { tool: ToolMetadata; onClick: () => void }) {
  const IconComponent = (LucideIcons as Record<string, React.ComponentType<{ className?: string }>>)[tool.icon] || LucideIcons.Wrench;
  
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
    >
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <IconComponent className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{tool.name}</p>
        <p className="text-sm text-muted-foreground truncate">{tool.shortDescription}</p>
      </div>
      <div className="text-xs text-muted-foreground capitalize shrink-0">
        {tool.category}
      </div>
    </button>
  );
}
