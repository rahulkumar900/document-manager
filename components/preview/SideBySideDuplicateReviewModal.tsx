import React, { useState, useEffect } from 'react';
import { DocumentRecord, SiteRecord, DocumentType } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Icons } from '../ui/icons';

export interface DuplicateComparisonTarget {
  draft: {
    invoice: {
      id?: string;
      vendorName: string;
      invoiceNumber: string;
      date: string;
      amount: number | string;
      type?: DocumentType;
      siteId?: string;
      notes?: string;
    };
    file?: {
      file?: File;
      fileData?: string | null;
      blobUrl?: string | null;
      fileType?: string;
      fileName?: string;
      fileSize?: number;
    };
    label?: string;
  };
  existingDoc?: DocumentRecord;
  matchedBatchItem?: {
    invoice: {
      id?: string;
      vendorName: string;
      invoiceNumber: string;
      date: string;
      amount: number | string;
      type?: DocumentType;
      siteId?: string;
    };
    file?: {
      file?: File;
      fileData?: string | null;
      blobUrl?: string | null;
      fileType?: string;
      fileName?: string;
      fileSize?: number;
    };
    batchIndex: number;
  };
}

interface SideBySideDuplicateReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: DuplicateComparisonTarget | null;
  siteMap?: Map<string, SiteRecord>;
  onDiscardDraft?: () => void;
  onEditDraft?: () => void;
}

export const SideBySideDuplicateReviewModal: React.FC<SideBySideDuplicateReviewModalProps> = ({
  isOpen,
  onClose,
  target,
  siteMap,
  onDiscardDraft,
  onEditDraft,
}) => {
  const [mobileTab, setMobileTab] = useState<'split' | 'draft' | 'existing'>('split');
  const [draftZoom, setDraftZoom] = useState<number>(1);
  const [existingZoom, setExistingZoom] = useState<number>(1);
  const [existingIframeError, setExistingIframeError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraftZoom(1);
      setExistingZoom(1);
      setExistingIframeError(false);
      setMobileTab('split');
    }
  }, [isOpen, target]);

  if (!isOpen || !target) return null;

  const { draft, existingDoc, matchedBatchItem } = target;

  // Resolve draft source
  const draftFileUrl = draft.file?.blobUrl || draft.file?.fileData || null;
  const isDraftPdf =
    draft.file?.fileType?.includes('pdf') ||
    draft.file?.fileName?.toLowerCase().endsWith('.pdf') ||
    draft.file?.file?.name?.toLowerCase().endsWith('.pdf');
  const isDraftImage =
    draft.file?.fileType?.includes('image') ||
    (draft.file?.fileData && draft.file.fileData.startsWith('data:image')) ||
    /\.(jpg|jpeg|png|webp|gif)$/i.test(draft.file?.fileName || draft.file?.file?.name || '');

  // Resolve existing/peer source
  const peerInvoice = existingDoc || matchedBatchItem?.invoice;
  const peerFile = matchedBatchItem?.file;
  const peerFileUrl =
    existingDoc?.fileData ||
    existingDoc?.fileUrl ||
    peerFile?.blobUrl ||
    peerFile?.fileData ||
    null;

  const isPeerImage =
    existingDoc?.fileType?.includes('image') ||
    (existingDoc?.fileData && existingDoc.fileData.startsWith('data:image')) ||
    /\.(jpg|jpeg|png|webp|gif)$/i.test(existingDoc?.fileName || '') ||
    /\.(jpg|jpeg|png|webp|gif)$/i.test(existingDoc?.fileUrl || '') ||
    peerFile?.fileType?.includes('image') ||
    /\.(jpg|jpeg|png|webp|gif)$/i.test(peerFile?.fileName || peerFile?.file?.name || '');

  const draftSite = draft.invoice.siteId && siteMap?.get(draft.invoice.siteId);
  const peerSite = peerInvoice?.siteId && siteMap?.get(peerInvoice.siteId);

  const draftAmountNum = parseFloat(String(draft.invoice.amount || '0')) || 0;
  const peerAmountNum = parseFloat(String(peerInvoice?.amount || '0')) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-7xl h-[94vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-foreground">
        {/* Top Header Bar */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-border bg-card/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-destructive/15 text-destructive border border-destructive/25 flex items-center justify-center shrink-0">
              <Icons.AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black tracking-tight">
                  Duplicate Document Review
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-destructive/15 text-destructive border border-destructive/30 px-2 py-0.5 rounded-full">
                  100% 4-Field Match
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Comparing current draft with {existingDoc ? 'existing database document' : `Item #${matchedBatchItem?.batchIndex || 1} in this upload batch`}.
              </p>
            </div>
          </div>

          {/* Quick Match Criteria Pills & Controls */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
            {/* Mobile View Switcher */}
            <div className="flex lg:hidden items-center bg-secondary border border-border rounded-xl p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setMobileTab('draft')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  mobileTab === 'draft' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Draft
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('existing')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  mobileTab === 'existing' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {existingDoc ? 'Existing' : 'Peer Item'}
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('split')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  mobileTab === 'split' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Split
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title="Close Comparison"
            >
              <Icons.X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 4-Field Exact Match Banner */}
        <div className="bg-muted/40 border-b border-border px-4 sm:px-6 py-2 flex items-center justify-between gap-2 overflow-x-auto text-[11px]">
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
              Matched Key:
            </span>
            <span className="inline-flex items-center gap-1 font-mono font-bold bg-background border border-border px-2 py-0.5 rounded-md text-foreground">
              <Icons.Check className="w-3 h-3 text-emerald-400" />
              Vendor: {draft.invoice.vendorName}
            </span>
            <span className="inline-flex items-center gap-1 font-mono font-bold bg-background border border-border px-2 py-0.5 rounded-md text-foreground">
              <Icons.Check className="w-3 h-3 text-emerald-400" />
              Invoice #: {draft.invoice.invoiceNumber}
            </span>
            <span className="inline-flex items-center gap-1 font-mono font-bold bg-background border border-border px-2 py-0.5 rounded-md text-foreground">
              <Icons.Check className="w-3 h-3 text-emerald-400" />
              Date: {draft.invoice.date}
            </span>
            <span className="inline-flex items-center gap-1 font-mono font-bold bg-background border border-border px-2 py-0.5 rounded-md text-foreground">
              <Icons.Check className="w-3 h-3 text-emerald-400" />
              Amount: {formatCurrency(draftAmountNum)}
            </span>
          </div>
        </div>

        {/* Side-by-Side Dual Workspace */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border overflow-hidden">
          {/* LEFT PANE: Newly Scanned Draft */}
          <div
            className={`h-full flex flex-col min-h-0 bg-background/50 ${
              mobileTab === 'existing' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Header */}
            <div className="px-4 py-2.5 bg-card/60 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-mono font-bold bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-md">
                  NEW DRAFT
                </span>
                <span className="text-xs font-bold text-foreground truncate">
                  {draft.label || 'Newly Scanned Invoice'}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {draftFileUrl && (
                  <a
                    href={draftFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary-foreground hover:text-foreground bg-secondary hover:bg-accent px-2.5 py-1 rounded-lg border border-border transition-colors"
                    title="Open draft file in new tab"
                  >
                    <Icons.ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Popout</span>
                  </a>
                )}
                {isDraftImage && (
                  <div className="flex items-center gap-1 bg-secondary border border-border rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setDraftZoom((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))))}
                      className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
                    >
                      <Icons.Minus className="w-3 h-3" />
                    </button>
                    <span className="text-[10px] font-mono font-bold px-1">{Math.round(draftZoom * 100)}%</span>
                    <button
                      type="button"
                      onClick={() => setDraftZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                      className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
                    >
                      <Icons.Plus className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Document Viewer Frame */}
            <div className="flex-1 min-h-0 bg-background relative overflow-hidden flex items-center justify-center">
              {draftFileUrl ? (
                isDraftImage ? (
                  <div className="w-full h-full p-4 flex items-center justify-center overflow-auto custom-scrollbar">
                    <img
                      src={draftFileUrl}
                      alt="Draft Document Preview"
                      style={{ transform: `scale(${draftZoom})`, transformOrigin: 'center center' }}
                      className="max-h-full max-w-full object-contain rounded-lg shadow-md transition-transform duration-100"
                    />
                  </div>
                ) : (
                  <iframe
                    src={draftFileUrl}
                    className="w-full h-full border-0 bg-card"
                    title="Draft Document PDF"
                  />
                )
              ) : (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <Icons.File className="w-10 h-10 opacity-40" />
                  <p className="text-xs">No file attachment available for this draft.</p>
                </div>
              )}
            </div>

            {/* Draft Metadata Footer Strip */}
            <div className="p-3.5 bg-card border-t border-border space-y-2 shrink-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Draft Extracted Values</span>
                <span className="text-primary font-mono">{draft.invoice.type || 'Invoice'}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-secondary/60 border border-border p-2 rounded-xl">
                  <div className="text-[10px] text-muted-foreground">Vendor</div>
                  <div className="font-bold truncate" title={draft.invoice.vendorName}>
                    {draft.invoice.vendorName || '—'}
                  </div>
                </div>
                <div className="bg-secondary/60 border border-border p-2 rounded-xl">
                  <div className="text-[10px] text-muted-foreground">Invoice #</div>
                  <div className="font-mono font-bold truncate" title={draft.invoice.invoiceNumber}>
                    {draft.invoice.invoiceNumber || '—'}
                  </div>
                </div>
                <div className="bg-secondary/60 border border-border p-2 rounded-xl">
                  <div className="text-[10px] text-muted-foreground">Date</div>
                  <div className="font-mono font-bold">{draft.invoice.date || '—'}</div>
                </div>
                <div className="bg-secondary/60 border border-border p-2 rounded-xl">
                  <div className="text-[10px] text-muted-foreground">Amount</div>
                  <div className="font-mono font-bold text-emerald-400">
                    {formatCurrency(draftAmountNum)}
                  </div>
                </div>
              </div>
              {draftSite && (
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Icons.Building className="w-3.5 h-3.5" />
                  <span>Target Site: <strong>{draftSite.name}</strong> ({draftSite.code})</span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANE: Existing Database Document or Peer Batch Item */}
          <div
            className={`h-full flex flex-col min-h-0 bg-background/50 ${
              mobileTab === 'draft' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Header */}
            <div className="px-4 py-2.5 bg-card/60 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                    existingDoc?.status === 'verified'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : 'bg-amber-950 text-amber-300 border-amber-800'
                  }`}
                >
                  {existingDoc ? (existingDoc.status === 'verified' ? 'EXISTING (VERIFIED)' : 'EXISTING (PENDING)') : `ITEM #${matchedBatchItem?.batchIndex || 1} IN BATCH`}
                </span>
                <span className="text-xs font-bold text-foreground truncate">
                  {existingDoc?.fileName || (peerInvoice ? `Invoice ${peerInvoice.invoiceNumber}` : 'Conflicting Document')}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {peerFileUrl && (
                  <a
                    href={peerFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary-foreground hover:text-foreground bg-secondary hover:bg-accent px-2.5 py-1 rounded-lg border border-border transition-colors"
                    title="Open existing document in new tab"
                  >
                    <Icons.ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Popout</span>
                  </a>
                )}
                {isPeerImage && (
                  <div className="flex items-center gap-1 bg-secondary border border-border rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setExistingZoom((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))))}
                      className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
                    >
                      <Icons.Minus className="w-3 h-3" />
                    </button>
                    <span className="text-[10px] font-mono font-bold px-1">{Math.round(existingZoom * 100)}%</span>
                    <button
                      type="button"
                      onClick={() => setExistingZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                      className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
                    >
                      <Icons.Plus className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Document Viewer Frame */}
            <div className="flex-1 min-h-0 bg-background relative overflow-hidden flex items-center justify-center">
              {peerFileUrl ? (
                isPeerImage ? (
                  <div className="w-full h-full p-4 flex items-center justify-center overflow-auto custom-scrollbar">
                    <img
                      src={peerFileUrl}
                      alt="Existing Document Preview"
                      style={{ transform: `scale(${existingZoom})`, transformOrigin: 'center center' }}
                      className="max-h-full max-w-full object-contain rounded-lg shadow-md transition-transform duration-100"
                    />
                  </div>
                ) : existingIframeError ? (
                  <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-3">
                    <Icons.AlertTriangle className="w-8 h-8 text-amber-400" />
                    <p className="text-xs max-w-xs">
                      Inline preview restricted by browser headers. Click Popout above or open directly:
                    </p>
                    <a
                      href={peerFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-xl shadow"
                    >
                      Open Document in Separate Tab
                    </a>
                  </div>
                ) : (
                  <iframe
                    src={peerFileUrl}
                    onError={() => setExistingIframeError(true)}
                    className="w-full h-full border-0 bg-card"
                    title="Existing Document PDF"
                  />
                )
              ) : (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <Icons.File className="w-10 h-10 opacity-40" />
                  <p className="text-xs">No stored file preview found on remote storage.</p>
                </div>
              )}
            </div>

            {/* Existing Metadata Footer Strip */}
            <div className="p-3.5 bg-card border-t border-border space-y-2 shrink-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Stored Database Record</span>
                <span className="font-mono text-muted-foreground">
                  {existingDoc?.createdAt ? `Added ${formatDate(existingDoc.createdAt)}` : 'In Batch'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-secondary/60 border border-border p-2 rounded-xl">
                  <div className="text-[10px] text-muted-foreground">Vendor</div>
                  <div className="font-bold truncate" title={peerInvoice?.vendorName}>
                    {peerInvoice?.vendorName || '—'}
                  </div>
                </div>
                <div className="bg-secondary/60 border border-border p-2 rounded-xl">
                  <div className="text-[10px] text-muted-foreground">Invoice #</div>
                  <div className="font-mono font-bold truncate" title={peerInvoice?.invoiceNumber}>
                    {peerInvoice?.invoiceNumber || '—'}
                  </div>
                </div>
                <div className="bg-secondary/60 border border-border p-2 rounded-xl">
                  <div className="text-[10px] text-muted-foreground">Date</div>
                  <div className="font-mono font-bold">{peerInvoice?.date || '—'}</div>
                </div>
                <div className="bg-secondary/60 border border-border p-2 rounded-xl">
                  <div className="text-[10px] text-muted-foreground">Amount</div>
                  <div className="font-mono font-bold text-emerald-400">
                    {formatCurrency(peerAmountNum)}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                {peerSite && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Icons.Building className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Site: <strong>{peerSite.name}</strong></span>
                  </div>
                )}
                {existingDoc?.uploadedBy && (
                  <span className="shrink-0">Uploaded by {existingDoc.uploadedBy}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Resolution Actions Bar */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-border bg-card/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icons.AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <span>
              Both records share identical Vendor Name, Invoice Number, Date, and Amount.
            </span>
          </div>

          <div className="flex items-center gap-2 justify-end">
            {onDiscardDraft && (
              <button
                type="button"
                onClick={() => {
                  onDiscardDraft();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                title="Discard this duplicate draft item from upload queue"
              >
                <Icons.Trash className="w-3.5 h-3.5" />
                <span>Discard This Draft</span>
              </button>
            )}

            {onEditDraft && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditDraft();
                }}
                className="inline-flex items-center gap-1.5 bg-secondary hover:bg-accent text-secondary-foreground hover:text-foreground text-xs font-bold px-3.5 py-2 rounded-xl border border-border transition-all active:scale-95 cursor-pointer"
                title="Edit this invoice's values in the upload form"
              >
                <Icons.Edit className="w-3.5 h-3.5" />
                <span>Edit Draft in Form</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="bg-card hover:bg-secondary text-foreground text-xs font-semibold px-3.5 py-2 rounded-xl border border-border transition-all cursor-pointer"
            >
              Close Review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
