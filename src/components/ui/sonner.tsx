'use client';

import type { CSSProperties } from 'react';
import { Toaster as Sonner } from 'sonner';
import type { ToasterProps } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            '!rounded-md !bg-black !border !border-neutral-800 !text-neutral-100',
          title: '!text-neutral-100',
          description: '!text-neutral-300',
          actionButton:
            '!rounded-md !border !border-neutral-700 !bg-black !text-neutral-100',
          cancelButton:
            '!rounded-md !border !border-neutral-700 !bg-black !text-neutral-300',
        },
      }}
      style={
        {
          '--normal-bg': '#000000',
          '--normal-text': 'var(--color-neutral-100)',
          '--normal-border': 'var(--color-neutral-800)',
        } as CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
