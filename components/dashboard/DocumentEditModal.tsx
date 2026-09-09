import React, { useState, useEffect, useMemo } from 'react';
import { DocumentRecord, SiteRecord, DocumentType } from '@/lib/types';
import { findDatabaseDuplicate, formatCurrency } from '@/lib/utils';
import { getStoredDocuments } from '@/lib/store';
import { Icons } from '../ui/icons';

interface DocumentEditModalProps {
  isOpen: boolean;
  document: DocumentRecord | null;
  sites: SiteRecord[];
  existingDocuments?: DocumentRecord[];
  onClose: () => void;
  onSave: (updatedDoc: DocumentRecord) => Promise<void> | void;
}

export const DocumentEditModal: React.FC<DocumentEditModalProps> = ({
  isOpen,
  document: doc,
  sites,
  existingDocuments,
  onClose,
  onSave,
}) => {
  const [vendorName, setVendorName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<DocumentType>('Invoice');
  const [siteId, setSiteId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (doc) {
      setVendorName(doc.vendorName);
      setInvoiceNumber(doc.invoiceNumber);
      setDate(doc.date);
      setAmount(doc.amount.toString());
      setType(doc.type);
      setSiteId(doc.siteId);
    }
  }, [doc]);

  // Real-time duplicate validation based strictly on (vendorName, invoiceNumber, date, amount)
  const duplicateConflict = useMemo(() => {
    if (!doc || !vendorName.trim() || !invoiceNumber.trim() || !date || !amount) {
      return null;
    }
    const allDocs = existingDocuments && existingDocuments.length > 0 ? existingDocuments : getStoredDocuments();
    const candidate = {
      vendorName: vendorName.trim(),
      invoiceNumber: invoiceNumber.trim(),
      date,
      amount: parseFloat(amount) || 0,
    };
    return findDatabaseDuplicate(candidate, allDocs, doc.id);
  }, [doc, vendorName, invoiceNumber, date, amount, existingDocuments]);

  if (!isOpen || !doc) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim() || !amount || duplicateConflict) return;

    setIsSaving(true);
    const updated: DocumentRecord = {
      ...doc,
      vendorName: vendorName.trim(),
      invoiceNumber: invoiceNumber.trim(),
      date,
      amount: parseFloat(amount) || 0,
      type,
      siteId: siteId || doc.siteId,
    };

    await onSave(updated);
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-secondary text-primary border border-border flex items-center justify-center">
              <Icons.Edit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Edit Document Details</h2>
              <p className="text-xs text-muted-foreground">Modify accounting metadata for {doc.invoiceNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-2 rounded-xl hover:bg-secondary transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {duplicateConflict && (
            <div className="p-3.5 bg-destructive/10 border border-destructive/30 rounded-2xl text-xs space-y-1 animate-in fade-in">
              <div className="flex items-center gap-1.5 font-bold text-destructive">
                <Icons.AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Duplicate Document Entry</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Another document with this Vendor Name, Invoice #, Date, and Amount already exists in your database:
                <span className="font-mono text-foreground block mt-1 font-semibold">
                  {duplicateConflict.vendorName} • #{duplicateConflict.invoiceNumber} • {duplicateConflict.date} • {formatCurrency(duplicateConflict.amount)}
                </span>
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Assigned Site *
            </label>
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code}) - {s.location}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Vendor / Supplier Name *
            </label>
            <input
              type="text"
              required
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Document Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as DocumentType)}
                className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
              >
                <option value="Invoice">Invoice</option>
                <option value="Challan">Challan</option>
                <option value="Credit Note">Credit Note</option>
                <option value="Ledger">Ledger</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                {type === 'Ledger'
                  ? 'Ledger Period / Range *'
                  : type === 'Credit Note'
                  ? 'Credit Note #'
                  : type === 'Challan'
                  ? 'Challan #'
                  : 'Invoice #'}
              </label>
              <input
                type="text"
                required
                placeholder={type === 'Ledger' ? '01-Apr-2023 to 31-Mar-2024' : 'Reference #'}
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                {type === 'Ledger' ? 'Statement Date' : 'Issue Date'}
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                {type === 'Ledger'
                  ? 'Closing / Net Balance (₹) *'
                  : type === 'Credit Note'
                  ? 'Credit Amount (₹) *'
                  : 'Total Amount (₹) *'}
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm text-emerald-400 font-mono font-bold focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3 border-t border-border">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground font-bold text-xs py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                  Saving Changes...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-secondary hover:bg-secondary/80 text-secondary-foreground font-bold text-xs py-3 px-5 rounded-xl active:scale-95 transition-all border border-border cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
