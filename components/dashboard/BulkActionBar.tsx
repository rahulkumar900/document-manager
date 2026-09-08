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
    <div className="fixed bottom-6 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div className="bg-neutral-900/95 backdrop-blur-xl border border-neutral-700 shadow-2xl shadow-neutral-950/80 rounded-2xl sm:rounded-full px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between sm:justify-start gap-3 sm:gap-4 max-w-2xl w-full">
        {/* Selection Count & Select All */}
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-mono text-xs font-black flex items-center justify-center shadow-inner">
            {selectedCount}
          </span>
          <span className="text-xs font-bold text-white whitespace-nowrap">
            Selected
          </span>
          <div className="h-4 w-[1px] bg-neutral-800" />
          <button
            onClick={isAllPageSelected ? onDeselectAll : onSelectAllPage}
            className="text-[11px] font-semibold text-neutral-400 hover:text-white underline underline-offset-2 transition-colors"
          >
            {isAllPageSelected ? 'Deselect Page' : 'Select Page'}
          </button>
          {totalFilteredCount > selectedCount && (
            <button
              onClick={onSelectAllFiltered}
              className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors hidden sm:inline"
            >
              Select All ({totalFilteredCount})
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-auto sm:ml-2">
          {/* Export Zip CTA */}
          <button
            onClick={onExportSelected}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-neutral-200 active:scale-95 text-neutral-950 font-black text-xs px-3.5 py-2 rounded-xl sm:rounded-full transition-all shadow-md"
            title="Export metadata spreadsheet and attached files in ZIP"
          >
            {isExporting ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-neutral-950 border-t-transparent animate-spin" />
                <span className="truncate max-w-[120px]">{exportProgressMessage || 'Exporting...'}</span>
              </>
            ) : (
              <>
                <Icons.Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Export ZIP</span>
              </>
            )}
          </button>

          {/* Batch Verify */}
          {isVerifier && (
            <button
              onClick={onVerifySelected}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs px-3 py-2 rounded-xl sm:rounded-full transition-all shadow-md shadow-emerald-950/40"
              title="Verify all selected documents"
            >
              <Icons.Check className="w-3.5 h-3.5 stroke-[3]" />
              <span className="hidden sm:inline">Verify</span>
            </button>
          )}

          {/* Batch Delete */}
          {canModify && (
            <button
              onClick={onDeleteSelected}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 bg-rose-950/80 hover:bg-rose-900 active:scale-95 text-rose-300 border border-rose-800/80 font-bold text-xs px-3 py-2 rounded-xl sm:rounded-full transition-all"
              title="Delete all selected documents"
            >
              <Icons.Trash className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}

          {/* Dismiss / Deselect */}
          <button
            onClick={onDeselectAll}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Clear selection"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};
