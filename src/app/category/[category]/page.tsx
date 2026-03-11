'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import * as LucideIcons from 'lucide-react';
import { SearchBar } from '@/tools/components/SearchBar';
import { ToolCard } from '@/tools/components/ToolCard';
import { AdBanner, AdInline } from '@/tools/components/AdSlot';
import { tools, categories, getCategoryById, getToolsByCategory } from '@/tools/registry';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function CategoryPage() {
  const params = useParams();
  const categoryId = params.category as string;
  const category = getCategoryById(categoryId);
  const categoryTools = getToolsByCategory(categoryId);

  if (!category) {
    return <CategoryNotFound />;
  }

  const IconComponent = (LucideIcons as Record<string, React.ComponentType<{ className?: string }>>)[category.icon] || LucideIcons.Wrench;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <LucideIcons.Wrench className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold hidden sm:block">ToolBox</span>
            </Link>

            <div className="flex-1 max-w-xl">
              <SearchBar placeholder="Tools suchen..." />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Category Hero */}
        <section className="py-8 sm:py-12 border-b bg-muted/20">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-4 mb-4">
              <div className={cn(
                'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center',
                `bg-${category.color}-100 dark:bg-${category.color}-900/30`
              )}>
                <IconComponent className={cn(
                  'h-7 w-7 sm:h-8 sm:w-8',
                  `text-${category.color}-600 dark:text-${category.color}-400`
                )} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">{category.name}</h1>
                <p className="text-muted-foreground">{category.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {categoryTools.length} Tool{categoryTools.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
        </section>

        {/* Ad Banner */}
        <div className="container mx-auto px-4 mt-6">
          <AdBanner />
        </div>

        {/* Tools Grid */}
        <section className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {categoryTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </section>

        {/* Ad Inline */}
        <div className="container mx-auto px-4 pb-8">
          <AdInline />
        </div>

        {/* Other Categories */}
        <section className="py-8 bg-muted/30 border-y">
          <div className="container mx-auto px-4">
            <h2 className="text-lg font-semibold mb-4">Andere Kategorien</h2>
            <div className="flex flex-wrap gap-2">
              {categories.filter(c => c.id !== categoryId).map((cat) => {
                const CatIcon = (LucideIcons as Record<string, React.ComponentType<{ className?: string }>>)[cat.icon] || LucideIcons.Wrench;
                return (
                  <Link key={cat.id} href={`/category/${cat.id}`}>
                    <Badge 
                      variant="outline" 
                      className="gap-1.5 py-1.5 px-3 cursor-pointer hover:bg-primary/10 transition-colors"
                    >
                      <CatIcon className="h-3.5 w-3.5" />
                      {cat.name}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-8 mt-auto">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <LucideIcons.Wrench className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold">ToolBox</span>
            </Link>
            <p className="text-sm text-muted-foreground text-center sm:text-right">
              © {new Date().getFullYear()} ToolBox. Alle Tools sind kostenlos.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CategoryNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <LucideIcons.FolderOpen className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Kategorie nicht gefunden</h1>
        <p className="text-muted-foreground mb-4">
          Diese Kategorie existiert nicht.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground"
        >
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}
