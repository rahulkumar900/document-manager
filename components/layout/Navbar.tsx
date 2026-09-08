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
    <header className="sticky top-0 z-40 bg-neutral-900/90 backdrop-blur-xl border-b border-neutral-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
        {/* Brand & Logo */}
        <div
          onClick={onNavigateDashboard}
          className="flex items-center space-x-3 cursor-pointer group select-none shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-md shadow-purple-900/30 transition-transform group-hover:scale-105">
            <Icons.Building className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-white group-hover:text-purple-300 transition-colors leading-tight">
              Site Docs
            </h1>
            <p className="text-[11px] text-neutral-400 font-medium">
              Construction Portal
            </p>
          </div>
        </div>

        {/* Center Desktop Navigation Tabs */}
        {onTabChange && (
          <div className="hidden md:flex items-center gap-1 bg-neutral-950/90 p-1 rounded-2xl border border-neutral-800 shadow-inner">
            <button
              type="button"
              onClick={() => onTabChange('dashboard')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
              }`}
            >
              <Icons.Building className="w-3.5 h-3.5" />
              <span>Dashboard</span>
              {pendingDocCount !== undefined && pendingDocCount > 0 && (
                <span className={`text-[10px] font-mono font-black px-1.5 py-0.2 rounded-md ${
                  activeTab === 'dashboard' ? 'bg-amber-400 text-neutral-950' : 'bg-amber-950 text-amber-300 border border-amber-800/60'
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
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
              }`}
            >
              <Icons.List className="w-3.5 h-3.5" />
              <span>Documents</span>
              {totalDocCount !== undefined && (
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md ${
                  activeTab === 'documents' ? 'bg-purple-900/80 text-purple-200' : 'bg-neutral-800 text-neutral-300'
                }`}>
                  {totalDocCount}
                </span>
              )}
            </button>

            {onOpenUpload && (
              <button
                type="button"
                onClick={onOpenUpload}
                className="ml-1 px-3 py-1.5 rounded-xl text-xs font-bold text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-900/40 border border-purple-800/40 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
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
              className={`flex items-center gap-2.5 bg-neutral-950/90 hover:bg-neutral-800/90 border ${
                isDropdownOpen ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-neutral-800'
              } pl-2 pr-3.5 py-1.5 rounded-2xl shadow-inner transition-all cursor-pointer select-none group`}
              aria-expanded={isDropdownOpen}
              aria-haspopup="true"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-md shadow-purple-950/50 group-hover:scale-105 transition-transform">
                {initials}
              </div>

              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-white flex items-center gap-1.5 leading-tight">
                  <span className="group-hover:text-purple-200 transition-colors">{currentUser.name}</span>
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      currentUser.role === 'Admin'
                        ? 'bg-purple-950 text-purple-300 border border-purple-800/80'
                        : currentUser.role === 'Checker'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                        : 'bg-neutral-800 text-neutral-300'
                    }`}
                  >
                    {currentUser.role}
                  </span>
                </div>
                <div className="text-[10px] text-neutral-400 font-mono leading-none mt-0.5 truncate max-w-[130px]">
                  {currentUser.assignedSiteId === 'all'
                    ? 'All Sites'
                    : assignedSite
                    ? `${assignedSite.code} (${assignedSite.name})`
                    : 'Site Scope'}
                </div>
              </div>

              <Icons.ChevronDown
                className={`w-3.5 h-3.5 text-neutral-400 group-hover:text-white transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180 text-purple-400' : ''
                }`}
              />
            </button>

            {/* Interactive User Dropdown Card */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl shadow-black/80 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* Header Info */}
                <div className="px-4 py-3 border-b border-neutral-800/80">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
                      {initials}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold text-white truncate">{currentUser.name}</p>
                      <p className="text-xs text-neutral-400 truncate font-mono">{currentUser.email}</p>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center gap-1.5">
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        currentUser.role === 'Admin'
                          ? 'bg-purple-950 text-purple-300 border-purple-800'
                          : currentUser.role === 'Checker'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                      }`}
                    >
                      {currentUser.role}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-medium truncate">
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
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-neutral-200 hover:text-white hover:bg-neutral-800/90 transition-colors text-left cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-neutral-800 group-hover:bg-purple-950 text-neutral-400 group-hover:text-purple-300 flex items-center justify-center transition-colors">
                      <Icons.User className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div>Profile & Account Settings</div>
                      <div className="text-[10px] text-neutral-400 font-normal">
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
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-neutral-200 hover:text-white hover:bg-neutral-800/90 transition-colors text-left cursor-pointer group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-neutral-800 group-hover:bg-purple-950 text-neutral-400 group-hover:text-purple-300 flex items-center justify-center transition-colors">
                        <Icons.Shield className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div>Admin Hub</div>
                        <div className="text-[10px] text-neutral-400 font-normal">
                          Manage users, roles & sites
                        </div>
                      </div>
                    </button>
                  )}

                  <div className="my-1 border-t border-neutral-800/80" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors text-left cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-rose-950/50 text-rose-400 flex items-center justify-center transition-colors group-hover:bg-rose-900/60">
                      <Icons.Logout className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div>Sign Out</div>
                      <div className="text-[10px] text-rose-400/70 font-normal">
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
        <div className="md:hidden border-t border-neutral-800/80 bg-neutral-900/95 px-3 py-2 flex items-center gap-2 shadow-md">
          <button
            type="button"
            onClick={() => onTabChange('dashboard')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-neutral-400 hover:text-neutral-200 bg-neutral-950/50'
            }`}
          >
            <Icons.Building className="w-3.5 h-3.5" />
            <span>Dashboard</span>
            {pendingDocCount !== undefined && pendingDocCount > 0 && (
              <span className={`text-[10px] font-mono font-black px-1.5 py-0.2 rounded-md ${
                activeTab === 'dashboard' ? 'bg-amber-400 text-neutral-950' : 'bg-amber-950 text-amber-300 border border-amber-800/60'
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
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-neutral-400 hover:text-neutral-200 bg-neutral-950/50'
            }`}
          >
            <Icons.List className="w-3.5 h-3.5" />
            <span>Documents</span>
            {totalDocCount !== undefined && (
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md ${
                activeTab === 'documents' ? 'bg-purple-900/80 text-purple-200' : 'bg-neutral-800 text-neutral-300'
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
