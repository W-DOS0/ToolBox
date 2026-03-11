'use client';

import Link from 'next/link';
import * as LucideIcons from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ToolMetadata } from '../types';
import { getCategoryColor } from '../registry';

interface ToolCardProps {
  tool: ToolMetadata;
  compact?: boolean;
}

export function ToolCard({ tool, compact = false }: ToolCardProps) {
  const IconComponent = (LucideIcons as Record<string, React.ComponentType<{ className?: string }>>)[tool.icon] || LucideIcons.Wrench;
  const categoryColor = getCategoryColor(tool.category);

  return (
    <Link href={`/tools/${tool.slug}`}>
      <div className={cn(
        'group relative flex flex-col rounded-xl border bg-card p-4 transition-all duration-200',
        'hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 hover:-translate-y-0.5',
        'active:scale-[0.98]',
        compact ? 'p-3' : 'p-4 sm:p-5'
      )}>
        {/* Badges */}
        <div className="absolute top-3 right-3 flex gap-1.5">
          {tool.isNew && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5 bg-emerald-500 hover:bg-emerald-600">
              Neu
            </Badge>
          )}
          {tool.isPopular && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5 bg-amber-500 hover:bg-amber-600">
              Beliebt
            </Badge>
          )}
        </div>

        {/* Icon */}
        <div className={cn(
          'rounded-xl flex items-center justify-center mb-3 transition-colors',
          `bg-${categoryColor}-100 dark:bg-${categoryColor}-900/30`,
          compact ? 'w-10 h-10' : 'w-12 h-12 sm:w-14 sm:h-14'
        )}>
          <IconComponent className={cn(
            `text-${categoryColor}-600 dark:text-${categoryColor}-400`,
            compact ? 'h-5 w-5' : 'h-6 w-6 sm:h-7 sm:w-7'
          )} />
        </div>

        {/* Content */}
        <h3 className={cn(
          'font-semibold leading-tight mb-1',
          compact ? 'text-sm' : 'text-base sm:text-lg'
        )}>
          {tool.shortName}
        </h3>
        
        {!compact && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {tool.shortDescription}
          </p>
        )}

        {/* Category */}
        <div className="mt-auto pt-2">
          <Badge variant="outline" className="text-[10px] font-normal capitalize">
            {tool.category}
          </Badge>
        </div>
      </div>
    </Link>
  );
}
