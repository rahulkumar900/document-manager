import React from 'react';
import { Icons } from '../ui/icons';

interface EmptyStateProps {
  hasFilters: boolean;
  onClearFilters: () => void;
  onStartUpload: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  hasFilters,
  onClearFilters,
  onStartUpload,
}) => {
  return (
    <div className="bg-card/50 border border-border border-dashed rounded-3xl p-12 text-center my-6 flex flex-col items-center justify-center">
      <div className="w-16 h-16 rounded-2xl bg-muted text-muted-foreground border border-border flex items-center justify-center mb-4 shadow-inner">
        <Icons.File className="w-8 h-8" />
      </div>

      <h3 className="text-lg font-bold text-foreground mb-1.5">
        {hasFilters ? 'No Matching Documents Found' : 'No Documents In Portal Yet'}
      </h3>

      <p className="text-xs text-muted-foreground max-w-sm mb-6 leading-relaxed">
        {hasFilters
          ? 'Try adjusting your search terms or clearing your site filter to discover documents.'
          : 'Upload vendor invoices or delivery challans to get started with automated scanning and cloud archiving.'}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {hasFilters ? (
          <button
            onClick={onClearFilters}
            className="inline-flex items-center gap-2 bg-secondary hover:bg-secondary/80 active:scale-95 text-secondary-foreground text-xs font-bold px-4 py-2.5 rounded-xl border border-border transition-all cursor-pointer"
          >
            Clear Search & Filters
          </button>
        ) : (
          <button
            onClick={onStartUpload}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Icons.Plus className="w-4 h-4 stroke-[2.5]" />
            Upload First Document
          </button>
        )}
      </div>
    </div>
  );
};
