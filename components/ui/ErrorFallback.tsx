import React from 'react';
import { Icons } from './icons';

interface ErrorFallbackProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  fullscreen?: boolean;
  compact?: boolean;
  className?: string;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while loading this section.',
  onRetry,
  fullscreen = false,
  compact = false,
  className = '',
}) => {
  if (compact) {
    return (
      <div
        className={`bg-card/40 border border-border/80 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center text-center backdrop-blur-sm ${className}`}
      >
        <div className="w-8 h-8 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center mb-2">
          <Icons.AlertTriangle className="w-4 h-4" />
        </div>
        <h4 className="text-xs font-bold text-foreground mb-1">{title}</h4>
        <p className="text-[11px] text-muted-foreground max-w-xs mb-3 line-clamp-2 leading-relaxed">
          {message}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95 border border-border cursor-pointer"
          >
            <Icons.Refresh className="w-3 h-3" />
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`bg-background text-foreground flex flex-col items-center justify-center p-6 text-center ${
        fullscreen ? 'min-h-screen' : 'min-h-[240px] w-full rounded-3xl border border-border bg-card/50 p-8'
      } ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center mb-4 shadow-lg">
        <Icons.AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-bold text-foreground mb-1.5">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-sm mb-5 leading-relaxed">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-bold px-4 py-2 rounded-xl transition-all active:scale-95 border border-border cursor-pointer"
        >
          <Icons.Refresh className="w-3.5 h-3.5" />
          Try Again
        </button>
      )}
    </div>
  );
};
