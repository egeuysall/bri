'use client';

import type { CSSProperties } from 'react';
import { Toaster as Sonner } from 'sonner';
import type { ToasterProps } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: '!rounded-md !bg-card !border !border-border !text-foreground',
          title: '!text-foreground',
          description: '!text-muted-foreground',
          actionButton:
            '!rounded-md !border !border-border !bg-background !text-foreground',
          cancelButton:
            '!rounded-md !border !border-border !bg-background !text-muted-foreground',
        },
      }}
      style={
        {
          '--normal-bg': 'var(--card)',
          '--normal-text': 'var(--foreground)',
          '--normal-border': 'var(--border)',
        } as CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
