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
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 shadow-2xl rounded-3xl p-8 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-3 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-white text-neutral-950 flex items-center justify-center shadow-lg shadow-white/5">
            <Icons.Building className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-3xl font-black tracking-tight text-white">Site Docs</h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                Private
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-medium tracking-wide uppercase mt-1">
              Document Management Portal
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mb-6 p-3 rounded-2xl bg-neutral-950/80 border border-neutral-800 text-[11px] text-neutral-400 flex items-center gap-2.5">
          <Icons.Shield className="w-4 h-4 text-purple-400 shrink-0" />
          <span>Restricted Portal: Accounts are issued exclusively by system administrators.</span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <Icons.AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Sign In Form */}
        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 focus:border-white rounded-2xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 focus:border-white rounded-2xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-white hover:bg-neutral-200 active:scale-95 text-neutral-950 font-black text-sm py-3.5 px-4 rounded-2xl transition-all shadow-lg mt-2 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-4 h-4 rounded-full border-2 border-neutral-950 border-t-transparent animate-spin" />
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Security & Cloud Badge */}
        <div className="mt-8 pt-6 border-t border-neutral-800 text-center flex items-center justify-center gap-2 text-xs text-neutral-500">
          <Icons.Shield className="w-4 h-4 text-purple-400" />
          <span>Enterprise Cloud Security & Access Control</span>
        </div>
      </div>
    </div>
  );
};
