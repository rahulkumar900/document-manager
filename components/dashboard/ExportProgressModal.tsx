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
    <div className="fixed inset-0 z-[70] bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 text-center">
        <div className="w-14 h-14 rounded-2xl bg-purple-950 text-purple-400 border border-purple-800/80 flex items-center justify-center mx-auto shadow-inner">
          <Icons.Download className="w-7 h-7 animate-bounce" />
        </div>

        <div>
          <h3 className="text-base font-bold text-white">Packaging ZIP Export</h3>
          <p className="text-xs text-neutral-400 mt-1">{message || 'Processing files & metadata sheet...'}</p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full bg-neutral-950 rounded-full h-2.5 overflow-hidden border border-neutral-800 p-0.5">
            <div
              className="bg-purple-500 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.max(5, percentage)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-mono text-neutral-500">
            <span>{current} / {total} files</span>
            <span>{percentage}%</span>
          </div>
        </div>

        <p className="text-[11px] text-neutral-500">
          The ZIP file containing the metadata CSV and document files will download automatically when ready.
        </p>
      </div>
    </div>
  );
};
