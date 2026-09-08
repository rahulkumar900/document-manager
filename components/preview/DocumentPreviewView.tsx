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
    <div className="min-h-screen lg:h-screen bg-neutral-950 text-white flex flex-col font-sans overflow-y-auto lg:overflow-hidden">
      {/* 1. Clean Top Header */}
      <header className="h-16 flex-shrink-0 bg-neutral-900 border-b border-neutral-800 px-4 sm:px-6 flex items-center justify-between z-20">
        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 px-3 py-2 rounded-xl transition-all border border-neutral-700 active:scale-95"
          >
            <Icons.ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="h-4 w-[1px] bg-neutral-800 hidden sm:block" />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-neutral-400 truncate">
                {activeDocument.invoiceNumber}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  activeDocument.status === 'verified'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : 'bg-amber-950 text-amber-300 border-amber-800'
                }`}
              >
                {activeDocument.status === 'verified' ? 'Verified' : 'Pending'}
              </span>
            </div>
            <h1 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
              {activeDocument.vendorName}
            </h1>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center space-x-2">
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
              className="inline-flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold px-3 py-2 rounded-xl border border-neutral-700 transition-all active:scale-95"
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
              className="inline-flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold px-3 py-2 rounded-xl border border-neutral-700 transition-all active:scale-95"
              title="Download original document"
            >
              <Icons.Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Download</span>
            </a>
          )}

          {canVerifyThisDoc && (
            <button
              onClick={() => onVerify(activeDocument.id)}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-md shadow-emerald-950/40 active:scale-95"
            >
              <Icons.Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>Verify</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. Simplified Split Body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-visible lg:overflow-hidden">
        {/* Left / Center: Clean Document Viewer */}
        <div className="w-full lg:flex-1 bg-neutral-950 p-3 sm:p-6 overflow-visible lg:overflow-hidden flex flex-col justify-center items-center relative min-h-[440px] sm:min-h-[580px] lg:min-h-0">
          {fileSource ? (
            isPdf ? (
              <div className="w-full h-full flex flex-col rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-900 shadow-2xl">
                {/* Minimal subheader */}
                <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-2 flex items-center justify-between text-xs text-neutral-400">
                  <div className="flex items-center gap-2 truncate">
                    <Icons.File className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                    <span className="font-mono text-white truncate text-xs">
                      {activeDocument.fileName || 'document.pdf'}
                    </span>
                  </div>
                  {activeDocument.fileSize && (
                    <span className="text-[11px] font-mono bg-neutral-800 px-2 py-0.5 rounded text-neutral-300">
                      {formatFileSize(activeDocument.fileSize)}
                    </span>
                  )}
                </div>

                {iframeError ? (
                  <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-3">
                    <Icons.AlertTriangle className="w-8 h-8 text-amber-400" />
                    <h3 className="text-sm font-bold text-white">Browser Preview Restricted</h3>
                    <p className="text-xs text-neutral-400 max-w-sm">
                      Inline iframe was restricted by your browser. You can open the file in a new tab.
                    </p>
                    <a
                      href={fileSource}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-white text-neutral-950 text-xs font-bold px-4 py-2 rounded-xl shadow"
                    >
                      <Icons.ExternalLink className="w-3.5 h-3.5" /> Open In Separate Tab
                    </a>
                  </div>
                ) : (
                  <iframe
                    src={fileSource}
                    onError={() => setIframeError(true)}
                    className="w-full flex-1 border-0 bg-neutral-900"
                    title="PDF Document Preview"
                  />
                )}
              </div>
            ) : isImage ? (
              <div className="w-full h-full flex items-center justify-center p-4 bg-neutral-900/50 rounded-2xl border border-neutral-800 overflow-auto">
                <img
                  src={fileSource}
                  alt={activeDocument.fileName || 'Document Preview'}
                  className="max-h-full max-w-full object-contain rounded-xl shadow-2xl border border-neutral-800"
                />
              </div>
            ) : (
              <div className="w-full max-w-md p-8 bg-neutral-900 rounded-2xl border border-neutral-800 text-center space-y-4">
                <div className="w-12 h-12 rounded-xl bg-neutral-800 text-purple-400 flex items-center justify-center mx-auto">
                  <Icons.File className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-white">{activeDocument.fileName}</h3>
                <p className="text-xs text-neutral-400">Attached binary file ready for download.</p>
                <a
                  href={fileSource}
                  download={activeDocument.fileName || 'document'}
                  className="inline-flex items-center gap-2 bg-white text-neutral-950 font-bold text-xs px-4 py-2 rounded-xl"
                >
                  <Icons.Download className="w-3.5 h-3.5" /> Download File
                </a>
              </div>
            )
          ) : (
            /* Clean Empty / Missing Storage Fallback */
            <div className="w-full max-w-lg p-8 bg-neutral-900/80 rounded-3xl border border-neutral-800 text-center space-y-5 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-purple-950/80 border border-purple-800/60 text-purple-400 flex items-center justify-center mx-auto shadow-inner">
                {isStorageMissing ? (
                  <Icons.AlertTriangle className="w-8 h-8 text-amber-400" />
                ) : (
                  <Icons.File className="w-8 h-8" />
                )}
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white">
                  {isStorageMissing ? 'Storage File Not Found' : 'No Document Scan Attached'}
                </h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
                  {isStorageMissing
                    ? 'The original scan file is not present in cloud storage. You can re-attach or upload the file below.'
                    : 'This document metadata was synced directly from the database without an attached binary file.'}
                </p>
              </div>

              {/* Document Summary Pill */}
              <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-800/80 text-left space-y-2 text-xs">
                <div className="flex justify-between text-neutral-400">
                  <span>Vendor:</span>
                  <span className="font-bold text-white truncate max-w-[200px]">{activeDocument.vendorName}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Invoice / Doc #:</span>
                  <span className="font-mono font-bold text-purple-300">{activeDocument.invoiceNumber}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Amount:</span>
                  <span className="font-bold text-emerald-400 font-mono">{formatCurrency(activeDocument.amount)}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>File Name:</span>
                  <span className="font-mono text-neutral-300 truncate max-w-[200px]">{activeDocument.fileName || 'N/A'}</span>
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
                  className="w-full inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800/60 text-white font-bold text-xs py-3 px-5 rounded-2xl shadow-lg shadow-purple-950/50 transition-all active:scale-95 cursor-pointer"
                >
                  <Icons.Upload className="w-4 h-4" />
                  <span>{isUploadingReplacement ? 'Uploading Document...' : 'Attach / Upload Document Scan'}</span>
                </button>
                {isStorageMissing && (
                  <p className="text-[11px] text-neutral-500">
                    Tip: Ensure the storage documents bucket is properly configured.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Streamlined Sidebar */}
        <aside className="w-full lg:w-96 bg-neutral-900 border-t lg:border-t-0 lg:border-l border-neutral-800 p-4 sm:p-6 flex flex-col justify-between overflow-visible lg:overflow-y-auto flex-shrink-0">
          {isEditing ? (
            /* Inline Edit Form */
            <form onSubmit={handleSaveSidebar} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <Icons.Edit className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    Edit Document
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold bg-purple-950 text-purple-300 px-2 py-0.5 rounded border border-purple-800">
                  EDITING
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                  Construction Site
                </label>
                <select
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-neutral-500"
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                  Vendor / Supplier
                </label>
                <input
                  type="text"
                  required
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-neutral-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                    Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as DocumentType)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-neutral-500"
                  >
                    <option value="Invoice">Invoice</option>
                    <option value="Challan">Challan</option>
                    <option value="Credit Note">Credit Note</option>
                    <option value="Ledger">Ledger</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
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
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-neutral-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                    {type === 'Ledger' ? 'Statement Date' : 'Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-neutral-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
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
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 font-bold focus:outline-none focus:border-neutral-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as DocumentStatus)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-neutral-500"
                >
                  <option value="uploaded">Pending Verification</option>
                  <option value="verified">Verified</option>
                </select>
              </div>

              <div className="pt-3 border-t border-neutral-800 space-y-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-white hover:bg-neutral-200 active:scale-95 text-neutral-950 font-bold text-xs py-2.5 rounded-xl transition-all shadow flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="w-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium text-xs py-2 rounded-xl transition-all border border-neutral-700 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            /* View Metadata Mode */
            <div className="flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Metadata
                  </span>
                  {canModify && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1 rounded-lg border border-neutral-700 transition-all cursor-pointer"
                    >
                      <Icons.Edit className="w-3 h-3" /> Edit
                    </button>
                  )}
                </div>

                <div className="bg-neutral-950/60 p-3 rounded-xl border border-neutral-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">
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
                  <div className="bg-neutral-950/60 p-3 rounded-xl border border-neutral-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">
                      Type
                    </span>
                    <span
                      className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                        activeDocument.type === 'Invoice'
                          ? 'bg-purple-950/80 text-purple-300 border-purple-800/80'
                          : activeDocument.type === 'Challan'
                          ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800/80'
                          : activeDocument.type === 'Credit Note'
                          ? 'bg-rose-950/80 text-rose-300 border-rose-800/80'
                          : 'bg-sky-950/80 text-sky-300 border-sky-800/80'
                      }`}
                    >
                      {activeDocument.type}
                    </span>
                  </div>
                  <div className="bg-neutral-950/60 p-3 rounded-xl border border-neutral-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">
                      Status
                    </span>
                    <span className="text-xs font-semibold text-white capitalize">
                      {activeDocument.status === 'verified' ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                </div>

                <div className="bg-neutral-950/60 p-3 rounded-xl border border-neutral-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">
                    Assigned Site
                  </span>
                  <div className="text-xs font-semibold text-white">{siteObj?.name || 'Unassigned'}</div>
                  <div className="text-[10px] text-neutral-500 font-mono">{siteObj?.code}</div>
                </div>

                <div className="bg-neutral-950/60 p-3 rounded-xl border border-neutral-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">
                    {activeDocument.type === 'Ledger'
                      ? 'Statement Period / Ref #'
                      : activeDocument.type === 'Credit Note'
                      ? 'Credit Note #'
                      : activeDocument.type === 'Challan'
                      ? 'Challan #'
                      : 'Invoice #'}
                  </span>
                  <div className="text-xs font-mono font-semibold text-white">{activeDocument.invoiceNumber}</div>
                </div>

                <div className="bg-neutral-950/60 p-3 rounded-xl border border-neutral-800 space-y-1.5 text-xs text-neutral-400">
                  <div className="flex justify-between">
                    <span>{activeDocument.type === 'Ledger' ? 'Statement Date:' : 'Issue Date:'}</span>
                    <span className="font-mono text-neutral-300">{formatDate(activeDocument.date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Uploaded By:</span>
                    <span className="text-neutral-300">{activeDocument.uploadedBy}</span>
                  </div>
                  {activeDocument.verifiedBy && (
                    <div className="flex justify-between text-emerald-400 pt-1 border-t border-neutral-800/80">
                      <span>Verified By:</span>
                      <span>{activeDocument.verifiedBy}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 border-t border-neutral-800 space-y-2 mt-4">
                {canModify && (
                  <button
                    onClick={() => onDelete(activeDocument)}
                    className="w-full bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 font-semibold text-xs py-2 rounded-xl border border-rose-800/50 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Icons.Trash className="w-3.5 h-3.5" />
                    Delete Document
                  </button>
                )}
                <button
                  onClick={onBack}
                  className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs py-2.5 rounded-xl transition-all"
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
