'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import * as LucideIcons from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ToolMetadata, ToolProgress } from '../types';
import { getCategoryColor, getToolById } from '../registry';

interface ToolContainerProps {
  tool: ToolMetadata;
  children: ReactNode;
  progress?: ToolProgress;
  onReset?: () => void;
}

export function ToolContainer({ tool, children, progress, onReset }: ToolContainerProps) {
  const IconComponent = (LucideIcons as Record<string, React.ComponentType<{ className?: string }>>)[tool.icon] || LucideIcons.Wrench;
  const categoryColor = getCategoryColor(tool.category);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'rounded-xl p-2.5',
              `bg-${categoryColor}-100 dark:bg-${categoryColor}-900/30`
            )}>
              <IconComponent className={cn(
                'h-5 w-5 sm:h-6 sm:w-6',
                `text-${categoryColor}-600 dark:text-${categoryColor}-400`
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold truncate">{tool.name}</h1>
                {tool.isNew && (
                  <Badge className="text-[10px] h-5 bg-emerald-500">Neu</Badge>
                )}
                {tool.isPopular && (
                  <Badge className="text-[10px] h-5 bg-amber-500">Beliebt</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {tool.shortDescription}
              </p>
            </div>
            {onReset && (
              <Button variant="outline" size="sm" onClick={onReset}>
                Zurücksetzen
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {progress && progress.isProcessing && (
        <div className="sticky top-[73px] z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-2">
          <div className="container max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <Progress value={progress.percent} className="flex-1 h-2" />
              <span className="text-sm font-medium tabular-nums min-w-[3rem] text-right">
                {progress.percent}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{progress.stage}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container max-w-4xl mx-auto px-4 py-6 sm:py-8">
        {children}
      </main>

      {/* Footer Info */}
      <footer className="border-t bg-muted/30 mt-auto">
        <div className="container max-w-4xl mx-auto px-4 py-8">
          {/* Features */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Funktionen</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {tool.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <LucideIcons.Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* How To */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">So funktioniert's</h2>
            <ol className="space-y-3">
              {tool.howTo.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium shrink-0">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* FAQ */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Häufige Fragen</h2>
            <div className="space-y-4">
              {tool.faq.map((item, i) => (
                <details key={i} className="group">
                  <summary className="flex items-center justify-between cursor-pointer py-2 font-medium">
                    {item.question}
                    <LucideIcons.ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="text-sm text-muted-foreground pb-2 pl-0">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>

          {/* Related Tools */}
          {tool.relatedTools.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Ähnliche Tools</h2>
              <div className="flex flex-wrap gap-2">
                {tool.relatedTools.map((relatedId) => (
                  <RelatedToolBadge key={relatedId} toolId={relatedId} />
                ))}
              </div>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

function RelatedToolBadge({ toolId }: { toolId: string }) {
  const relatedTool = getToolById(toolId);
  
  if (!relatedTool) return null;

  const IconComponent = (LucideIcons as Record<string, React.ComponentType<{ className?: string }>>)[relatedTool.icon] || LucideIcons.Wrench;

  return (
    <Link href={`/tools/${relatedTool.slug}`}>
      <Badge variant="secondary" className="gap-1.5 py-1.5 px-3 cursor-pointer hover:bg-primary/10 transition-colors">
        <IconComponent className="h-3.5 w-3.5" />
        {relatedTool.shortName}
      </Badge>
    </Link>
  );
}
