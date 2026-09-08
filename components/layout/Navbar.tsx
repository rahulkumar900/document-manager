'use client';

import React, { useState, useRef, useEffect } from 'react';
import { UserAccount, SiteRecord } from '@/lib/types';
import { Icons } from '../ui/icons';

interface NavbarProps {
  currentUser: UserAccount;
  sites: SiteRecord[];
  activeTab?: 'dashboard' | 'documents';
  totalDocCount?: number;
  pendingDocCount?: number;
  onTabChange?: (tab: 'dashboard' | 'documents') => void;
  onOpenUpload?: () => void;
  onOpenProfile: () => void;
  onOpenAdminHub: () => void;
  onLogout: () => void;
  onNavigateDashboard: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  sites,
  activeTab = 'dashboard',
  totalDocCount,
  pendingDocCount,
  onTabChange,
  onOpenUpload,
  onOpenProfile,
  onOpenAdminHub,
  onLogout,
  onNavigateDashboard,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const assignedSite = sites.find((s) => s.id === currentUser.assignedSiteId);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Compute initials
  const initials = (currentUser.name || 'User')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-xl border-b border-border transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
        {/* Brand & Logo */}
        <div
          onClick={onNavigateDashboard}
          className="flex items-center space-x-3 cursor-pointer group select-none shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-md shadow-primary/20 transition-transform group-hover:scale-105">
            <Icons.Building className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-foreground group-hover:text-primary transition-colors leading-tight">
              Site Docs
            </h1>
            <p className="text-[11px] text-muted-foreground font-medium">
              Construction Portal
            </p>
          </div>
        </div>

        {/* Center Desktop Navigation Tabs */}
        {onTabChange && (
          <div className="hidden md:flex items-center gap-1 bg-muted/60 p-1 rounded-2xl border border-border shadow-inner">
            <button
              type="button"
              onClick={() => onTabChange('dashboard')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              <Icons.Building className="w-3.5 h-3.5" />
              <span>Dashboard</span>
              {pendingDocCount !== undefined && pendingDocCount > 0 && (
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md ${
                  activeTab === 'dashboard' ? 'bg-amber-400 text-black' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {pendingDocCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onTabChange('documents')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'documents'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              <Icons.List className="w-3.5 h-3.5" />
              <span>Documents</span>
              {totalDocCount !== undefined && (
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md ${
                  activeTab === 'documents' ? 'bg-secondary text-secondary-foreground' : 'bg-card text-muted-foreground border border-border'
                }`}>
                  {totalDocCount}
                </span>
              )}
            </button>

            {onOpenUpload && (
              <button
                type="button"
                onClick={onOpenUpload}
                className="ml-1 px-3 py-1.5 rounded-xl text-xs font-bold text-foreground hover:bg-accent/60 border border-border/80 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Upload new document"
              >
                <Icons.Plus className="w-3.5 h-3.5" />
                <span>Upload</span>
              </button>
            )}
          </div>
        )}

        {/* Right Section: User Menu & Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* User Profile Pill & Dropdown Menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              className={`flex items-center gap-2.5 bg-card hover:bg-accent border ${
                isDropdownOpen ? 'border-ring ring-2 ring-ring/20' : 'border-border'
              } pl-2 pr-3.5 py-1.5 rounded-2xl shadow-inner transition-all cursor-pointer select-none group`}
              aria-expanded={isDropdownOpen}
              aria-haspopup="true"
            >
              <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-black text-xs shadow-md group-hover:scale-105 transition-transform">
                {initials}
              </div>

              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-foreground flex items-center gap-1.5 leading-tight">
                  <span className="group-hover:text-primary transition-colors">{currentUser.name}</span>
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                      currentUser.role === 'Admin'
                        ? 'bg-secondary text-secondary-foreground border-border'
                        : currentUser.role === 'Checker'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
                        : 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {currentUser.role}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono leading-none mt-0.5 truncate max-w-[130px]">
                  {currentUser.assignedSiteId === 'all'
                    ? 'All Sites'
                    : assignedSite
                    ? `${assignedSite.code} (${assignedSite.name})`
                    : 'Site Scope'}
                </div>
              </div>

              <Icons.ChevronDown
                className={`w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180 text-primary' : ''
                }`}
              />
            </button>

            {/* Interactive User Dropdown Card */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] bg-card border border-border rounded-2xl shadow-2xl shadow-black/80 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* Header Info */}
                <div className="px-4 py-3 border-b border-border/80">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-md">
                      {initials}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold text-foreground truncate">{currentUser.name}</p>
                      <p className="text-xs text-muted-foreground truncate font-mono">{currentUser.email}</p>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center gap-1.5">
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        currentUser.role === 'Admin'
                          ? 'bg-secondary text-secondary-foreground border-border'
                          : currentUser.role === 'Checker'
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}
                    >
                      {currentUser.role}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium truncate">
                      {currentUser.assignedSiteId === 'all'
                        ? '🌐 All Sites Scope'
                        : `📍 ${assignedSite ? `${assignedSite.name} (${assignedSite.code})` : 'Assigned Site'}`}
                    </span>
                  </div>
                </div>

                {/* Dropdown Menu Items */}
                <div className="p-1.5 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onOpenProfile();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-foreground hover:bg-accent transition-colors text-left cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-muted group-hover:bg-primary group-hover:text-primary-foreground text-muted-foreground flex items-center justify-center transition-colors">
                      <Icons.User className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div>Profile & Account Settings</div>
                      <div className="text-[10px] text-muted-foreground font-normal">
                        Update name, site & password
                      </div>
                    </div>
                  </button>

                  {currentUser.role === 'Admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onOpenAdminHub();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-foreground hover:bg-accent transition-colors text-left cursor-pointer group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-muted group-hover:bg-primary group-hover:text-primary-foreground text-muted-foreground flex items-center justify-center transition-colors">
                        <Icons.Shield className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div>Admin Hub</div>
                        <div className="text-[10px] text-muted-foreground font-normal">
                          Manage users, roles & sites
                        </div>
                      </div>
                    </button>
                  )}

                  <div className="my-1 border-t border-border/80" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors text-left cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center transition-colors group-hover:bg-destructive/25">
                      <Icons.Logout className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div>Sign Out</div>
                      <div className="text-[10px] text-destructive/70 font-normal">
                        End session safely
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Screen Segmented Navigation Tabs */}
      {onTabChange && (
        <div className="md:hidden border-t border-border/80 bg-card/95 px-3 py-2 flex items-center gap-2 shadow-md">
          <button
            type="button"
            onClick={() => onTabChange('dashboard')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground bg-muted/50'
            }`}
          >
            <Icons.Building className="w-3.5 h-3.5" />
            <span>Dashboard</span>
            {pendingDocCount !== undefined && pendingDocCount > 0 && (
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md ${
                activeTab === 'dashboard' ? 'bg-amber-400 text-black' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                {pendingDocCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onTabChange('documents')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'documents'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground bg-muted/50'
            }`}
          >
            <Icons.List className="w-3.5 h-3.5" />
            <span>Documents</span>
            {totalDocCount !== undefined && (
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md ${
                activeTab === 'documents' ? 'bg-secondary text-secondary-foreground' : 'bg-card text-muted-foreground border border-border'
              }`}>
                {totalDocCount}
              </span>
            )}
          </button>
        </div>
      )}
    </header>
  );
};
