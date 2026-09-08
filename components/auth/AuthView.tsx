import React, { useState } from 'react';
import { UserAccount, SiteRecord } from '@/lib/types';
import { signInWithSupabase } from '@/lib/store';
import { Icons } from '../ui/icons';

interface AuthViewProps {
  sites?: SiteRecord[];
  onLoginSuccess: (user: UserAccount) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const { user, error: authError } = await signInWithSupabase(email, password);
    setIsLoading(false);

    if (authError) {
      setError(authError);
      return;
    }

    if (user) {
      onLoginSuccess(user);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border shadow-2xl rounded-3xl p-8 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-3 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/10">
            <Icons.Building className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-3xl font-black tracking-tight text-foreground">Site Docs</h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border">
                Private
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase mt-1">
              Document Management Portal
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mb-6 p-3 rounded-2xl bg-muted/50 border border-border text-[11px] text-muted-foreground flex items-center gap-2.5">
          <Icons.Shield className="w-4 h-4 text-primary shrink-0" />
          <span>Restricted Portal: Accounts are issued exclusively by system administrators.</span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-destructive/15 border border-destructive/30 text-destructive text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <Icons.AlertTriangle className="w-4 h-4 shrink-0 text-destructive" />
            <span>{error}</span>
          </div>
        )}

        {/* Sign In Form */}
        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-input focus:border-ring rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border border-input focus:border-ring rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground font-black text-sm py-3.5 px-4 rounded-2xl transition-all shadow-lg mt-2 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Security & Cloud Badge */}
        <div className="mt-8 pt-6 border-t border-border text-center flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Icons.Shield className="w-4 h-4 text-primary" />
          <span>Enterprise Cloud Security & Access Control</span>
        </div>
      </div>
    </div>
  );
};
