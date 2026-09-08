import React from 'react';
import { Icons } from './icons';

interface ErrorFallbackProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  fullscreen?: boolean;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while loading this section.',
  onRetry,
  fullscreen = false,
}) => {
  return (
    <div
      className={`bg-neutral-950 text-white flex flex-col items-center justify-center p-6 text-center ${
        fullscreen ? 'min-h-screen' : 'min-h-[260px] w-full rounded-3xl border border-neutral-800 bg-neutral-900/50 p-8'
      }`}
    >
      <div className="w-12 h-12 rounded-2xl bg-rose-950/60 border border-rose-800/60 text-rose-400 flex items-center justify-center mb-4 shadow-lg shadow-rose-950/40">
        <Icons.AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-bold text-white mb-1.5">{title}</h3>
      <p className="text-xs text-neutral-400 max-w-sm mb-5 leading-relaxed">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all active:scale-95 border border-neutral-700"
        >
          <Icons.Refresh className="w-3.5 h-3.5" />
          Try Again
        </button>
      )}
    </div>
  );
};
