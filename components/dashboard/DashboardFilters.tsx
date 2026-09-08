import React, { useState, useRef, useEffect } from 'react';
import {
  SiteRecord,
  UserAccount,
  DisplayLayout,
  FilterRule,
  FilterKey,
  FilterOperator,
  DocumentType,
} from '@/lib/types';
import {
  FILTER_KEY_OPTIONS,
  OPERATOR_OPTIONS,
  createDefaultFilterRule,
  formatRuleLabel,
} from '@/lib/filterUtils';
import { generateUUID, formatCurrency } from '@/lib/utils';
import { Icons } from '../ui/icons';

interface DashboardFiltersProps {
  currentUser: UserAccount;
  sites: SiteRecord[];
  siteMap: Map<string, SiteRecord>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedSiteFilter: string;
  onSiteFilterChange: (siteId: string) => void;
  filterRules: FilterRule[];
  onApplyFilterRules: (rules: FilterRule[]) => void;
  onRemoveFilterRule: (id: string) => void;
  onClearAllFilters: () => void;
  displayLayout: DisplayLayout;
  onLayoutChange: (layout: DisplayLayout) => void;
  onStartUpload: () => void;
  onExportAll?: () => void;
  onExportSelected?: () => void;
  selectedCount?: number;
  isExporting?: boolean;
  totalDocumentCount: number;
}

export const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  currentUser,
  sites,
  siteMap,
  searchQuery,
  onSearchChange,
  selectedSiteFilter,
  onSiteFilterChange,
  filterRules,
  onApplyFilterRules,
  onRemoveFilterRule,
  onClearAllFilters,
  displayLayout,
  onLayoutChange,
  onStartUpload,
  onExportAll,
  onExportSelected,
  selectedCount = 0,
  isExporting = false,
  totalDocumentCount,
}) => {
  const isSiteAccountant = currentUser.role === 'Site Accountant';
  const hasActiveFilters =
    filterRules.length > 0 || !!searchQuery || (selectedSiteFilter !== 'all' && !isSiteAccountant);

  // Dropdown Open State (Inside Search Bar)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Custom Filter Sub-Panel inside Dropdown
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [customKey, setCustomKey] = useState<FilterKey>('type');
  const [customOperator, setCustomOperator] = useState<FilterOperator>('is_one_of');
  const [customValue, setCustomValue] = useState<any>(['Invoice']);

  // Date Submenu
  const [showDateSubmenu, setShowDateSubmenu] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setShowCustomBuilder(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Sync custom operator & value when customKey changes
  const handleCustomKeySelect = (newKey: FilterKey) => {
    setCustomKey(newKey);
    const def = createDefaultFilterRule(newKey);
    setCustomOperator(def.operator);
    setCustomValue(def.value);
  };

  // Toggle single preset filter
  const togglePresetFilter = (preset: FilterRule) => {
    const existingIndex = filterRules.findIndex(
      (r) => r.key === preset.key && JSON.stringify(r.value) === JSON.stringify(preset.value)
    );

    if (existingIndex !== -1) {
      // Remove it
      const next = filterRules.filter((_, idx) => idx !== existingIndex);
      onApplyFilterRules(next);
    } else {
      // Add it
      onApplyFilterRules([...filterRules, preset]);
    }
  };

  const isPresetActive = (key: FilterKey, val: any) => {
    return filterRules.some(
      (r) => r.key === key && (JSON.stringify(r.value) === JSON.stringify(val) || r.value === val)
    );
  };

  // Add custom rule from the dropdown builder
  const handleAddCustomRule = () => {
    if (customValue === undefined || customValue === null || customValue === '') return;
    if (Array.isArray(customValue) && customValue.length === 0) return;

    const newRule: FilterRule = {
      id: generateUUID(),
      key: customKey,
      operator: customOperator,
      value: customValue,
    };

    onApplyFilterRules([...filterRules, newRule]);
    setShowCustomBuilder(false);
    setIsDropdownOpen(false);
  };

  return (
    <div className="space-y-3 mb-6 relative">
      {/* 1. Main Controls Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: Search bar with integrated inside dropdown toggle button */}
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5 relative" ref={dropdownRef}>
          {/* Integrated Search Input Container with Dropdown Trigger Inside */}
          <div
            className={`relative flex-1 flex items-center bg-neutral-900 border rounded-2xl transition-all shadow-inner ${
              isDropdownOpen
                ? 'border-purple-500 ring-2 ring-purple-500/20 shadow-purple-950/30'
                : 'border-neutral-800 hover:border-neutral-700'
            }`}
          >
            {/* Search Icon */}
            <div className="pl-3.5 pr-2 flex items-center pointer-events-none text-neutral-500">
              <Icons.Search className="w-4 h-4" />
            </div>

            {/* Input */}
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search vendor, invoice #, amount, type..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="flex-1 py-2.5 bg-transparent text-xs sm:text-sm text-white placeholder:text-neutral-500 focus:outline-none"
            />

            {/* Clear Search button if text exists */}
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  onSearchChange('');
                  searchInputRef.current?.focus();
                }}
                className="pr-2 text-xs text-neutral-500 hover:text-white cursor-pointer"
                title="Clear text search"
              >
                ✕
              </button>
            )}

            {/* Active filters count badge inside input if filters are active */}
            {filterRules.length > 0 && (
              <span className="mr-1.5 px-2 py-0.5 rounded-md bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-mono font-bold">
                {filterRules.length} active
              </span>
            )}

            {/* INSIDE SEARCH INPUT DROPDOWN BUTTON [ ▼ ] */}
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              aria-label="Toggle Advanced Filters & Group By"
              className={`h-full px-3 py-2.5 flex items-center justify-center border-l transition-all rounded-r-2xl cursor-pointer ${
                isDropdownOpen
                  ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                  : 'border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800/80'
              }`}
            >
              {isDropdownOpen ? (
                <Icons.ChevronUp className="w-4 h-4" />
              ) : (
                <Icons.ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Quick Site Filter Dropdown (Optional standalone switcher) */}
          <div className="w-full sm:w-56">
            <select
              disabled={isSiteAccountant && currentUser.assignedSiteId !== 'all'}
              value={selectedSiteFilter}
              onChange={(e) => onSiteFilterChange(e.target.value)}
              className={`w-full py-2.5 px-3.5 bg-neutral-900 border border-neutral-800 rounded-2xl text-xs sm:text-sm text-white focus:outline-none focus:border-neutral-500 transition-colors ${
                isSiteAccountant && currentUser.assignedSiteId !== 'all'
                  ? 'opacity-70 cursor-not-allowed bg-neutral-950'
                  : ''
              }`}
            >
              {(!isSiteAccountant || currentUser.assignedSiteId === 'all') && (
                <option value="all">All Construction Sites ({sites.length})</option>
              )}
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          {/* ========================================================================= */}
          {/* FLOATING ERP-STYLE MULTI-OPTION FILTER POPOVER (ANCHORED TO SEARCH INPUT) */}
          {/* ========================================================================= */}
          {isDropdownOpen && (
            <div className="absolute left-0 right-0 sm:right-auto sm:w-[740px] top-[calc(100%+8px)] z-50 bg-neutral-900/95 backdrop-blur-2xl border border-neutral-700/80 rounded-3xl shadow-2xl shadow-neutral-950/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[82vh] overflow-y-auto custom-scrollbar">
              {/* 3-Column Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-neutral-800 text-xs">
                {/* ------------------------------------------------------------- */}
                {/* COLUMN 1: 🔻 Filters */}
                {/* ------------------------------------------------------------- */}
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-neutral-800 text-purple-400 font-bold uppercase tracking-wider text-[11px]">
                    <Icons.Filter className="w-4 h-4 text-purple-400" />
                    <span>Filters</span>
                  </div>

                  {/* Group 1: Document Types */}
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() =>
                        togglePresetFilter({
                          id: generateUUID(),
                          key: 'type',
                          operator: 'equals',
                          value: 'Invoice',
                        })
                      }
                      className={`w-full text-left px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center justify-between cursor-pointer ${
                        isPresetActive('type', 'Invoice')
                          ? 'bg-purple-950/90 text-purple-200 border border-purple-800 font-bold'
                          : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white'
                      }`}
                    >
                      <span>Tax Invoices</span>
                      {isPresetActive('type', 'Invoice') && <Icons.Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        togglePresetFilter({
                          id: generateUUID(),
                          key: 'type',
                          operator: 'equals',
                          value: 'Challan',
                        })
                      }
                      className={`w-full text-left px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center justify-between cursor-pointer ${
                        isPresetActive('type', 'Challan')
                          ? 'bg-indigo-950/90 text-indigo-200 border border-indigo-800 font-bold'
                          : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white'
                      }`}
                    >
                      <span>Delivery Challans</span>
                      {isPresetActive('type', 'Challan') && <Icons.Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        togglePresetFilter({
                          id: generateUUID(),
                          key: 'type',
                          operator: 'equals',
                          value: 'Credit Note',
                        })
                      }
                      className={`w-full text-left px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center justify-between cursor-pointer ${
                        isPresetActive('type', 'Credit Note')
                          ? 'bg-rose-950/90 text-rose-200 border border-rose-800 font-bold'
                          : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white'
                      }`}
                    >
                      <span>Credit Notes</span>
                      {isPresetActive('type', 'Credit Note') && <Icons.Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        togglePresetFilter({
                          id: generateUUID(),
                          key: 'type',
                          operator: 'equals',
                          value: 'Ledger',
                        })
                      }
                      className={`w-full text-left px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center justify-between cursor-pointer ${
                        isPresetActive('type', 'Ledger')
                          ? 'bg-sky-950/90 text-sky-200 border border-sky-800 font-bold'
                          : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white'
                      }`}
                    >
                      <span>Ledgers & Statements</span>
                      {isPresetActive('type', 'Ledger') && <Icons.Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>
                  </div>

                  <div className="h-[1px] bg-neutral-800" />

                  {/* Group 2: Status */}
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() =>
                        togglePresetFilter({
                          id: generateUUID(),
                          key: 'status',
                          operator: 'equals',
                          value: 'uploaded',
                        })
                      }
                      className={`w-full text-left px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center justify-between cursor-pointer ${
                        isPresetActive('status', 'uploaded')
                          ? 'bg-amber-950/90 text-amber-200 border border-amber-800 font-bold'
                          : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white'
                      }`}
                    >
                      <span>Pending Verification (Draft)</span>
                      {isPresetActive('status', 'uploaded') && <Icons.Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        togglePresetFilter({
                          id: generateUUID(),
                          key: 'status',
                          operator: 'equals',
                          value: 'verified',
                        })
                      }
                      className={`w-full text-left px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center justify-between cursor-pointer ${
                        isPresetActive('status', 'verified')
                          ? 'bg-emerald-950/90 text-emerald-200 border border-emerald-800 font-bold'
                          : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white'
                      }`}
                    >
                      <span>Verified & Approved</span>
                      {isPresetActive('status', 'verified') && <Icons.Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>
                  </div>

                  <div className="h-[1px] bg-neutral-800" />

                  {/* Group 3: Financial & Custom builder toggle */}
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() =>
                        togglePresetFilter({
                          id: generateUUID(),
                          key: 'amount',
                          operator: 'greater_than',
                          value: '25000',
                        })
                      }
                      className={`w-full text-left px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center justify-between cursor-pointer ${
                        isPresetActive('amount', '25000')
                          ? 'bg-purple-950/90 text-purple-200 border border-purple-800 font-bold'
                          : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white'
                      }`}
                    >
                      <span>High Value (≥ ₹25,000)</span>
                      {isPresetActive('amount', '25000') && <Icons.Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowDateSubmenu((prev) => !prev)}
                      className="w-full text-left px-3 py-1.5 rounded-xl text-neutral-300 hover:bg-neutral-800/80 hover:text-white transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span>Document Date</span>
                      <Icons.ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDateSubmenu ? 'rotate-180' : ''}`} />
                    </button>

                    {showDateSubmenu && (
                      <div className="pl-3 pr-1 py-1 space-y-1 text-[11px] bg-neutral-950/60 rounded-xl border border-neutral-800 animate-in fade-in duration-100">
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
                            const to = now.toISOString().split('T')[0];
                            togglePresetFilter({
                              id: generateUUID(),
                              key: 'date',
                              operator: 'between',
                              value: { from, to },
                            });
                          }}
                          className="w-full text-left py-1 px-2 text-neutral-400 hover:text-white rounded hover:bg-neutral-800/60"
                        >
                          This Month
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                            togglePresetFilter({
                              id: generateUUID(),
                              key: 'date',
                              operator: 'between',
                              value: { from: past.toISOString().split('T')[0], to: now.toISOString().split('T')[0] },
                            });
                          }}
                          className="w-full text-left py-1 px-2 text-neutral-400 hover:text-white rounded hover:bg-neutral-800/60"
                        >
                          Last 30 Days
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="h-[1px] bg-neutral-800" />

                  {/* Add Custom Filter Button */}
                  <button
                    type="button"
                    onClick={() => setShowCustomBuilder((prev) => !prev)}
                    className="w-full py-2 px-3 text-xs font-bold text-purple-400 hover:text-purple-300 bg-purple-950/40 hover:bg-purple-950/70 border border-purple-800/50 rounded-xl transition-all flex items-center justify-between cursor-pointer"
                  >
                    <span>+ Add Custom Filter</span>
                    <Icons.ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCustomBuilder ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* COLUMN 2: 📚 Group By / Quick Sites */}
                {/* ------------------------------------------------------------- */}
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-neutral-800 text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
                    <Icons.Layers className="w-4 h-4 text-emerald-400" />
                    <span>Group By / Sites</span>
                  </div>

                  <div className="space-y-1">
                    {/* Site quick filters */}
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 px-3 py-1">
                      Construction Sites:
                    </div>
                    {sites.slice(0, 5).map((s) => {
                      const isSelected = selectedSiteFilter === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => onSiteFilterChange(isSelected ? 'all' : s.id)}
                          className={`w-full text-left px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-950/90 text-emerald-200 border border-emerald-800 font-bold'
                              : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white'
                          }`}
                        >
                          <span className="truncate max-w-[150px]">{s.name} ({s.code})</span>
                          {isSelected && <Icons.Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="h-[1px] bg-neutral-800" />

                  {/* Attribute grouping / quick view triggers */}
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 px-3 py-1">
                      Filter by Attribute:
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleCustomKeySelect('vendorName');
                        setShowCustomBuilder(true);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-xl text-neutral-300 hover:bg-neutral-800/80 hover:text-white transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span>Vendor / Supplier</span>
                      <Icons.Search className="w-3.5 h-3.5 text-neutral-500" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleCustomKeySelect('invoiceNumber');
                        setShowCustomBuilder(true);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-xl text-neutral-300 hover:bg-neutral-800/80 hover:text-white transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span>Invoice / Period #</span>
                      <Icons.Search className="w-3.5 h-3.5 text-neutral-500" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleCustomKeySelect('amount');
                        setShowCustomBuilder(true);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-xl text-neutral-300 hover:bg-neutral-800/80 hover:text-white transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span>Amount Range</span>
                      <Icons.Search className="w-3.5 h-3.5 text-neutral-500" />
                    </button>
                  </div>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* COLUMN 3: ⭐ Favorites & Actions */}
                {/* ------------------------------------------------------------- */}
                <div className="p-4 sm:p-5 space-y-4 bg-neutral-950/40">
                  <div className="flex items-center gap-2 pb-2 border-b border-neutral-800 text-amber-400 font-bold uppercase tracking-wider text-[11px]">
                    <Icons.Star className="w-4 h-4 text-amber-400" />
                    <span>Favorites & Actions</span>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        alert(`Current search criteria saved for session (${totalDocumentCount} matching documents).`);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors text-xs font-medium flex items-center gap-2 cursor-pointer border border-neutral-800"
                    >
                      <Icons.Star className="w-3.5 h-3.5 text-amber-400" />
                      <span>Save Current Search</span>
                    </button>

                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={() => {
                          onClearAllFilters();
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-rose-300 hover:bg-rose-950/50 hover:text-rose-200 transition-colors text-xs font-semibold flex items-center gap-2 cursor-pointer border border-rose-900/40"
                      >
                        <Icons.Trash className="w-3.5 h-3.5 text-rose-400" />
                        <span>Clear All Active Filters</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        if (selectedCount > 0 && onExportSelected) {
                          onExportSelected();
                        } else if (onExportAll) {
                          onExportAll();
                        }
                      }}
                      disabled={selectedCount === 0 || isExporting}
                      className="w-full text-left px-3 py-2 rounded-xl text-purple-300 hover:bg-purple-950/50 hover:text-purple-200 transition-colors text-xs font-semibold flex items-center gap-2 cursor-pointer border border-purple-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={selectedCount > 0 ? `Export ${selectedCount} selected document(s)` : 'Select one or more documents using checkboxes to export'}
                    >
                      <Icons.Download className="w-3.5 h-3.5 text-purple-400" />
                      <span>{selectedCount > 0 ? `Export Selected (${selectedCount})` : 'Export Selected'}</span>
                    </button>
                  </div>

                  <div className="pt-3 border-t border-neutral-800 text-[11px] text-neutral-500 space-y-1">
                    <div className="font-semibold text-neutral-400">Search Summary:</div>
                    <div>• Matches: <strong className="text-white">{totalDocumentCount}</strong> docs</div>
                    <div>• Active Rules: <strong className="text-purple-300">{filterRules.length}</strong></div>
                  </div>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* EXPANDABLE INLINE CUSTOM FILTER BUILDER (KEY • TYPE • VALUE) */}
              {/* ------------------------------------------------------------- */}
              {showCustomBuilder && (
                <div className="p-4 sm:p-5 bg-neutral-950 border-t border-neutral-800 space-y-3.5 animate-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-2">
                      <Icons.Sliders className="w-4 h-4" />
                      <span>Custom Rule Builder (Key • Condition • Value)</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowCustomBuilder(false)}
                      className="text-neutral-500 hover:text-white text-xs"
                    >
                      ✕ Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    {/* 1. KEY Selector */}
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                        1. Select Key / Field
                      </label>
                      <select
                        value={customKey}
                        onChange={(e) => handleCustomKeySelect(e.target.value as FilterKey)}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-purple-500"
                      >
                        {FILTER_KEY_OPTIONS.map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 2. OPERATOR Selector */}
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                        2. Condition Type
                      </label>
                      <select
                        value={customOperator}
                        onChange={(e) => setCustomOperator(e.target.value as FilterOperator)}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-purple-500"
                      >
                        {(OPERATOR_OPTIONS[customKey] || []).map((op) => (
                          <option key={op.operator} value={op.operator}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 3. VALUE Input */}
                    <div className="sm:col-span-5">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                        3. Target Value
                      </label>

                      {/* Value: Document Type */}
                      {customKey === 'type' && (
                        <select
                          value={Array.isArray(customValue) ? customValue[0] : customValue}
                          onChange={(e) => setCustomValue([e.target.value])}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                        >
                          <option value="Invoice">Tax Invoice</option>
                          <option value="Challan">Delivery Challan</option>
                          <option value="Credit Note">Credit Note</option>
                          <option value="Ledger">Ledger & Statement</option>
                        </select>
                      )}

                      {/* Value: Status */}
                      {customKey === 'status' && (
                        <select
                          value={customValue}
                          onChange={(e) => setCustomValue(e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                        >
                          <option value="uploaded">Pending Verification</option>
                          <option value="verified">Verified</option>
                        </select>
                      )}

                      {/* Value: Construction Site */}
                      {customKey === 'siteId' && (
                        <select
                          value={customValue}
                          onChange={(e) => setCustomValue(e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                        >
                          {sites.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.code})
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Value: Text (Vendor, Invoice #, Uploaded By) */}
                      {(customKey === 'vendorName' ||
                        customKey === 'invoiceNumber' ||
                        customKey === 'uploadedBy') && (
                        <input
                          type="text"
                          placeholder="Type match value..."
                          value={customValue || ''}
                          onChange={(e) => setCustomValue(e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-purple-500"
                        />
                      )}

                      {/* Value: Amount */}
                      {customKey === 'amount' && (
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500">₹</span>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={customValue || ''}
                            onChange={(e) => setCustomValue(e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-700 pl-7 pr-3 py-2 text-xs font-mono text-emerald-400 font-bold rounded-xl focus:outline-none"
                          />
                        </div>
                      )}

                      {/* Value: Date */}
                      {customKey === 'date' && (
                        <input
                          type="date"
                          value={customValue || ''}
                          onChange={(e) => setCustomValue(e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-xs font-mono text-white rounded-xl focus:outline-none"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCustomBuilder(false)}
                      className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white bg-neutral-900 rounded-lg border border-neutral-800 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCustomRule}
                      className="px-4 py-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-all shadow cursor-pointer active:scale-95"
                    >
                      Apply Custom Rule
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Layout Toggle, Export Button & Upload CTA */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
          {/* Export Selected Items Button - Active only when items are selected */}
          {totalDocumentCount > 0 && (
            <button
              onClick={() => {
                if (selectedCount > 0 && onExportSelected) {
                  onExportSelected();
                } else if (onExportAll) {
                  onExportAll();
                }
              }}
              disabled={isExporting || selectedCount === 0}
              className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3.5 py-2.5 rounded-2xl border transition-all shadow-sm ${
                selectedCount > 0
                  ? 'bg-neutral-900 hover:bg-neutral-800 text-white border-purple-500/60 ring-1 ring-purple-500/30 active:scale-95 cursor-pointer shadow-purple-950/40'
                  : 'bg-neutral-900/40 text-neutral-500 border-neutral-800/80 cursor-not-allowed opacity-50'
              }`}
              title={
                selectedCount > 0
                  ? `Export ${selectedCount} selected document(s) with metadata CSV in ZIP`
                  : 'Select one or more documents using checkboxes to export'
              }
            >
              <Icons.Download className={`w-4 h-4 ${selectedCount > 0 ? 'text-purple-400' : 'text-neutral-500'}`} />
              <span className="hidden sm:inline">
                {selectedCount > 0 ? `Export (${selectedCount})` : 'Export'}
              </span>
            </button>
          )}

          {/* Grid / List Switcher */}
          <div className="flex items-center bg-neutral-900 p-1 rounded-2xl border border-neutral-800">
            <button
              type="button"
              onClick={() => onLayoutChange('grid')}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                displayLayout === 'grid'
                  ? 'bg-white text-neutral-950 shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Grid View"
            >
              <Icons.LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onLayoutChange('list')}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                displayLayout === 'list'
                  ? 'bg-white text-neutral-950 shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Table View"
            >
              <Icons.List className="w-4 h-4" />
            </button>
          </div>

          {/* Upload Document CTA */}
          <button
            onClick={onStartUpload}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-neutral-200 active:scale-95 text-neutral-950 font-black text-xs sm:text-sm px-4 py-2.5 rounded-2xl transition-all shadow-lg shadow-white/5 cursor-pointer"
          >
            <Icons.Plus className="w-4 h-4 stroke-[3]" />
            <span>Upload</span>
          </button>
        </div>
      </div>

      {/* 2. Active Filter Chips & Badges Ribbon */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-1 animate-in fade-in duration-150">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1">
            <Icons.Filter className="w-3 h-3 text-neutral-500" /> Active:
          </span>

          {/* Search Query Chip */}
          {searchQuery && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300">
              <span>Search: &quot;{searchQuery}&quot;</span>
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="text-neutral-500 hover:text-white hover:bg-neutral-800 rounded p-0.5 cursor-pointer"
                title="Clear search text"
              >
                ✕
              </button>
            </span>
          )}

          {/* Site Filter Chip */}
          {selectedSiteFilter !== 'all' && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-300">
              <span>Site: {siteMap.get(selectedSiteFilter)?.name || selectedSiteFilter}</span>
              <button
                type="button"
                onClick={() => onSiteFilterChange('all')}
                className="text-emerald-400 hover:text-white hover:bg-emerald-900/50 rounded p-0.5 cursor-pointer"
                title="Clear site filter"
              >
                ✕
              </button>
            </span>
          )}

          {/* Advanced Rules Chips */}
          {filterRules.map((rule) => {
            const label = formatRuleLabel(rule, siteMap);
            return (
              <span
                key={rule.id}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-xl bg-neutral-900 hover:bg-neutral-800/80 border border-neutral-700/80 text-white shadow-sm transition-all"
              >
                <span>{label}</span>
                <button
                  type="button"
                  onClick={() => onRemoveFilterRule(rule.id)}
                  className="text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40 rounded p-0.5 transition-colors cursor-pointer"
                  title="Remove this filter"
                >
                  ✕
                </button>
              </span>
            );
          })}

          {/* Clear All Filters Button */}
          <button
            type="button"
            onClick={onClearAllFilters}
            className="text-[11px] font-bold text-neutral-400 hover:text-rose-400 underline underline-offset-2 ml-1 cursor-pointer transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};
