import React, { useState, useEffect } from 'react';
import {
  DocumentRecord,
  SiteRecord,
  FilterRule,
  FilterKey,
  FilterOperator,
  DocumentType,
} from '@/lib/types';
import {
  FILTER_KEY_OPTIONS,
  OPERATOR_OPTIONS,
  createDefaultFilterRule,
  applyFilterRules,
} from '@/lib/filterUtils';
import { formatCurrency, generateUUID } from '@/lib/utils';
import { Icons } from '../ui/icons';

interface AdvancedFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  sites: SiteRecord[];
  allDocuments: DocumentRecord[];
  currentRules: FilterRule[];
  onApplyRules: (rules: FilterRule[]) => void;
}

export const AdvancedFilterModal: React.FC<AdvancedFilterModalProps> = ({
  isOpen,
  onClose,
  sites,
  allDocuments,
  currentRules,
  onApplyRules,
}) => {
  const [draftRules, setDraftRules] = useState<FilterRule[]>([]);

  // Sync draft rules with currentRules when modal opens
  useEffect(() => {
    if (isOpen) {
      if (currentRules.length > 0) {
        setDraftRules(JSON.parse(JSON.stringify(currentRules)));
      } else {
        // Start with a default rule
        setDraftRules([createDefaultFilterRule('type')]);
      }
    }
  }, [isOpen, currentRules]);

  if (!isOpen) return null;

  // Real-time matches calculation
  const matchCount = applyFilterRules(allDocuments, draftRules).length;

  const handleAddRule = () => {
    setDraftRules((prev) => [...prev, createDefaultFilterRule('type')]);
  };

  const handleRemoveRule = (id: string) => {
    setDraftRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleKeyChange = (index: number, newKey: FilterKey) => {
    const fresh = createDefaultFilterRule(newKey);
    setDraftRules((prev) => {
      const next = [...prev];
      next[index] = { ...fresh, id: prev[index].id };
      return next;
    });
  };

  const handleOperatorChange = (index: number, newOp: FilterOperator) => {
    setDraftRules((prev) => {
      const next = [...prev];
      const r = next[index];
      // Adapt value if switching to between
      let newVal = r.value;
      if (newOp === 'between' && r.key === 'amount') {
        newVal = { min: '', max: '' };
      } else if (newOp === 'between' && r.key === 'date') {
        newVal = { from: '', to: '' };
      } else if (r.operator === 'between' && (r.key === 'amount' || r.key === 'date')) {
        newVal = '';
      }
      next[index] = { ...r, operator: newOp, value: newVal };
      return next;
    });
  };

  const handleValueChange = (index: number, newValue: any) => {
    setDraftRules((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], value: newValue };
      return next;
    });
  };

  const handleToggleMultiType = (index: number, type: DocumentType) => {
    setDraftRules((prev) => {
      const next = [...prev];
      const currentList: DocumentType[] = Array.isArray(next[index].value) ? next[index].value : [];
      const updated = currentList.includes(type)
        ? currentList.filter((t) => t !== type)
        : [...currentList, type];
      next[index] = { ...next[index], value: updated };
      return next;
    });
  };

  const handleApply = () => {
    // Filter out completely empty unconfigured rules
    const validRules = draftRules.filter((r) => {
      if (r.value === undefined || r.value === null || r.value === '') return false;
      if (Array.isArray(r.value) && r.value.length === 0) return false;
      if (typeof r.value === 'object') {
        if (r.operator === 'between') {
          return Object.values(r.value).some((v) => v !== '' && v !== null && v !== undefined);
        }
      }
      return true;
    });
    onApplyRules(validRules);
    onClose();
  };

  const handleClearAll = () => {
    setDraftRules([]);
    onApplyRules([]);
    onClose();
  };

  // Quick preset filter shortcuts
  const applyPreset = (presetRules: FilterRule[]) => {
    setDraftRules(presetRules);
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-3xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-950/70 border border-purple-800/60 text-purple-300 flex items-center justify-center shadow-inner">
              <Icons.Filter className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Multi-Option Filter Builder</span>
                <span className="text-[10px] uppercase font-mono font-bold bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded">
                  {draftRules.length} rule{draftRules.length !== 1 ? 's' : ''}
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Filter documents by key, condition type, and target values.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-2 rounded-xl hover:bg-neutral-800 transition-all cursor-pointer"
            aria-label="Close Filter Builder"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets Bar */}
        <div className="px-5 sm:px-6 py-2.5 bg-neutral-950/60 border-b border-neutral-800/80 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 shrink-0">
            Presets:
          </span>
          <button
            type="button"
            onClick={() =>
              applyPreset([
                {
                  id: generateUUID(),
                  key: 'status',
                  operator: 'equals',
                  value: 'uploaded',
                },
              ])
            }
            className="px-2.5 py-1 text-xs font-semibold bg-neutral-900 hover:bg-amber-950/50 hover:text-amber-300 hover:border-amber-700/60 border border-neutral-800 text-neutral-300 rounded-lg transition-all cursor-pointer shrink-0"
          >
            ⏳ Pending Audits
          </button>
          <button
            type="button"
            onClick={() =>
              applyPreset([
                {
                  id: generateUUID(),
                  key: 'type',
                  operator: 'is_one_of',
                  value: ['Credit Note', 'Ledger'],
                },
              ])
            }
            className="px-2.5 py-1 text-xs font-semibold bg-neutral-900 hover:bg-rose-950/50 hover:text-rose-300 hover:border-rose-700/60 border border-neutral-800 text-neutral-300 rounded-lg transition-all cursor-pointer shrink-0"
          >
            📑 Credit Notes & Ledgers
          </button>
          <button
            type="button"
            onClick={() =>
              applyPreset([
                {
                  id: generateUUID(),
                  key: 'amount',
                  operator: 'greater_than',
                  value: '25000',
                },
              ])
            }
            className="px-2.5 py-1 text-xs font-semibold bg-neutral-900 hover:bg-emerald-950/50 hover:text-emerald-300 hover:border-emerald-700/60 border border-neutral-800 text-neutral-300 rounded-lg transition-all cursor-pointer shrink-0"
          >
            💰 High Value (≥ ₹25,000)
          </button>
          <button
            type="button"
            onClick={() =>
              applyPreset([
                {
                  id: generateUUID(),
                  key: 'type',
                  operator: 'equals',
                  value: 'Invoice',
                },
              ])
            }
            className="px-2.5 py-1 text-xs font-semibold bg-neutral-900 hover:bg-purple-950/50 hover:text-purple-300 hover:border-purple-700/60 border border-neutral-800 text-neutral-300 rounded-lg transition-all cursor-pointer shrink-0"
          >
            🧾 Tax Invoices
          </button>
        </div>

        {/* Modal Body: Rules List */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
          {draftRules.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-neutral-800 rounded-3xl space-y-3">
              <Icons.Filter className="w-10 h-10 mx-auto text-neutral-600" />
              <div>
                <h4 className="text-sm font-bold text-neutral-300">No Filter Rules Active</h4>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1">
                  Add criteria rules to slice and explore your documents by type, site, status, amount, or date.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddRule}
                className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer active:scale-95"
              >
                <Icons.Plus className="w-4 h-4" />
                <span>Add First Filter Rule</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {draftRules.map((rule, index) => {
                const availableOps = OPERATOR_OPTIONS[rule.key] || [];

                return (
                  <div
                    key={rule.id}
                    className="p-4 bg-neutral-950/80 border border-neutral-800 rounded-2xl space-y-3 relative hover:border-neutral-700/80 transition-all shadow-sm"
                  >
                    {/* Top Row: Key, Operator, and Delete */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                      {/* Step index badge */}
                      <div className="sm:col-span-1 flex items-center justify-start">
                        <span className="w-6 h-6 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-400 flex items-center justify-center text-[10px] font-bold font-mono">
                          {index + 1}
                        </span>
                      </div>

                      {/* 1. Select Key */}
                      <div className="sm:col-span-5">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                          Key / Field
                        </label>
                        <select
                          value={rule.key}
                          onChange={(e) => handleKeyChange(index, e.target.value as FilterKey)}
                          className="w-full bg-neutral-900 border border-neutral-700/80 focus:border-purple-500 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none transition-colors"
                        >
                          {FILTER_KEY_OPTIONS.map((opt) => (
                            <option key={opt.key} value={opt.key}>
                              {opt.label} ({opt.group})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 2. Select Operator / Condition */}
                      <div className="sm:col-span-5">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                          Condition
                        </label>
                        <select
                          value={rule.operator}
                          onChange={(e) =>
                            handleOperatorChange(index, e.target.value as FilterOperator)
                          }
                          className="w-full bg-neutral-900 border border-neutral-700/80 focus:border-purple-500 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none transition-colors"
                        >
                          {availableOps.map((op) => (
                            <option key={op.operator} value={op.operator}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 3. Delete Rule Button */}
                      <div className="sm:col-span-1 flex items-center justify-end sm:pt-4">
                        <button
                          type="button"
                          onClick={() => handleRemoveRule(rule.id)}
                          className="p-2 text-neutral-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-all border border-transparent hover:border-rose-900/50 cursor-pointer"
                          title="Remove this rule"
                        >
                          <Icons.Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Bottom Row: Dynamic Value Input */}
                    <div className="pt-2 border-t border-neutral-800/80">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                        Target Value
                      </label>

                      {/* Case: Document Type */}
                      {rule.key === 'type' && (
                        <div>
                          {rule.operator === 'is_one_of' ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {(['Invoice', 'Challan', 'Credit Note', 'Ledger'] as DocumentType[]).map(
                                (t) => {
                                  const list: DocumentType[] = Array.isArray(rule.value)
                                    ? rule.value
                                    : [];
                                  const isSelected = list.includes(t);
                                  return (
                                    <button
                                      key={t}
                                      type="button"
                                      onClick={() => handleToggleMultiType(index, t)}
                                      className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                                        isSelected
                                          ? t === 'Invoice'
                                            ? 'bg-purple-950/80 text-purple-200 border-purple-500/80 shadow-sm'
                                            : t === 'Challan'
                                            ? 'bg-indigo-950/80 text-indigo-200 border-indigo-500/80 shadow-sm'
                                            : t === 'Credit Note'
                                            ? 'bg-rose-950/80 text-rose-200 border-rose-500/80 shadow-sm'
                                            : 'bg-sky-950/80 text-sky-200 border-sky-500/80 shadow-sm'
                                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                                      }`}
                                    >
                                      <span>{t}</span>
                                      {isSelected && <Icons.Check className="w-3.5 h-3.5 stroke-[3]" />}
                                    </button>
                                  );
                                }
                              )}
                            </div>
                          ) : (
                            <select
                              value={rule.value || 'Invoice'}
                              onChange={(e) => handleValueChange(index, e.target.value)}
                              className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                            >
                              <option value="Invoice">Invoice</option>
                              <option value="Challan">Challan</option>
                              <option value="Credit Note">Credit Note</option>
                              <option value="Ledger">Ledger</option>
                            </select>
                          )}
                        </div>
                      )}

                      {/* Case: Status */}
                      {rule.key === 'status' && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleValueChange(index, 'uploaded')}
                            className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                              rule.value === 'uploaded'
                                ? 'bg-amber-950/80 text-amber-300 border-amber-600 shadow-sm'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                            }`}
                          >
                            <Icons.Clock className="w-3.5 h-3.5" />
                            <span>Pending Verification (uploaded)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleValueChange(index, 'verified')}
                            className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                              rule.value === 'verified'
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600 shadow-sm'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                            }`}
                          >
                            <Icons.Check className="w-3.5 h-3.5" />
                            <span>Verified</span>
                          </button>
                        </div>
                      )}

                      {/* Case: Construction Site */}
                      {rule.key === 'siteId' && (
                        <select
                          value={rule.value || (sites[0]?.id || '')}
                          onChange={(e) => handleValueChange(index, e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                        >
                          {sites.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.code}) - {s.location}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Case: Text inputs (Vendor, Invoice #, Uploaded By) */}
                      {(rule.key === 'vendorName' ||
                        rule.key === 'invoiceNumber' ||
                        rule.key === 'uploadedBy') && (
                        <input
                          type="text"
                          placeholder={
                            rule.key === 'vendorName'
                              ? 'e.g. Apex Steel or Infra Corp...'
                              : rule.key === 'invoiceNumber'
                              ? 'e.g. INV-2024 or 01-Apr-2023...'
                              : 'e.g. John Doe...'
                          }
                          value={rule.value || ''}
                          onChange={(e) => handleValueChange(index, e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-700/80 focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none transition-colors"
                        />
                      )}

                      {/* Case: Amount */}
                      {rule.key === 'amount' && (
                        <div>
                          {rule.operator === 'between' ? (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500">
                                  ₹ Min
                                </span>
                                <input
                                  type="number"
                                  placeholder="0.00"
                                  value={rule.value?.min || ''}
                                  onChange={(e) =>
                                    handleValueChange(index, {
                                      ...rule.value,
                                      min: e.target.value,
                                    })
                                  }
                                  className="w-full bg-neutral-900 border border-neutral-700/80 pl-12 pr-3 py-2 text-xs font-mono text-emerald-400 focus:outline-none rounded-xl"
                                />
                              </div>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500">
                                  ₹ Max
                                </span>
                                <input
                                  type="number"
                                  placeholder="100000.00"
                                  value={rule.value?.max || ''}
                                  onChange={(e) =>
                                    handleValueChange(index, {
                                      ...rule.value,
                                      max: e.target.value,
                                    })
                                  }
                                  className="w-full bg-neutral-900 border border-neutral-700/80 pl-12 pr-3 py-2 text-xs font-mono text-emerald-400 focus:outline-none rounded-xl"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="relative">
                              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">
                                ₹
                              </span>
                              <input
                                type="number"
                                placeholder="e.g. 5000"
                                value={rule.value || ''}
                                onChange={(e) => handleValueChange(index, e.target.value)}
                                className="w-full bg-neutral-900 border border-neutral-700/80 pl-8 pr-3 py-2 text-xs font-mono text-emerald-400 font-bold focus:outline-none rounded-xl"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Case: Date */}
                      {rule.key === 'date' && (
                        <div>
                          {rule.operator === 'between' ? (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] text-neutral-400 mb-0.5">
                                  From Date
                                </label>
                                <input
                                  type="date"
                                  value={rule.value?.from || ''}
                                  onChange={(e) =>
                                    handleValueChange(index, {
                                      ...rule.value,
                                      from: e.target.value,
                                    })
                                  }
                                  className="w-full bg-neutral-900 border border-neutral-700/80 px-3 py-2 text-xs font-mono text-white focus:outline-none rounded-xl"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-neutral-400 mb-0.5">
                                  To Date
                                </label>
                                <input
                                  type="date"
                                  value={rule.value?.to || ''}
                                  onChange={(e) =>
                                    handleValueChange(index, {
                                      ...rule.value,
                                      to: e.target.value,
                                    })
                                  }
                                  className="w-full bg-neutral-900 border border-neutral-700/80 px-3 py-2 text-xs font-mono text-white focus:outline-none rounded-xl"
                                />
                              </div>
                            </div>
                          ) : (
                            <input
                              type="date"
                              value={rule.value || ''}
                              onChange={(e) => handleValueChange(index, e.target.value)}
                              className="w-full bg-neutral-900 border border-neutral-700/80 px-3 py-2 text-xs font-mono text-white focus:outline-none rounded-xl"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={handleAddRule}
                className="w-full py-2.5 bg-neutral-900/80 hover:bg-neutral-800/80 border border-dashed border-neutral-700 hover:border-purple-500/80 text-purple-300 font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Icons.Plus className="w-4 h-4" />
                <span>Add Another Filter Condition</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 bg-neutral-950/90 border-t border-neutral-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-neutral-400">
              Matches <strong className="text-white font-bold">{matchCount}</strong> of{' '}
              {allDocuments.length} total documents
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleClearAll}
              className="px-4 py-2.5 text-xs font-bold text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-all cursor-pointer"
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 sm:flex-none px-6 py-2.5 text-xs font-black bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-purple-950/50 cursor-pointer active:scale-95"
            >
              Apply {draftRules.length > 0 ? `(${draftRules.length}) Filters` : 'Filters'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
