import React, { useState, useEffect, useRef } from 'react';
import { DocumentRecord, SiteRecord, UserAccount, DocumentType, DocumentStatus } from '@/lib/types';
import { formatCurrency, formatDate, formatFileSize } from '@/lib/utils';
import { uploadFileToSupabaseStorage } from '@/lib/store';
import { Icons } from '../ui/icons';

interface DocumentPreviewViewProps {
  document: DocumentRecord;
  sites: SiteRecord[];
  siteMap: Map<string, SiteRecord>;
  currentUser: UserAccount;
  initialEditMode?: boolean;
  onBack: () => void;
  onVerify: (docId: string) => void;
  onSaveDocument: (updatedDoc: DocumentRecord) => Promise<void> | void;
  onDelete: (doc: DocumentRecord) => void;
}

export const DocumentPreviewView: React.FC<DocumentPreviewViewProps> = ({
  document: activeDocument,
  sites,
  siteMap,
  currentUser,
  initialEditMode = false,
  onBack,
  onVerify,
  onSaveDocument,
  onDelete,
}) => {
  const isVerifier = currentUser.role === 'Checker' || currentUser.role === 'Admin';
  const canModify = currentUser.role === 'Admin' || currentUser.role === 'Site Accountant';
  const canVerifyThisDoc = isVerifier && activeDocument.status === 'uploaded';

  const [iframeError, setIframeError] = useState(false);
  const [isStorageMissing, setIsStorageMissing] = useState(false);
  const [isUploadingReplacement, setIsUploadingReplacement] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sidebar Inline Edit State
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [mobileTab, setMobileTab] = useState<'viewer' | 'details'>(initialEditMode ? 'details' : 'viewer');
  const [imageZoom, setImageZoom] = useState<number>(1);
  const [vendorName, setVendorName] = useState(activeDocument.vendorName);
  const [invoiceNumber, setInvoiceNumber] = useState(activeDocument.invoiceNumber);
  const [date, setDate] = useState(activeDocument.date);
  const [amount, setAmount] = useState(activeDocument.amount.toString());
  const [type, setType] = useState<DocumentType>(activeDocument.type);
  const [siteId, setSiteId] = useState(activeDocument.siteId);
  const [status, setStatus] = useState<DocumentStatus>(activeDocument.status);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setVendorName(activeDocument.vendorName);
    setInvoiceNumber(activeDocument.invoiceNumber);
    setDate(activeDocument.date);
    setAmount(activeDocument.amount.toString());
    setType(activeDocument.type);
    setSiteId(activeDocument.siteId);
    setStatus(activeDocument.status);
  }, [activeDocument]);

  useEffect(() => {
    if (initialEditMode) {
      setIsEditing(true);
      setMobileTab('details');
    }
  }, [initialEditMode]);

  // Check if remote storage object exists or returns 404 NoSuchKey
  useEffect(() => {
    let isMounted = true;
    if (activeDocument.fileUrl && !activeDocument.fileData && !activeDocument.fileUrl.startsWith('data:')) {
      fetch(activeDocument.fileUrl, { method: 'HEAD' })
        .then((res) => {
          if (!isMounted) return;
          if (!res.ok || res.status === 404) {
            setIsStorageMissing(true);
          } else {
            setIsStorageMissing(false);
          }
        })
        .catch(() => {
          if (isMounted) setIsStorageMissing(true);
        });
    } else {
      setIsStorageMissing(false);
    }
    return () => {
      isMounted = false;
    };
  }, [activeDocument.fileUrl, activeDocument.fileData]);

  const handleReplacementFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert(`File exceeds 20MB limit (Selected: ${formatFileSize(file.size)}). Please select a file under 20MB.`);
      return;
    }

    setIsUploadingReplacement(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      const targetSiteId = activeDocument.siteId;

      let storageUrl = activeDocument.fileUrl;
      let storagePath = activeDocument.filePath;

      const uploadRes = await uploadFileToSupabaseStorage(file, targetSiteId, activeDocument.id);
      if (uploadRes.success && uploadRes.publicUrl) {
        storageUrl = uploadRes.publicUrl;
        storagePath = uploadRes.filePath;
      }

      const updated: DocumentRecord = {
        ...activeDocument,
        fileName: file.name,
        fileData: dataUrl,
        fileUrl: storageUrl,
        filePath: storagePath,
        fileSize: file.size,
        fileType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/png'),
      };

      await onSaveDocument(updated);
      setIsUploadingReplacement(false);
      setIsStorageMissing(false);
    };
    reader.readAsDataURL(file);
  };

  const siteObj = siteMap.get(isEditing ? siteId : activeDocument.siteId);
  const fileSource = activeDocument.fileData || (!isStorageMissing ? activeDocument.fileUrl : undefined);

  const isPdf =
    activeDocument.fileType?.includes('pdf') ||
    (activeDocument.fileUrl && activeDocument.fileUrl.toLowerCase().endsWith('.pdf')) ||
    (activeDocument.fileData && activeDocument.fileData.startsWith('data:application/pdf')) ||
    activeDocument.fileName?.toLowerCase().endsWith('.pdf');

  const isImage =
    activeDocument.fileType?.includes('image') ||
    (activeDocument.fileData && activeDocument.fileData.startsWith('data:image')) ||
    /\.(jpg|jpeg|png|webp|gif)$/i.test(activeDocument.fileName || '') ||
    /\.(jpg|jpeg|png|webp|gif)$/i.test(activeDocument.fileUrl || '');

  const handleSaveSidebar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!vendorName.trim() || !amount) return;

    setIsSaving(true);
    const parsedAmount = parseFloat(amount) || 0;
    const updatedDoc: DocumentRecord = {
      ...activeDocument,
      vendorName: vendorName.trim(),
      invoiceNumber: invoiceNumber.trim(),
      date,
      amount: parsedAmount,
      type,
      siteId: siteId || activeDocument.siteId,
      status,
    };

    await onSaveDocument(updatedDoc);
    setIsSaving(false);
    setSaveSuccess(true);
    setIsEditing(false);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleCancelEdit = () => {
    setVendorName(activeDocument.vendorName);
    setInvoiceNumber(activeDocument.invoiceNumber);
    setDate(activeDocument.date);
    setAmount(activeDocument.amount.toString());
    setType(activeDocument.type);
    setSiteId(activeDocument.siteId);
    setStatus(activeDocument.status);
    setIsEditing(false);
  };

  return (
    <div className="h-screen h-[100dvh] bg-background text-foreground flex flex-col font-sans overflow-hidden">
      {/* 1. Clean Top Header */}
      <header className="h-16 flex-shrink-0 bg-card border-b border-border px-3 sm:px-6 flex items-center justify-between z-20">
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground bg-secondary hover:bg-accent px-2.5 sm:px-3 py-2 rounded-xl transition-all border border-border active:scale-95 shrink-0"
          >
            <Icons.ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="h-4 w-[1px] bg-border hidden sm:block shrink-0" />

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs font-mono font-bold text-muted-foreground truncate max-w-[120px] sm:max-w-none">
                {activeDocument.invoiceNumber}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                  activeDocument.status === 'verified'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : 'bg-amber-950 text-amber-300 border-amber-800'
                }`}
              >
                {activeDocument.status === 'verified' ? 'Verified' : 'Pending'}
              </span>
            </div>
            <h1 className="text-xs sm:text-sm font-bold text-foreground truncate max-w-[150px] sm:max-w-md">
              {activeDocument.vendorName}
            </h1>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {saveSuccess && (
            <span className="hidden md:inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2.5 py-1 rounded-lg animate-pulse">
              <Icons.Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}

          {fileSource && activeDocument.fileUrl && (
            <a
              href={activeDocument.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-secondary hover:bg-accent text-secondary-foreground text-xs font-semibold px-2.5 sm:px-3 py-2 rounded-xl border border-border transition-all active:scale-95"
              title="Open raw file in a new browser tab"
            >
              <Icons.ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Open URL</span>
            </a>
          )}

          {fileSource && (
            <a
              href={fileSource}
              download={activeDocument.fileName || `${activeDocument.invoiceNumber}.pdf`}
              className="inline-flex items-center gap-1.5 bg-secondary hover:bg-accent text-secondary-foreground text-xs font-semibold px-2.5 sm:px-3 py-2 rounded-xl border border-border transition-all active:scale-95"
              title="Download original document"
            >
              <Icons.Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Download</span>
            </a>
          )}

          {canVerifyThisDoc && (
            <button
              onClick={() => onVerify(activeDocument.id)}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 sm:px-3.5 py-2 rounded-xl transition-all shadow-md shadow-emerald-950/40 active:scale-95 cursor-pointer"
            >
              <Icons.Check className="w-3.5 h-3.5 stroke-[3]" />
              <span className="hidden sm:inline">Verify</span>
            </button>
          )}
        </div>
      </header>

      {/* Dedicated Mobile Segmented Switcher Bar */}
      <div className="lg:hidden w-full bg-card/95 border-b border-border px-3 py-2 flex items-center gap-2 shrink-0 z-10 backdrop-blur-md">
        <div className="w-full bg-muted/60 p-1 rounded-2xl border border-border grid grid-cols-2 gap-1 shadow-inner">
          <button
            type="button"
            onClick={() => setMobileTab('viewer')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              mobileTab === 'viewer'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-card'
            }`}
          >
            <Icons.Eye className="w-4 h-4" />
            <span>Document Viewer</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('details')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              mobileTab === 'details'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-card'
            }`}
          >
            <Icons.FileText className="w-4 h-4" />
            <span>Details & Edit</span>
          </button>
        </div>
      </div>

      {/* 2. Responsive Split Body */}
      <div className="flex-1 min-h-0 w-full flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left / Center: Clean Document Viewer */}
        <div
          className={`w-full lg:flex-1 h-full min-h-0 bg-background p-2 sm:p-4 lg:p-6 overflow-hidden flex flex-col relative ${
            mobileTab === 'viewer'
              ? 'flex flex-1'
              : 'hidden lg:flex'
          }`}
        >
          {fileSource ? (
            isPdf ? (
              <div className="w-full h-full min-h-0 flex-1 flex flex-col rounded-2xl overflow-hidden border border-border bg-card shadow-2xl">
                {/* Minimal subheader */}
                <div className="bg-muted/50 border-b border-border px-3 sm:px-4 py-2 flex items-center justify-between text-xs text-muted-foreground shrink-0">
                  <div className="flex items-center gap-2 truncate">
                    <Icons.File className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="font-mono text-foreground truncate text-xs">
                      {activeDocument.fileName || 'document.pdf'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {activeDocument.fileSize && (
                      <span className="text-[11px] font-mono bg-secondary px-2 py-0.5 rounded text-secondary-foreground hidden sm:inline-block">
                        {formatFileSize(activeDocument.fileSize)}
                      </span>
                    )}
                    <a
                      href={fileSource}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary-foreground hover:text-foreground bg-secondary hover:bg-accent px-2.5 py-1 rounded-lg border border-border transition-colors"
                      title="Open full size in new tab"
                    >
                      <Icons.ExternalLink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Popout</span>
                    </a>
                  </div>
                </div>

                {iframeError ? (
                  <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-3">
                    <Icons.AlertTriangle className="w-8 h-8 text-amber-400" />
                    <h3 className="text-sm font-bold text-foreground">Browser Preview Restricted</h3>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Inline iframe was restricted by your browser. You can open the file in a new tab.
                    </p>
                    <a
                      href={fileSource}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-xl shadow"
                    >
                      <Icons.ExternalLink className="w-3.5 h-3.5" /> Open In Separate Tab
                    </a>
                  </div>
                ) : (
                  <iframe
                    src={fileSource}
                    onError={() => setIframeError(true)}
                    className="w-full h-full flex-1 min-h-0 border-0 bg-card"
                    title="PDF Document Preview"
                  />
                )}
              </div>
            ) : isImage ? (
              <div className="w-full h-full min-h-0 flex-1 flex flex-col rounded-2xl overflow-hidden border border-border bg-card shadow-2xl relative">
                {/* Image toolbar with Zoom Controls */}
                <div className="bg-muted/50 border-b border-border px-3 sm:px-4 py-2 flex items-center justify-between text-xs text-muted-foreground shrink-0 gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <Icons.File className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="font-mono text-foreground truncate text-xs">
                      {activeDocument.fileName || 'document.png'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setImageZoom((prev) => Math.max(0.75, Number((prev - 0.25).toFixed(2))))}
                      className="p-1.5 rounded-lg bg-secondary hover:bg-accent text-secondary-foreground hover:text-foreground transition-colors cursor-pointer"
                      title="Zoom Out"
                    >
                      <Icons.Minus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageZoom(1)}
                      className="px-2 py-1 rounded-lg bg-secondary hover:bg-accent text-[10px] font-mono font-bold text-secondary-foreground hover:text-foreground transition-colors cursor-pointer"
                      title="Reset Zoom"
                    >
                      {Math.round(imageZoom * 100)}%
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageZoom((prev) => Math.min(3, Number((prev + 0.25).toFixed(2))))}
                      className="p-1.5 rounded-lg bg-secondary hover:bg-accent text-secondary-foreground hover:text-foreground transition-colors cursor-pointer"
                      title="Zoom In"
                    >
                      <Icons.Plus className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={fileSource}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-secondary hover:bg-accent text-secondary-foreground hover:text-foreground transition-colors"
                      title="Open full size in new tab"
                    >
                      <Icons.ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Scrollable image container */}
                <div className="flex-1 min-h-0 w-full overflow-auto custom-scrollbar p-3 sm:p-6 flex items-center justify-center bg-background/80">
                  <img
                    src={fileSource}
                    alt={activeDocument.fileName || 'Document Preview'}
                    style={{ transform: `scale(${imageZoom})`, transition: 'transform 0.15s ease-out' }}
                    className="max-h-full max-w-full object-contain rounded-xl shadow-2xl border border-border origin-center"
                  />
                </div>
              </div>
            ) : (
              <div className="m-auto w-full max-w-md p-8 bg-card rounded-2xl border border-border text-center space-y-4">
                <div className="w-12 h-12 rounded-xl bg-secondary text-primary flex items-center justify-center mx-auto">
                  <Icons.File className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-foreground">{activeDocument.fileName}</h3>
                <p className="text-xs text-muted-foreground">Attached binary file ready for download.</p>
                <a
                  href={fileSource}
                  download={activeDocument.fileName || 'document'}
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold text-xs px-4 py-2 rounded-xl shadow"
                >
                  <Icons.Download className="w-3.5 h-3.5" /> Download File
                </a>
              </div>
            )
          ) : (
            /* Clean Empty / Missing Storage Fallback */
            <div className="m-auto w-full max-w-lg p-8 bg-card/90 rounded-3xl border border-border text-center space-y-5 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto shadow-inner">
                {isStorageMissing ? (
                  <Icons.AlertTriangle className="w-8 h-8 text-amber-400" />
                ) : (
                  <Icons.File className="w-8 h-8" />
                )}
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-foreground">
                  {isStorageMissing ? 'Storage File Not Found' : 'No Document Scan Attached'}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  {isStorageMissing
                    ? 'The original scan file is not present in cloud storage. You can re-attach or upload the file below.'
                    : 'This document metadata was synced directly from the database without an attached binary file.'}
                </p>
              </div>

              {/* Document Summary Pill */}
              <div className="bg-muted/40 p-4 rounded-2xl border border-border text-left space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Vendor:</span>
                  <span className="font-bold text-foreground truncate max-w-[200px]">{activeDocument.vendorName}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Invoice / Doc #:</span>
                  <span className="font-mono font-bold text-foreground">{activeDocument.invoiceNumber}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Amount:</span>
                  <span className="font-bold text-emerald-400 font-mono">{formatCurrency(activeDocument.amount)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>File Name:</span>
                  <span className="font-mono text-foreground truncate max-w-[200px]">{activeDocument.fileName || 'N/A'}</span>
                </div>
              </div>

              {/* Re-attach File Action */}
              <div className="pt-2 flex flex-col items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={handleReplacementFileUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingReplacement}
                  className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold text-xs py-3 px-5 rounded-2xl shadow-lg transition-all active:scale-95 cursor-pointer"
                >
                  <Icons.Upload className="w-4 h-4" />
                  <span>{isUploadingReplacement ? 'Uploading Document...' : 'Attach / Upload Document Scan'}</span>
                </button>
                {isStorageMissing && (
                  <p className="text-[11px] text-muted-foreground">
                    Tip: Ensure the storage documents bucket is properly configured.
                  </p>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Streamlined Sidebar */}
        <aside
          className={`w-full lg:w-96 h-full min-h-0 bg-card border-t lg:border-t-0 lg:border-l border-border p-4 sm:p-6 flex flex-col justify-between overflow-y-auto flex-shrink-0 ${
            mobileTab === 'details'
              ? 'flex flex-1'
              : 'hidden lg:flex'
          }`}
        >
          {isEditing ? (
            /* Inline Edit Form */
            <form onSubmit={handleSaveSidebar} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Icons.Edit className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Edit Document
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold bg-primary/15 text-primary px-2 py-0.5 rounded border border-primary/25">
                  EDITING
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Construction Site
                </label>
                <select
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  className="w-full bg-background border border-input rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Vendor / Supplier
                </label>
                <input
                  type="text"
                  required
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full bg-background border border-input rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as DocumentType)}
                    className="w-full bg-background border border-input rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="Invoice">Invoice</option>
                    <option value="Challan">Challan</option>
                    <option value="Credit Note">Credit Note</option>
                    <option value="Ledger">Ledger</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    {type === 'Ledger'
                      ? 'Ledger Period / Range'
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
                    className="w-full bg-background border border-input rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    {type === 'Ledger' ? 'Statement Date' : 'Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-background border border-input rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    {type === 'Ledger'
                      ? 'Closing Balance (₹)'
                      : type === 'Credit Note'
                      ? 'Credit Amount (₹)'
                      : 'Amount (₹)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-background border border-input rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 font-bold focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as DocumentStatus)}
                  className="w-full bg-background border border-input rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="uploaded">Pending Verification</option>
                  <option value="verified">Verified</option>
                </select>
              </div>

              <div className="pt-3 border-t border-border space-y-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground font-bold text-xs py-2.5 rounded-xl transition-all shadow flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="w-full bg-secondary hover:bg-accent text-secondary-foreground font-medium text-xs py-2 rounded-xl transition-all border border-border cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            /* View Metadata Mode */
            <div className="flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Metadata
                  </span>
                  {canModify && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-foreground bg-secondary hover:bg-accent px-2.5 py-1 rounded-lg border border-border transition-all cursor-pointer"
                    >
                      <Icons.Edit className="w-3 h-3" /> Edit
                    </button>
                  )}
                </div>

                <div className="bg-muted/40 p-3 rounded-xl border border-border">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">
                    {activeDocument.type === 'Ledger'
                      ? 'Closing / Net Balance'
                      : activeDocument.type === 'Credit Note'
                      ? 'Credit Note Amount'
                      : 'Total Amount'}
                  </span>
                  <span className="text-xl font-black font-mono text-emerald-400">
                    {formatCurrency(activeDocument.amount)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-muted/40 p-3 rounded-xl border border-border">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">
                      Type
                    </span>
                    <span
                      className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                        activeDocument.type === 'Invoice'
                          ? 'bg-secondary text-secondary-foreground border-border'
                          : activeDocument.type === 'Challan'
                          ? 'bg-muted text-muted-foreground border-border'
                          : activeDocument.type === 'Credit Note'
                          ? 'bg-rose-950/80 text-rose-300 border-rose-800/80'
                          : 'bg-sky-950/80 text-sky-300 border-sky-800/80'
                      }`}
                    >
                      {activeDocument.type}
                    </span>
                  </div>
                  <div className="bg-muted/40 p-3 rounded-xl border border-border">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">
                      Status
                    </span>
                    <span className="text-xs font-semibold text-foreground capitalize">
                      {activeDocument.status === 'verified' ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                </div>

                <div className="bg-muted/40 p-3 rounded-xl border border-border">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">
                    Assigned Site
                  </span>
                  <div className="text-xs font-semibold text-foreground">{siteObj?.name || 'Unassigned'}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{siteObj?.code}</div>
                </div>

                <div className="bg-muted/40 p-3 rounded-xl border border-border">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">
                    {activeDocument.type === 'Ledger'
                      ? 'Statement Period / Ref #'
                      : activeDocument.type === 'Credit Note'
                      ? 'Credit Note #'
                      : activeDocument.type === 'Challan'
                      ? 'Challan #'
                      : 'Invoice #'}
                  </span>
                  <div className="text-xs font-mono font-semibold text-foreground">{activeDocument.invoiceNumber}</div>
                </div>

                <div className="bg-muted/40 p-3 rounded-xl border border-border space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>{activeDocument.type === 'Ledger' ? 'Statement Date:' : 'Issue Date:'}</span>
                    <span className="font-mono text-foreground">{formatDate(activeDocument.date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Uploaded By:</span>
                    <span className="text-foreground">{activeDocument.uploadedBy}</span>
                  </div>
                  {activeDocument.verifiedBy && (
                    <div className="flex justify-between text-emerald-400 pt-1 border-t border-border">
                      <span>Verified By:</span>
                      <span>{activeDocument.verifiedBy}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 border-t border-border space-y-2 mt-4">
                {canModify && (
                  <button
                    onClick={() => onDelete(activeDocument)}
                    className="w-full bg-destructive/15 hover:bg-destructive/25 text-destructive font-semibold text-xs py-2 rounded-xl border border-destructive/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Icons.Trash className="w-3.5 h-3.5" />
                    Delete Document
                  </button>
                )}
                <button
                  onClick={onBack}
                  className="w-full bg-secondary hover:bg-accent text-secondary-foreground font-semibold text-xs py-2.5 rounded-xl transition-all cursor-pointer border border-border"
                >
                  Close Preview
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
