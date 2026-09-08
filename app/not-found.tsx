import Link from 'next/link';
import { Icons } from '@/components/ui/icons';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-3xl bg-card border border-border flex items-center justify-center text-primary mb-5 shadow-2xl">
        <Icons.File className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">404 - Document / Page Not Found</h2>
      <p className="text-xs text-muted-foreground max-w-sm mb-6 leading-relaxed">
        The requested document, site, or route could not be found or may have been moved.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-5 py-2.5 rounded-xl transition-all active:scale-95 shadow-sm"
      >
        <Icons.ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>
    </div>
  );
}
