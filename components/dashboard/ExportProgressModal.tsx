'use client';

import React from 'react';
import { Icons } from '../ui/icons';

interface ExportProgressModalProps {
  isOpen: boolean;
  current: number;
  total: number;
  message: string;
}

export const ExportProgressModal: React.FC<ExportProgressModalProps> = ({
  isOpen,
  current,
  total,
  message,
}) => {
  if (!isOpen) return null;

  const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-[70] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 text-center">
        <div className="w-14 h-14 rounded-2xl bg-secondary text-primary border border-border flex items-center justify-center mx-auto shadow-inner">
          <Icons.Download className="w-7 h-7 animate-bounce" />
        </div>

        <div>
          <h3 className="text-base font-bold text-foreground">Packaging ZIP Export</h3>
          <p className="text-xs text-muted-foreground mt-1">{message || 'Processing files & metadata sheet...'}</p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden border border-border p-0.5">
            <div
              className="bg-primary h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.max(5, percentage)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
            <span>{current} / {total} files</span>
            <span>{percentage}%</span>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          The ZIP file containing the metadata CSV and document files will download automatically when ready.
        </p>
      </div>
    </div>
  );
};
