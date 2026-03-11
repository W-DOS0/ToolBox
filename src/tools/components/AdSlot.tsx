'use client';

import { cn } from '@/lib/utils';

interface AdSlotProps {
  type: 'banner' | 'sidebar' | 'inline' | 'sticky-footer';
  className?: string;
}

export function AdSlot({ type, className }: AdSlotProps) {
  const configs = {
    banner: {
      wrapper: 'w-full flex justify-center',
      dimensions: 'h-[90px] w-full max-w-[728px]',
      label: 'Anzeige',
    },
    sidebar: {
      wrapper: 'w-full',
      dimensions: 'h-[250px] w-full max-w-[300px]',
      label: 'Anzeige',
    },
    inline: {
      wrapper: 'w-full flex justify-center my-4',
      dimensions: 'h-[100px] w-full max-w-full',
      label: 'Werbung',
    },
    'sticky-footer': {
      wrapper: 'fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t p-2',
      dimensions: 'h-[50px] w-full max-w-[320px] mx-auto',
      label: 'Anzeige',
    },
  };

  const config = configs[type];

  return (
    <div className={cn(config.wrapper, className)}>
     {/* <div className={cn(
        config.dimensions,
        'rounded-lg border border-dashed bg-muted/50 flex items-center justify-center relative overflow-hidden'
      )}>
        
        <div className="text-center p-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            {config.label}
          </span>
          <div className="mt-1 text-xs text-muted-foreground/60">
            {type === 'banner' && '728×90'}
            {type === 'sidebar' && '300×250'}
            {type === 'inline' && 'Responsive'}
            {type === 'sticky-footer' && '320×50'}
          </div>
        </div>

        
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-1/4 w-1 h-full bg-gradient-to-b from-transparent via-current to-transparent" />
          <div className="absolute top-0 right-1/4 w-1 h-full bg-gradient-to-b from-transparent via-current to-transparent" />
        </div>
      </div>*/}
    </div>
  );
}

// Multiple Ad Slots for different positions
export function AdBanner() {
  return <AdSlot type="banner" />;
}

export function AdSidebar() {
  return <AdSlot type="sidebar" />;
}

export function AdInline() {
  return <AdSlot type="inline" />;
}

export function AdStickyFooter() {
  return <AdSlot type="sticky-footer" />;
}
