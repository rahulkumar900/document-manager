'use client';

import React, { useEffect } from 'react';
import { ErrorFallback } from '@/components/ui/ErrorFallback';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Next.js Page Error caught:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <ErrorFallback
        title="Page Rendering Error"
        message={error.message || 'An unexpected error occurred while loading this page.'}
        onRetry={reset}
        fullscreen={false}
      />
    </div>
  );
}
