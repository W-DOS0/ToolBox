'use client';

import { useState, useCallback } from 'react';
import type { ToolProgress } from '../types';

interface JSONError {
  message: string;
  line?: number;
  column?: number;
}

export function useJsonFormatter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<JSONError | null>(null);
  const [progress, setProgress] = useState<ToolProgress>({
    percent: 0,
    stage: '',
    isProcessing: false,
  });

  const format = useCallback((indent: number = 2) => {
    setProgress({ percent: 50, stage: 'Formatiere...', isProcessing: true });
    setError(null);

    try {
      const parsed = JSON.parse(input);
      const formatted = JSON.stringify(parsed, null, indent);
      setOutput(formatted);
      setProgress({ percent: 100, stage: 'Fertig!', isProcessing: false });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unbekannter Fehler';
      setError({ message: errorMessage });
      setProgress({ percent: 0, stage: 'Fehler', isProcessing: false });
    }
  }, [input]);

  const minify = useCallback(() => {
    setProgress({ percent: 50, stage: 'Minifiziere...', isProcessing: true });
    setError(null);

    try {
      const parsed = JSON.parse(input);
      const minified = JSON.stringify(parsed);
      setOutput(minified);
      setProgress({ percent: 100, stage: 'Fertig!', isProcessing: false });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unbekannter Fehler';
      setError({ message: errorMessage });
      setProgress({ percent: 0, stage: 'Fehler', isProcessing: false });
    }
  }, [input]);

  const validate = useCallback(() => {
    setProgress({ percent: 50, stage: 'Validiere...', isProcessing: true });
    setError(null);

    try {
      JSON.parse(input);
      setProgress({ percent: 100, stage: 'Gültiges JSON!', isProcessing: false });
      return true;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unbekannter Fehler';
      setError({ message: errorMessage });
      setProgress({ percent: 0, stage: 'Ungültiges JSON', isProcessing: false });
      return false;
    }
  }, [input]);

  const loadFile = useCallback(async (file: File) => {
    setProgress({ percent: 50, stage: 'Lade Datei...', isProcessing: true });
    
    try {
      const text = await file.text();
      setInput(text);
      setProgress({ percent: 100, stage: 'Datei geladen', isProcessing: false });
    } catch (e) {
      setError({ message: 'Fehler beim Laden der Datei' });
      setProgress({ percent: 0, stage: 'Fehler', isProcessing: false });
    }
  }, []);

  const reset = useCallback(() => {
    setInput('');
    setOutput('');
    setError(null);
    setProgress({ percent: 0, stage: '', isProcessing: false });
  }, []);

  return {
    input,
    output,
    error,
    progress,
    setInput,
    format,
    minify,
    validate,
    loadFile,
    reset,
  };
}

export function useTextTransform() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [history, setHistory] = useState<string[]>([]);

  const transform = useCallback((type: string) => {
    let result = input;
    
    switch (type) {
      case 'uppercase':
        result = input.toUpperCase();
        break;
      case 'lowercase':
        result = input.toLowerCase();
        break;
      case 'titlecase':
        result = input.replace(/\w\S*/g, (txt) => 
          txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
        break;
      case 'sentencecase':
        result = input.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase());
        break;
      case 'togglecase':
        result = input.split('').map(c => 
          c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()
        ).join('');
        break;
      case 'camelcase':
        result = input.toLowerCase()
          .replace(/[^a-zA-Z0-9]+(.)/g, (m, c) => c.toUpperCase())
          .replace(/^[A-Z]/, (c) => c.toLowerCase());
        break;
      case 'snakecase':
        result = input.toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9_]/g, '');
        break;
      case 'kebabcase':
        result = input.toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-zA-Z0-9-]/g, '');
        break;
      case 'reverse':
        result = input.split('').reverse().join('');
        break;
      case 'trim':
        result = input.trim();
        break;
      case 'removelines':
        result = input.replace(/\n+/g, ' ');
        break;
    }

    setHistory(prev => [...prev, output]);
    setOutput(result);
    return result;
  }, [input, output]);

  const undo = useCallback(() => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory(h => h.slice(0, -1));
      setOutput(prev);
    }
  }, [history]);

  const reset = useCallback(() => {
    setInput('');
    setOutput('');
    setHistory([]);
  }, []);

  return {
    input,
    output,
    setInput,
    transform,
    undo,
    reset,
    canUndo: history.length > 0,
  };
}

export function useTextCounter() {
  const [text, setText] = useState('');

  const stats = {
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, '').length,
    words: text.trim() ? text.trim().split(/\s+/).length : 0,
    sentences: text.split(/[.!?]+/).filter(s => s.trim()).length,
    paragraphs: text.split(/\n\s*\n/).filter(p => p.trim()).length,
    lines: text.split('\n').length,
    readingTime: Math.ceil((text.trim() ? text.trim().split(/\s+/).length : 0) / 200),
    speakingTime: Math.ceil((text.trim() ? text.trim().split(/\s+/).length : 0) / 150),
  };

  const loadFile = useCallback(async (file: File) => {
    try {
      const content = await file.text();
      setText(content);
    } catch (e) {
      console.error('Failed to load file:', e);
    }
  }, []);

  return {
    text,
    setText,
    stats,
    loadFile,
  };
}
