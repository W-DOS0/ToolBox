// Categories Configuration
import type { CategoryInfo } from '../types';

export const categories: CategoryInfo[] = [
  {
    id: 'image',
    name: 'Bild-Tools',
    description: 'Bilder komprimieren, konvertieren, bearbeiten und optimieren',
    icon: 'Image',
    color: 'emerald',
  },
  {
    id: 'pdf',
    name: 'PDF-Tools',
    description: 'PDFs erstellen, zusammenfügen, teilen und bearbeiten',
    icon: 'FileText',
    color: 'rose',
  },
  {
    id: 'text',
    name: 'Text-Tools',
    description: 'Text analysieren, formatieren, transformieren und generieren',
    icon: 'Type',
    color: 'blue',
  },
  {
    id: 'developer',
    name: 'Entwickler-Tools',
    description: 'Code formatieren, JSON/XML bearbeiten, Encoder/Decoder',
    icon: 'Code',
    color: 'violet',
  },
  {
    id: 'calculator',
    name: 'Rechner',
    description: 'Mathematische Berechnungen und Umrechnungen',
    icon: 'Calculator',
    color: 'amber',
  },
  {
    id: 'converter',
    name: 'Konverter',
    description: 'Dateien zwischen verschiedenen Formaten konvertieren',
    icon: 'ArrowLeftRight',
    color: 'cyan',
  },
  {
    id: 'utility',
    name: 'Hilfsprogramme',
    description: 'Nützliche Tools für den Alltag',
    icon: 'Wrench',
    color: 'slate',
  },
  {
    id: 'audio',
    name: 'Audio-Tools',
    description: 'Audio-Dateien bearbeiten und konvertieren',
    icon: 'Music',
    color: 'pink',
  },
  {
    id: 'video',
    name: 'Video-Tools',
    description: 'Videos komprimieren, schneiden und konvertieren',
    icon: 'Video',
    color: 'orange',
  },
  {
    id: 'security',
    name: 'Sicherheit',
    description: 'Passwörter generieren, Hashes erstellen, Verschlüsselung',
    icon: 'Shield',
    color: 'red',
  },
];

export const getCategoryById = (id: string): CategoryInfo | undefined => 
  categories.find(c => c.id === id);

export const getCategoryColor = (id: string): string => 
  getCategoryById(id)?.color || 'slate';
