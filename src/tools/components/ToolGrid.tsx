'use client';

import { ToolCard } from './ToolCard';
import type { ToolMetadata } from '../types';

interface ToolGridProps {
  tools: ToolMetadata[];
}

export default function ToolGrid({ tools }: ToolGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  );
}
