import React from 'react';
import { Icons } from './icons';

interface LoadingFallbackProps {
  label?: string;
  fullscreen?: boolean;
}

export const LoadingFallback: React.FC<LoadingFallbackProps> = ({
  label = 'Loading Site Docs portal...',
  fullscreen = true,
}) => {
  return (
    <div
      className={`bg-neutral-950 text-white flex flex-col items-center justify-center p-6 ${
        fullscreen ? 'min-h-screen' : 'min-h-[300px] w-full'
      }`}
    >
      <div className="relative flex items-center justify-center mb-5">
        <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-200 shadow-xl">
          <Icons.Building className="w-6 h-6 animate-pulse" />
        </div>
        <div className="absolute inset-0 -m-1.5 rounded-2xl border-2 border-purple-500/50 border-t-transparent animate-spin pointer-events-none" />
      </div>
      <p className="text-xs font-mono font-medium text-neutral-400 tracking-wide">
        {label}
      </p>
    </div>
  );
};
