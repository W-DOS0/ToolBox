'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getToolBySlug } from '@/tools/registry';

// Dynamic imports for tool pages
const ImageCompressorPage = dynamic(() => import('@/tools/pages/ImageCompressorPage'), {
  loading: () => <ToolPageSkeleton />,
  ssr: false,
});

export default function ToolPage() {
  const params = useParams();
  const slug = params.slug as string;
  const tool = getToolBySlug(slug);

  // Map slug to component
  const ToolComponent = useMemo(() => {
    switch (slug) {
      case 'bild-komprimieren':
        return ImageCompressorPage;
      default:
        return null;
    }
  }, [slug]);

  if (!tool) {
    return <ToolNotFound />;
  }

  if (!ToolComponent) {
    return <GenericToolPage tool={tool} />;
  }

  return <ToolComponent />;
}

function GenericToolPage({ tool }: { tool: NonNullable<ReturnType<typeof getToolBySlug>> }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold mb-2">{tool.name}</h1>
        <p className="text-muted-foreground mb-4">{tool.description}</p>
        <p className="text-sm text-muted-foreground">
          Dieses Tool ist noch in Entwicklung. Bald verfügbar!
        </p>
      </div>
    </div>
  );
}

function ToolPageSkeleton() {
  return (
    <div className="min-h-screen animate-pulse">
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted" />
            <div className="flex-1">
              <div className="h-5 bg-muted rounded w-40 mb-2" />
              <div className="h-4 bg-muted rounded w-60" />
            </div>
          </div>
        </div>
      </div>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="h-64 bg-muted rounded-xl" />
      </div>
    </div>
  );
}

function ToolNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">404</span>
        </div>
        <h1 className="text-2xl font-bold mb-2">Tool nicht gefunden</h1>
        <p className="text-muted-foreground mb-4">
          Das gesuchte Tool existiert nicht oder wurde entfernt.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground"
        >
          Zur Startseite
        </a>
      </div>
    </div>
  );
}
