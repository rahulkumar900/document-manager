'use client';

import React from 'react';
import { UserAccount } from '@/lib/types';
import { Icons } from '../ui/icons';

interface BulkActionBarProps {
  selectedCount: number;
  totalFilteredCount: number;
  currentUser: UserAccount;
  isExporting: boolean;
  exportProgressMessage?: string;
  onExportSelected: () => void;
  onVerifySelected: () => void;
  onDeleteSelected: () => void;
  onSelectAllPage: () => void;
  onSelectAllFiltered: () => void;
  onDeselectAll: () => void;
  isAllPageSelected: boolean;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  totalFilteredCount,
  currentUser,
  isExporting,
  exportProgressMessage,
  onExportSelected,
  onVerifySelected,
  onDeleteSelected,
  onSelectAllPage,
  onSelectAllFiltered,
  onDeselectAll,
  isAllPageSelected,
}) => {
  if (selectedCount === 0) return null;

  const isVerifier = currentUser.role === 'Checker' || currentUser.role === 'Admin';
  const canModify = currentUser.role === 'Admin';

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div className="bg-card/95 backdrop-blur-xl border border-border shadow-2xl shadow-black/80 rounded-full px-3.5 py-1.5 flex items-center gap-2 sm:gap-3">
        {/* Selection Count Pill */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-mono text-xs font-black flex items-center justify-center shadow-inner">
            {selectedCount}
          </span>
          <button
            onClick={isAllPageSelected ? onDeselectAll : onSelectAllPage}
            className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-secondary hover:bg-accent text-secondary-foreground transition-colors cursor-pointer border border-border"
            title={isAllPageSelected ? 'Deselect current page' : 'Select all on page'}
          >
            {isAllPageSelected ? 'None' : 'All'}
          </button>
          {totalFilteredCount > selectedCount && (
            <button
              onClick={onSelectAllFiltered}
              className="text-[11px] font-mono font-bold text-foreground hover:text-primary transition-colors cursor-pointer hidden sm:inline"
              title={`Select all ${totalFilteredCount} matching documents`}
            >
              ({totalFilteredCount})
            </button>
          )}
        </div>

        <div className="h-4 w-[1px] bg-border shrink-0" />

        {/* Action Icon Buttons - No Text Clutter */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Export Zip Button */}
          <button
            onClick={onExportSelected}
            disabled={isExporting}
            className="w-8 h-8 rounded-full bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground flex items-center justify-center transition-all shadow-md cursor-pointer disabled:opacity-50"
            title={isExporting ? (exportProgressMessage || 'Exporting...') : 'Export Selected (ZIP)'}
            aria-label="Export Selected"
          >
            {isExporting ? (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
            ) : (
              <Icons.Download className="w-3.5 h-3.5 stroke-[2.5]" />
            )}
          </button>

          {/* Batch Verify Button */}
          {isVerifier && (
            <button
              onClick={onVerifySelected}
              disabled={isExporting}
              className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white flex items-center justify-center transition-all shadow-md cursor-pointer disabled:opacity-50"
              title="Verify Selected"
              aria-label="Verify Selected"
            >
              <Icons.Check className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          )}

          {/* Batch Delete Button */}
          {canModify && (
            <button
              onClick={onDeleteSelected}
              disabled={isExporting}
              className="w-8 h-8 rounded-full bg-destructive/20 hover:bg-destructive/30 active:scale-95 text-destructive border border-destructive/30 flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
              title="Delete Selected"
              aria-label="Delete Selected"
            >
              <Icons.Trash className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="h-4 w-[1px] bg-border shrink-0" />

          {/* Dismiss / Deselect Button */}
          <button
            onClick={onDeselectAll}
            className="w-7 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center transition-colors cursor-pointer text-xs"
            title="Clear Selection"
            aria-label="Clear Selection"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};
