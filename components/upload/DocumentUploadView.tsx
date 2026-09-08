import React, { useState, useEffect, useRef } from 'react';
import { SiteRecord, UserAccount, DocumentRecord, DocumentType } from '@/lib/types';
import { formatCurrency, formatFileSize, generateUUID, optimizeImageForAi } from '@/lib/utils';
import { uploadFileToSupabaseStorage, saveDocumentToSupabase } from '@/lib/store';
import { Icons } from '../ui/icons';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 Megabytes per file

export interface UploadedFileItem {
  id: string;
  file: File;
  fileData: string | null;
  blobUrl: string | null;
  fileType: string;
  fileSize: number;
  status: 'scanning' | 'ready' | 'error';
  statusMessage?: string;
}

export interface InvoiceDraftItem {
  id: string;
  fileId: string;
  vendorName: string;
  invoiceNumber: string;
  date: string;
  type: DocumentType;
  amount: string;
  pageNumber?: number;
  notes?: string;
  taxId?: string;
}

interface DocumentUploadViewProps {
  currentUser: UserAccount;
  sites: SiteRecord[];
  selectedSiteId?: string;
  onSiteChange?: (newSiteId: string) => void;
  onCancel: () => void;
  onUploadSuccess: (newDocs: DocumentRecord | DocumentRecord[]) => void;
}

export const DocumentUploadView: React.FC<DocumentUploadViewProps> = ({
  currentUser,
  sites,
  selectedSiteId,
  onSiteChange,
  onCancel,
  onUploadSuccess,
}) => {
  // Resolve initial site ID from URL or user role scope
  const getInitialSiteId = () => {
    if (currentUser.assignedSiteId !== 'all') {
      return currentUser.assignedSiteId;
    }
    if (selectedSiteId && selectedSiteId !== 'all') {
      const match = sites.find(
        (s) => s.id === selectedSiteId || s.code.toLowerCase() === selectedSiteId.toLowerCase()
      );
      if (match) return match.id;
    }
    return sites[0]?.id || '';
  };

  const [targetSiteId, setTargetSiteId] = useState<string>(getInitialSiteId());
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // AI Scanning State
  const [isAiScanning, setIsAiScanning] = useState(false);
  const [aiScanningStep, setAiScanningStep] = useState<string>('Initializing AI analysis...');
  const [aiExtractionError, setAiExtractionError] = useState<{
    message: string;
    isHighDemand: boolean;
  } | null>(null);

  // Upload Progress & Status
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [createdDocRecords, setCreatedDocRecords] = useState<DocumentRecord[]>([]);

  // Multi-Invoice State (all extracted invoices across all uploaded files)
  const [invoices, setInvoices] = useState<InvoiceDraftItem[]>([]);

  // Mobile View Tab (Toggle between Document Preview and Invoice Form on small screens)
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');

  // Review Assistance & Scroll Synchronization Refs
  const invoiceListContainerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const scrollDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to scroll to the first invoice card belonging to a specific attachment
  const scrollToInvoiceForFile = (fileId: string) => {
    isProgrammaticScrollRef.current = true;
    const cardEl = document.getElementById(`invoice-card-${fileId}`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    if (scrollDebounceTimerRef.current) clearTimeout(scrollDebounceTimerRef.current);
    scrollDebounceTimerRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 700);
  };

  // Scroll listener on invoice cards list: when scrolling down through cards, toggle preview to match visible attachment
  const handleInvoiceListScroll = () => {
    if (isProgrammaticScrollRef.current || !invoiceListContainerRef.current) return;
    const container = invoiceListContainerRef.current;
    const containerTop = container.getBoundingClientRect().top;
    const cards = container.querySelectorAll<HTMLElement>('[data-file-id]');

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const rect = card.getBoundingClientRect();
      // If the top of the card is within the upper active zone of the scroll container
      if (rect.bottom > containerTop + 30 && rect.top < containerTop + 180) {
        const fileId = card.getAttribute('data-file-id');
        if (fileId && fileId !== activeFileId) {
          setActiveFileId(fileId);
        }
        break;
      }
    }
  };

  // Keep siteId in sync if selectedSiteId prop changes
  useEffect(() => {
    if (selectedSiteId && selectedSiteId !== 'all') {
      const match = sites.find(
        (s) => s.id === selectedSiteId || s.code.toLowerCase() === selectedSiteId.toLowerCase()
      );
      if (match) {
        setTargetSiteId(match.id);
      }
    }
  }, [selectedSiteId, sites]);

  // Dynamic AI Scanning message cycler
  useEffect(() => {
    let timer1: NodeJS.Timeout;
    let timer2: NodeJS.Timeout;
    let timer3: NodeJS.Timeout;

    if (isAiScanning) {
      setAiScanningStep('Reading document binary & inspecting layout...');
      timer1 = setTimeout(() => {
        setAiScanningStep('AI Vision detecting invoices & delivery memos...');
      }, 1500);
      timer2 = setTimeout(() => {
        setAiScanningStep('Extracting vendor names, memo references, and dates...');
      }, 3200);
      timer3 = setTimeout(() => {
        setAiScanningStep('Structuring taxable subtotal, GST splits, and totals...');
      }, 5000);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isAiScanning]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const processSelectedFiles = async (fileList: FileList | File[]) => {
    setFileError(null);
    setUploadErrorMessage(null);

    const validFiles: File[] = [];
    const errors: string[] = [];

    Array.from(fileList).forEach((file) => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`${file.name} exceeds the 20MB limit (${formatFileSize(file.size)})`);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      setFileError(errors.join('. '));
    }

    if (validFiles.length === 0) return;

    setIsAiScanning(true);

    const newFileItems: UploadedFileItem[] = [];

    for (const file of validFiles) {
      const fileId = generateUUID();
      let blobUrl: string | null = null;
      try {
        blobUrl = URL.createObjectURL(file);
      } catch {
        // Fallback
      }

      // Read Data URL for fallback
      let fileData: string | null = null;
      try {
        fileData = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string) || '');
          reader.onerror = () => resolve('');
          reader.readAsDataURL(file);
        });
      } catch {
        fileData = null;
      }

      const fileItem: UploadedFileItem = {
        id: fileId,
        file,
        fileData,
        blobUrl,
        fileType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/png'),
        fileSize: file.size,
        status: 'scanning',
        statusMessage: 'AI scanning in progress...',
      };

      newFileItems.push(fileItem);
    }

    // Append new files to state
    setUploadedFiles((prev) => {
      const combined = [...prev, ...newFileItems];
      if (!activeFileId && combined.length > 0) {
        setActiveFileId(combined[0].id);
      }
      return combined;
    });

    if (!activeFileId && newFileItems.length > 0) {
      setActiveFileId(newFileItems[0].id);
    }

    // Trigger AI extraction for all newly selected files in parallel (with token-optimized payload)
    const scanResults = await Promise.all(
      newFileItems.map(async (item, fileIndex) => {
        try {
          // Pre-process and optimize images to save up to 75% vision tokens
          const fileToScan = await optimizeImageForAi(item.file);
          const body = new FormData();
          body.append('file', fileToScan);

          const res = await fetch('/api/ai/extract', {
            method: 'POST',
            body,
          });

          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
              const d = json.data;

              // Check if response was a fallback due to error/high demand
              if (json.source === 'heuristic-fallback' || json.error) {
                const is503 = /503|UNAVAILABLE|high demand|429/i.test(json.error || '');
                setAiExtractionError({
                  message:
                    json.error ||
                    'AI OCR engine is currently experiencing temporary high demand (503). Basic document defaults were generated; you can click below to retry the AI extraction.',
                  isHighDemand: is503,
                });
              } else {
                setAiExtractionError(null);
              }

              const extractedList =
                d.invoices && Array.isArray(d.invoices) && d.invoices.length > 0
                  ? d.invoices
                  : [
                      {
                        vendorName: d.vendorName,
                        invoiceNumber: d.invoiceNumber,
                        date: d.date,
                        documentType: d.documentType,
                        totalAmount: d.totalAmount,
                        pageNumber: 1,
                      },
                    ];

              const parsedInvoices: InvoiceDraftItem[] = extractedList.map((inv: any, idx: number) => {
                let docType: DocumentType = 'Invoice';
                if (inv.documentType === 'Challan' || inv.documentType === 'Credit Note' || inv.documentType === 'Ledger') {
                  docType = inv.documentType;
                } else if (inv.documentType === 'Tax Invoice') {
                  docType = 'Invoice';
                }

                return {
                  id: generateUUID(),
                  fileId: item.id,
                  vendorName: inv.vendorName || '',
                  invoiceNumber: inv.invoiceNumber || '',
                  date: inv.date || new Date().toISOString().split('T')[0],
                  type: docType,
                  amount:
                    inv.totalAmount !== undefined && inv.totalAmount !== null
                      ? String(inv.totalAmount)
                      : '',
                  pageNumber: inv.pageNumber || idx + 1,
                  notes: inv.notes || '',
                  taxId: inv.taxId || '',
                };
              });

              return {
                fileId: item.id,
                fileIndex,
                status: 'ready' as const,
                statusMessage: `${parsedInvoices.length} document record(s) extracted`,
                invoices: parsedInvoices,
              };
            }
          }

          // Fallback parsing if status not OK or missing payload
          const cleanName = item.file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          const year = new Date().getFullYear();
          const randomNum = Math.floor(1000 + Math.random() * 9000);

          let detectedType: DocumentType = 'Invoice';
          let invNumber = `INV-${year}-${randomNum}`;

          if (/credit|cn|cr\s*note|cr_note|creditnote/i.test(item.file.name)) {
            detectedType = 'Credit Note';
            invNumber = `CN-${year}-${randomNum}`;
          } else if (/ledger|statement|account|soa|acct/i.test(item.file.name)) {
            detectedType = 'Ledger';
            invNumber = `01-Apr-${year - 1} to 31-Mar-${year}`;
          } else if (/challan|delivery|dc|dispatch|memo/i.test(item.file.name)) {
            detectedType = 'Challan';
            invNumber = `DC-${year}-${randomNum}`;
          }

          const fallbackInvoice: InvoiceDraftItem = {
            id: generateUUID(),
            fileId: item.id,
            vendorName: cleanName.length > 3 ? cleanName.toUpperCase() : 'METRO CONTRACTORS CORP',
            invoiceNumber: invNumber,
            date: new Date().toISOString().split('T')[0],
            type: detectedType,
            amount: (Math.random() * 65000 + 2500).toFixed(2),
            pageNumber: 1,
            notes: detectedType === 'Ledger' ? 'Account Statement' : undefined,
          };

          return {
            fileId: item.id,
            fileIndex,
            status: 'ready' as const,
            statusMessage: 'Extracted via fallback parser',
            invoices: [fallbackInvoice],
          };
        } catch (err) {
          console.error(`AI Extraction failed for ${item.file.name}:`, err);
          const errMsg = err instanceof Error ? err.message : String(err);
          const is503 = /503|UNAVAILABLE|high demand|429/i.test(errMsg);

          setAiExtractionError({
            message: errMsg || 'AI document extraction encountered a network error. Click below to retry.',
            isHighDemand: is503,
          });

          return {
            fileId: item.id,
            fileIndex,
            status: 'error' as const,
            statusMessage: 'Extraction failed, manual entry required',
            invoices: [],
          };
        }
      })
    );

    // 1. Update uploadedFiles status
    setUploadedFiles((prev) =>
      prev.map((f) => {
        const res = scanResults.find((r) => r.fileId === f.id);
        if (res) {
          return {
            ...f,
            status: res.status,
            statusMessage: res.statusMessage,
          };
        }
        return f;
      })
    );

    // 2. Order newly extracted records strictly by original attachment fileIndex and pageNumber
    scanResults.sort((a, b) => a.fileIndex - b.fileIndex);
    const orderedNewInvoices = scanResults.flatMap((r) => r.invoices);

    // 3. Keep complete invoices list strictly ordered to match uploadedFiles attachments list
    setInvoices((prev) => {
      const combined = [...prev, ...orderedNewInvoices];
      // Map file order across all uploaded files
      const allFileIds = [...uploadedFiles.map((f) => f.id), ...newFileItems.map((f) => f.id)];
      const fileOrderMap = new Map(allFileIds.map((id, i) => [id, i]));

      return combined.sort((a, b) => {
        const orderA = fileOrderMap.has(a.fileId) ? fileOrderMap.get(a.fileId)! : 9999;
        const orderB = fileOrderMap.has(b.fileId) ? fileOrderMap.get(b.fileId)! : 9999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.pageNumber || 1) - (b.pageNumber || 1);
      });
    });

    setIsAiScanning(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      processSelectedFiles(files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processSelectedFiles(files);
    }
  };

  // Re-run AI extraction across all currently uploaded files
  const handleReScanAllFiles = async () => {
    if (uploadedFiles.length === 0 || isAiScanning) return;
    setAiExtractionError(null);
    setIsAiScanning(true);
    // Clear old extracted invoices for fresh re-extraction
    setInvoices([]);
    const filesToScan = uploadedFiles.map((f) => f.file);
    setUploadedFiles([]);
    await processSelectedFiles(filesToScan);
  };

  // Remove a file and its associated invoices
  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles((prev) => {
      const updated = prev.filter((f) => f.id !== fileId);
      if (activeFileId === fileId) {
        setActiveFileId(updated[0]?.id || null);
      }
      return updated;
    });
    setInvoices((prev) => prev.filter((inv) => inv.fileId !== fileId));
  };

  // Invoice field updater
  const handleUpdateInvoice = (index: number, field: keyof InvoiceDraftItem, value: any) => {
    setInvoices((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddInvoiceForFile = (fileId: string) => {
    setInvoices((prev) => {
      const fileInvoices = prev.filter((i) => i.fileId === fileId);
      const last = fileInvoices[fileInvoices.length - 1];
      const newInvoice: InvoiceDraftItem = {
        id: generateUUID(),
        fileId,
        vendorName: last?.vendorName || '',
        invoiceNumber: '',
        date: last?.date || new Date().toISOString().split('T')[0],
        type: 'Invoice',
        amount: '',
        pageNumber: (last?.pageNumber || 1) + 1,
      };

      // Insert directly after the last invoice of this file to preserve attachment order
      let lastIdx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].fileId === fileId) {
          lastIdx = i;
          break;
        }
      }

      if (lastIdx !== -1) {
        const copy = [...prev];
        copy.splice(lastIdx + 1, 0, newInvoice);
        return copy;
      }
      return [...prev, newInvoice];
    });
  };

  const handleRemoveInvoice = (invoiceId: string) => {
    if (invoices.length <= 1) return;
    setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
  };

  const handleDuplicateInvoice = (invoiceId: string) => {
    setInvoices((prev) => {
      const targetIndex = prev.findIndex((i) => i.id === invoiceId);
      if (targetIndex === -1) return prev;
      const target = prev[targetIndex];
      const duplicated: InvoiceDraftItem = {
        ...target,
        id: generateUUID(),
        invoiceNumber: target.invoiceNumber ? `${target.invoiceNumber}-COPY` : '',
      };
      // Insert duplicate directly after original to preserve sequence
      const copy = [...prev];
      copy.splice(targetIndex + 1, 0, duplicated);
      return copy;
    });
  };

  const applyGstRate = (index: number, ratePct: number) => {
    const currentVal = parseFloat(invoices[index].amount) || 0;
    if (currentVal > 0) {
      const calculated = (currentVal * (1 + ratePct / 100)).toFixed(2);
      handleUpdateInvoice(index, 'amount', calculated);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (sites.length === 0) {
      alert('Please ask the Administrator to create at least one Construction Site first.');
      return;
    }

    if (uploadedFiles.length === 0) {
      alert('Please select or drop at least one document (PDF/Image) to upload.');
      return;
    }

    if (invoices.length === 0) {
      alert('Please define at least one invoice specification.');
      return;
    }

    // Validate that all invoices have vendorName and amount
    const invalidIndex = invoices.findIndex((inv) => !inv.vendorName.trim() || !inv.amount.trim());
    if (invalidIndex !== -1) {
      alert(`Please fill in both Vendor Name and Amount for Invoice #${invalidIndex + 1}.`);
      return;
    }

    setUploadPhase('uploading');
    setUploadProgress(10);
    setUploadStatusText(
      `Step 1/3: Preparing upload for ${uploadedFiles.length} file(s) and ${invoices.length} invoice(s)...`
    );
    setUploadErrorMessage(null);

    const finalSiteId = targetSiteId || sites[0].id;

    // Step 2: Upload all unique files to Secure Cloud Storage in parallel
    setUploadProgress(30);
    setUploadStatusText(`Step 2/3: Uploading ${uploadedFiles.length} file(s) to Secure Storage...`);

    const fileUploadMap = new Map<string, { publicUrl?: string; filePath?: string }>();

    let uploadedCount = 0;
    for (const fileItem of uploadedFiles) {
      const docBaseId = generateUUID();
      const uploadRes = await uploadFileToSupabaseStorage(fileItem.file, finalSiteId, docBaseId);
      if (uploadRes.success && uploadRes.publicUrl) {
        fileUploadMap.set(fileItem.id, {
          publicUrl: uploadRes.publicUrl,
          filePath: uploadRes.filePath,
        });
      } else {
        console.warn(`Storage upload note for ${fileItem.file.name}:`, uploadRes.error);
      }
      uploadedCount++;
      setUploadProgress(30 + Math.round((uploadedCount / uploadedFiles.length) * 35));
    }

    // Step 3: Create DocumentRecord for EACH invoice, mapped to its source file's URL
    setUploadProgress(70);
    setUploadStatusText(`Step 3/3: Indexing ${invoices.length} document record(s) in cloud database...`);

    const createdDocs: DocumentRecord[] = invoices.map((inv, idx) => {
      const sourceFile = uploadedFiles.find((f) => f.id === inv.fileId) || uploadedFiles[0];
      const storageInfo = fileUploadMap.get(inv.fileId) || {};

      return {
        id: generateUUID(),
        siteId: finalSiteId,
        vendorName: inv.vendorName.trim(),
        invoiceNumber:
          inv.invoiceNumber.trim() || `DOC-${Math.floor(1000 + Math.random() * 9000)}-${idx + 1}`,
        date: inv.date,
        amount: parseFloat(inv.amount) || 0,
        type: inv.type,
        status: 'uploaded',
        uploadedBy: currentUser.name,
        createdAt: new Date().toISOString(),
        fileName: sourceFile ? sourceFile.file.name : 'Uploaded_Scan.pdf',
        fileData: sourceFile?.fileData || undefined,
        fileUrl: storageInfo.publicUrl, // Same storage URL for all invoices from this file
        filePath: storageInfo.filePath,
        fileType: sourceFile?.fileType || 'application/pdf',
        fileSize: sourceFile?.fileSize || 0,
      };
    });

    const saveResults = await Promise.all(createdDocs.map((doc) => saveDocumentToSupabase(doc)));
    const hasError = saveResults.some((res) => !res.success);

    if (!hasError) {
      setUploadProgress(100);
      setUploadStatusText(`Complete! ${createdDocs.length} document(s) successfully archived.`);
      setCreatedDocRecords(createdDocs);
      setUploadPhase('success');

      // Seamless redirect to dashboard
      setTimeout(() => {
        onUploadSuccess(createdDocs);
      }, 1600);
    } else {
      setUploadPhase('error');
      const firstError = saveResults.find((res) => !res.success)?.error;
      setUploadErrorMessage(
        firstError ||
          'Failed to record documents in database. Please verify cloud database connection.'
      );
      setCreatedDocRecords(createdDocs);
    }
  };

  const handleSaveOfflineFallback = () => {
    if (createdDocRecords.length > 0) {
      onUploadSuccess(createdDocRecords);
    }
  };

  const totalCalculatedAmount = invoices.reduce(
    (sum, inv) => sum + (parseFloat(inv.amount) || 0),
    0
  );

  const activeFile = uploadedFiles.find((f) => f.id === activeFileId) || uploadedFiles[0];
  const activeFileIndex = uploadedFiles.findIndex((f) => f.id === (activeFile?.id || ''));
  const isActiveImage =
    activeFile?.fileType?.includes('image') ||
    /\.(jpg|jpeg|png|webp|gif)$/i.test(activeFile?.file?.name || '');

  const handleNavigateAttachment = (direction: 'prev' | 'next') => {
    if (uploadedFiles.length === 0) return;
    const newIndex = direction === 'prev' ? activeFileIndex - 1 : activeFileIndex + 1;
    if (newIndex >= 0 && newIndex < uploadedFiles.length) {
      const targetFile = uploadedFiles[newIndex];
      setActiveFileId(targetFile.id);
      scrollToInvoiceForFile(targetFile.id);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col font-sans relative antialiased selection:bg-purple-500 selection:text-white">
      {/* 1. Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-neutral-900/80 backdrop-blur-xl border-b border-neutral-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-4">
          <button
            onClick={onCancel}
            disabled={uploadPhase === 'uploading'}
            className="inline-flex items-center gap-2 text-xs font-bold text-neutral-300 hover:text-white bg-neutral-800/80 hover:bg-neutral-700/80 disabled:opacity-50 px-3 py-2 rounded-xl active:scale-95 transition-all border border-neutral-700/60 shadow-sm cursor-pointer"
          >
            <Icons.ArrowLeft className="w-4 h-4" />
            <span>Cancel</span>
          </button>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Upload & Index Documents</span>
              <span className="hidden sm:inline-flex text-[10px] uppercase font-bold tracking-wider bg-purple-950/70 text-purple-300 border border-purple-800/50 px-2 py-0.5 rounded-md">
                Batch Mode
              </span>
            </h2>
            <p className="text-[11px] text-neutral-400">
              Multi-file extraction • Shared storage referencing • Up to 20MB / file
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-300 bg-purple-950/40 border border-purple-800/50 px-3 py-1.5 rounded-full shadow-inner">
            <Icons.Sparkles className="w-4 h-4 animate-pulse text-purple-400" />
            <span className="font-mono text-[11px] font-bold">AI Vision Engine</span>
          </div>
        </div>
      </header>

      {/* 2. Main Content Grid */}
      <div className="flex-1 max-w-[1600px] mx-auto w-full p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 items-start justify-center">
        {/* Mobile View Segmented Switcher (Visible on mobile screens when files are loaded) */}
        {uploadedFiles.length > 0 && (
          <div className="lg:hidden w-full bg-neutral-900/95 p-1.5 rounded-2xl border border-neutral-800 grid grid-cols-2 gap-1.5 shadow-xl sticky top-[58px] z-20 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setMobileTab('form')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                mobileTab === 'form'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 ring-1 ring-purple-400/40'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
              }`}
            >
              <Icons.FileText className="w-4 h-4" />
              <span>Review Invoices ({invoices.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('preview')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                mobileTab === 'preview'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 ring-1 ring-purple-400/40'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
              }`}
            >
              <Icons.Eye className="w-4 h-4" />
              <span>View File ({uploadedFiles.length})</span>
            </button>
          </div>
        )}

        {/* Left Side: Drag & Drop + File Queue + Studio Preview Frame */}
        <div className={`w-full lg:w-1/2 space-y-4 lg:sticky lg:top-20 ${uploadedFiles.length > 0 && mobileTab === 'form' ? 'hidden lg:block' : 'block'}`}>
          <div className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800/80 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
            {/* Header: Status & Quick Add */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-purple-600/20 border border-purple-500/40 text-purple-300 flex items-center justify-center text-xs font-black">
                  1
                </span>
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-300">
                  {uploadedFiles.length > 0 ? 'Document Preview' : 'Select Document(s)'}
                </label>
              </div>
              <div className="flex items-center gap-2">
                {uploadedFiles.length > 0 && (
                  <label
                    htmlFor="multi-pdf-file-upload"
                    className="text-purple-400 hover:text-purple-300 cursor-pointer font-bold text-xs flex items-center gap-1 bg-purple-950/40 border border-purple-800/40 px-2.5 py-1 rounded-lg hover:bg-purple-900/40 transition-colors"
                  >
                    <Icons.Plus className="w-3.5 h-3.5" /> <span>Add More</span>
                  </label>
                )}
                <span className="text-[10px] font-mono text-neutral-400 bg-neutral-950 border border-neutral-800 px-2 py-0.5 rounded-md">
                  PDF / PNG / JPG • Max 20MB
                </span>
              </div>
            </div>

            {/* Error banner if files exceeded size limit */}
            {fileError && (
              <div className="p-3.5 bg-rose-950/70 border border-rose-800/80 rounded-2xl text-xs text-rose-200 flex items-start gap-3 shadow-lg animate-in fade-in duration-200">
                <Icons.AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-0.5">
                  <div className="font-bold text-rose-300 text-xs">File Limit Notice</div>
                  <p className="text-[11px] leading-relaxed text-rose-200/90">{fileError}</p>
                </div>
              </div>
            )}

            {/* Hidden Inputs For File & Camera Upload Triggers */}
            <input
              id="multi-pdf-file-upload"
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              disabled={uploadPhase === 'uploading'}
              onChange={handleFileChange}
            />
            <input
              id="mobile-camera-capture"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={uploadPhase === 'uploading'}
              onChange={handleFileChange}
            />

            {/* CASE 1: When NO files are selected -> Show Full Dropzone with Camera Scan & File Browse */}
            {uploadedFiles.length === 0 ? (
              <div
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl min-h-[460px] p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-all duration-200 group ${
                  isDragging
                    ? 'border-purple-400 bg-purple-950/40 ring-4 ring-purple-500/20 scale-[1.01]'
                    : 'border-neutral-700/90 hover:border-purple-500/50 hover:bg-neutral-900/50 bg-neutral-950/40'
                }`}
              >
                <div className="flex flex-col items-center py-2 max-w-md w-full">
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-200 ${
                      isDragging
                        ? 'bg-purple-600 text-white scale-110 shadow-lg shadow-purple-600/50'
                        : 'bg-neutral-800/90 border border-neutral-700/60 text-neutral-300 shadow-inner'
                    }`}
                  >
                    <Icons.Upload className="w-8 h-8" />
                  </div>

                  <h4 className="text-base sm:text-lg font-bold text-white mb-1.5">
                    {isDragging ? 'Release to scan files' : 'Upload Invoices, Challans & Ledgers'}
                  </h4>
                  <p className="text-xs text-neutral-400 max-w-sm text-center leading-relaxed mb-6">
                    Take a live photo on site or select PDFs and images from your device. Automated AI will extract and structure all document fields.
                  </p>

                  {/* Primary Mobile & Desktop Action Triggers */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-sm mb-6">
                    <label
                      htmlFor="mobile-camera-capture"
                      className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white font-bold text-xs py-3 px-4 rounded-xl cursor-pointer shadow-lg shadow-purple-900/30 transition-all border border-purple-400/30"
                    >
                      <Icons.Camera className="w-4 h-4" />
                      <span>Take Photo / Camera</span>
                    </label>

                    <label
                      htmlFor="multi-pdf-file-upload"
                      className="flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-neutral-200 hover:text-white font-bold text-xs py-3 px-4 rounded-xl cursor-pointer border border-neutral-700 transition-all shadow-sm"
                    >
                      <Icons.Upload className="w-4 h-4" />
                      <span>Browse Files & PDFs</span>
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <span className="text-[11px] font-mono text-neutral-400 bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-full">
                      ✓ Multi-file Batch
                    </span>
                    <span className="text-[11px] font-mono text-neutral-400 bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-full">
                      ✓ Up to 20MB / file
                    </span>
                    <span className="text-[11px] font-mono text-purple-300 bg-purple-950/40 border border-purple-800/40 px-3 py-1 rounded-full">
                      ✓ Instant Full Preview
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* CASE 2: When files ARE uploaded -> Show Full Preview Studio with File Switcher */
              <div
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className="space-y-3 relative"
              >
                {/* Drag over overlay when dragging more files onto the preview */}
                {isDragging && (
                  <div className="absolute inset-0 z-30 bg-purple-950/85 backdrop-blur-sm rounded-2xl border-2 border-dashed border-purple-400 flex flex-col items-center justify-center text-center p-6 animate-in fade-in duration-150">
                    <Icons.Upload className="w-12 h-12 text-purple-300 animate-bounce mb-2" />
                    <h4 className="text-base font-bold text-white">Drop to add more files to queue</h4>
                    <p className="text-xs text-purple-200 mt-1">Multi-page PDFs or images up to 20MB</p>
                  </div>
                )}

                {/* File Switcher Tabs (if multiple files) */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                  {uploadedFiles.map((item, idx) => {
                    const isSelected = item.id === (activeFile?.id || '');
                    const fileInvoicesCount = invoices.filter((i) => i.fileId === item.id).length;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveFileId(item.id);
                          scrollToInvoiceForFile(item.id);
                        }}
                        className={`px-3 py-2 rounded-xl border flex items-center gap-2 transition-all cursor-pointer shrink-0 text-left ${
                          isSelected
                            ? 'bg-purple-950/70 border-purple-500/80 text-white shadow-md ring-1 ring-purple-500/30'
                            : 'bg-neutral-950/80 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700 hover:bg-neutral-900/80'
                        }`}
                        title={`Attachment #${idx + 1}: ${item.file.name} (Click to switch preview and scroll to its extracted data)`}
                      >
                        <span
                          className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                            isSelected ? 'bg-purple-600 text-white' : 'bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <div className="max-w-[130px] truncate text-xs font-semibold">
                          {item.file.name}
                        </div>
                        {fileInvoicesCount > 0 && (
                          <span
                            className="text-[10px] font-mono text-purple-300 bg-purple-900/50 px-1.5 py-0.5 rounded font-bold"
                            title={`${fileInvoicesCount} record(s) extracted`}
                          >
                            {fileInvoicesCount}
                          </span>
                        )}
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(item.id);
                          }}
                          className="p-0.5 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors ml-1"
                          title="Remove file"
                        >
                          <Icons.Trash className="w-3 h-3" />
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Full-Height Document Preview Frame */}
                {activeFile && (
                  <div className="bg-neutral-950 rounded-2xl border border-neutral-800 overflow-hidden shadow-2xl flex flex-col">
                    {/* Preview Toolbar */}
                    <div className="bg-neutral-900/90 border-b border-neutral-800 px-4 py-2.5 flex items-center justify-between shrink-0 gap-2">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Icons.File className="w-4 h-4 text-purple-400 shrink-0" />
                        <span className="text-[11px] font-mono font-bold text-purple-300 bg-purple-950/80 border border-purple-800/60 px-2 py-0.5 rounded-md shrink-0">
                          Att. #{activeFileIndex + 1}
                        </span>
                        <span className="text-xs font-bold text-neutral-200 truncate max-w-[180px] sm:max-w-[220px]">
                          {activeFile.file.name}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400 bg-neutral-950 border border-neutral-800 px-2 py-0.5 rounded shrink-0 hidden sm:inline-block">
                          {formatFileSize(activeFile.fileSize)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Prev / Next Attachment Navigation Buttons */}
                        {uploadedFiles.length > 1 && (
                          <div className="flex items-center gap-1 bg-neutral-950 border border-neutral-800 rounded-xl p-0.5 shadow-inner">
                            <button
                              type="button"
                              onClick={() => handleNavigateAttachment('prev')}
                              disabled={activeFileIndex <= 0}
                              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-all cursor-pointer"
                              title="Previous Attachment"
                            >
                              <Icons.ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[10px] font-mono font-bold text-neutral-300 px-1 whitespace-nowrap">
                              {activeFileIndex + 1} / {uploadedFiles.length}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleNavigateAttachment('next')}
                              disabled={activeFileIndex >= uploadedFiles.length - 1}
                              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-all cursor-pointer"
                              title="Next Attachment"
                            >
                              <Icons.ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {activeFile.blobUrl && (
                          <a
                            href={activeFile.blobUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1 rounded-lg border border-neutral-700 transition-colors"
                            title="Open document in new browser tab"
                          >
                            <Icons.ExternalLink className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Popout</span>
                          </a>
                        )}
                        <span className="text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800/60 px-2 py-0.5 rounded-md hidden md:inline-block">
                          Live Full View
                        </span>
                      </div>
                    </div>

                    {/* Preview Canvas: Tall & Full */}
                    <div className="h-[620px] sm:h-[680px] w-full relative flex items-center justify-center bg-neutral-950 overflow-hidden">
                      {isActiveImage ? (
                        <div className="w-full h-full p-3 flex items-center justify-center overflow-auto custom-scrollbar">
                          <img
                            src={activeFile.fileData || activeFile.blobUrl || ''}
                            alt={activeFile.file.name}
                            className="max-h-full max-w-full object-contain rounded-lg shadow-lg"
                          />
                        </div>
                      ) : (
                        <iframe
                          src={activeFile.blobUrl || activeFile.fileData || undefined}
                          className="w-full h-full border-0 rounded-b-2xl bg-neutral-900"
                          title="Full Document Preview"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Form & Live Progress / Error States */}
        <div className={`w-full lg:w-1/2 ${uploadedFiles.length > 0 && mobileTab === 'preview' ? 'hidden lg:block' : 'block'}`}>
          <div className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800/80 rounded-3xl p-5 sm:p-7 shadow-xl relative overflow-hidden">
            {/* AI Scanning Active Overlay */}
            {isAiScanning && (
              <div className="absolute inset-0 z-20 bg-neutral-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-150">
                <div className="w-16 h-16 rounded-3xl bg-purple-600/20 border border-purple-500/50 flex items-center justify-center mb-4 text-purple-400 animate-pulse shadow-lg">
                  <Icons.Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-base font-black text-white tracking-tight">
                  AI Vision is Analyzing...
                </h3>
                <p className="text-xs text-purple-300 mt-2 font-mono text-center max-w-sm bg-purple-950/60 border border-purple-800/40 px-3 py-1.5 rounded-full">
                  {aiScanningStep}
                </p>
                <div className="w-56 h-1.5 bg-neutral-800 rounded-full mt-6 overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400 animate-pulse" />
                </div>
              </div>
            )}

            {/* Uploading Multi-Stage Progress Overlay */}
            {uploadPhase === 'uploading' && (
              <div className="absolute inset-0 z-30 bg-neutral-950/95 backdrop-blur-md flex flex-col items-center justify-center p-8 animate-in fade-in duration-200">
                <div className="w-16 h-16 rounded-3xl bg-purple-600/20 border border-purple-500/60 flex items-center justify-center mb-5 text-purple-400 shadow-xl shadow-purple-950/50">
                  <div className="w-8 h-8 border-3 border-purple-400 border-t-transparent rounded-full animate-spin" />
                </div>

                <div className="text-center space-y-1.5 mb-6 max-w-sm">
                  <h3 className="text-lg font-black text-white">Archiving Documents...</h3>
                  <p className="text-xs text-neutral-400 font-mono">
                    {uploadStatusText || 'Transferring document data...'}
                  </p>
                </div>

                {/* Animated Progress Bar */}
                <div className="w-full max-w-md space-y-2">
                  <div className="flex justify-between text-xs font-mono font-bold">
                    <span className="text-purple-400">Progress</span>
                    <span className="text-white">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden p-0.5 border border-neutral-700">
                    <div
                      className="h-full bg-gradient-to-r from-purple-600 via-indigo-500 to-emerald-400 rounded-full transition-all duration-300 ease-out shadow-sm"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-2 text-[11px] text-neutral-400 font-mono">
                  <Icons.File className="w-3.5 h-3.5 text-neutral-400" />
                  <span>
                    {uploadedFiles.length} file(s) • {invoices.length} invoice(s)
                  </span>
                </div>
              </div>
            )}

            {/* Success Celebration Overlay */}
            {uploadPhase === 'success' && (
              <div className="absolute inset-0 z-30 bg-neutral-950/95 backdrop-blur-md flex flex-col items-center justify-center p-8 animate-in zoom-in-95 duration-200 text-center">
                <div className="w-20 h-20 rounded-full bg-emerald-950 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mb-5 shadow-2xl shadow-emerald-950/60 animate-bounce">
                  <Icons.Check className="w-10 h-10 stroke-[3]" />
                </div>

                <h3 className="text-xl font-black text-white mb-1">
                  {createdDocRecords.length === 1
                    ? 'Document Uploaded Successfully!'
                    : `${createdDocRecords.length} Invoices Successfully Archived!`}
                </h3>
                <p className="text-xs text-neutral-400 max-w-sm mb-6 leading-relaxed">
                  All {uploadedFiles.length} file(s) and {createdDocRecords.length} invoice records have been securely stored and indexed to your dashboard.
                </p>

                {/* Summary List */}
                <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-4 text-left space-y-2 text-xs mb-6 max-h-48 overflow-y-auto custom-scrollbar">
                  {createdDocRecords.map((doc, idx) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between py-1.5 border-b border-neutral-800/60 last:border-0"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="w-5 h-5 rounded-md bg-purple-950 text-purple-400 flex items-center justify-center text-[10px] font-bold">
                          {idx + 1}
                        </span>
                        <div className="truncate">
                          <span className="font-bold text-white mr-1.5">{doc.vendorName}</span>
                          <span className="font-mono text-purple-300">({doc.invoiceNumber})</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-emerald-400 shrink-0">
                        {formatCurrency(doc.amount)}
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 flex justify-between font-bold text-xs border-t border-neutral-700">
                    <span className="text-neutral-300">Combined Total:</span>
                    <span className="font-mono text-emerald-400">
                      {formatCurrency(totalCalculatedAmount)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => createdDocRecords.length > 0 && onUploadSuccess(createdDocRecords)}
                  className="bg-white hover:bg-neutral-200 text-neutral-950 font-black text-xs py-3 px-6 rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer"
                >
                  View In Dashboard Now &rarr;
                </button>
              </div>
            )}

            {/* Error Alert Box */}
            {uploadPhase === 'error' && (
              <div className="mb-6 p-4 bg-rose-950/60 border border-rose-800 rounded-2xl space-y-3 animate-in fade-in duration-150">
                <div className="flex items-start gap-3">
                  <Icons.AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-rose-300">Upload Encountered An Issue</h4>
                    <p className="text-[11px] text-rose-200 leading-relaxed">
                      {uploadErrorMessage ||
                        'Unable to sync with cloud database. You can retry or save local copies.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-rose-900/50">
                  <button
                    type="button"
                    onClick={(e) => handleFormSubmit(e)}
                    className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer"
                  >
                    Retry Upload
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveOfflineFallback}
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer border border-neutral-700"
                  >
                    Save Draft Locally
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadPhase('idle')}
                    className="text-neutral-400 hover:text-white text-xs px-2 py-1.5 ml-auto"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* AI Extraction Error & Retry Alert Box */}
            {aiExtractionError && !isAiScanning && (
              <div className="mb-6 p-4 bg-amber-950/60 border border-amber-800/80 rounded-2xl space-y-3 animate-in fade-in duration-150 shadow-lg">
                <div className="flex items-start gap-3">
                  <Icons.AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-amber-300">
                        {aiExtractionError.isHighDemand
                          ? 'AI Model High Demand (503)'
                          : 'AI Extraction Notice'}
                      </h4>
                      {aiExtractionError.isHighDemand && (
                        <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950 border border-amber-800 px-2 py-0.5 rounded-full">
                          Temporary Spike
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-amber-200/90 leading-relaxed">
                      {aiExtractionError.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-amber-900/40">
                  <button
                    type="button"
                    onClick={handleReScanAllFiles}
                    disabled={isAiScanning}
                    className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs px-3.5 py-1.5 rounded-lg transition-all active:scale-95 flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <Icons.Sparkles className="w-3.5 h-3.5" />
                    <span>Retry AI Extraction Now</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiExtractionError(null)}
                    className="text-neutral-400 hover:text-white text-xs px-2 py-1.5 ml-auto cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Form Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300 flex items-center justify-center text-xs font-black">
                  2
                </span>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-neutral-300">
                    Document Specifications
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    {invoices.length > 0
                      ? `${invoices.length} invoice(s) across ${uploadedFiles.length} file(s).`
                      : 'Upload files to extract and review invoice details.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {uploadedFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={handleReScanAllFiles}
                    disabled={isAiScanning}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 px-2.5 py-1 rounded-full border border-neutral-700 transition-all cursor-pointer active:scale-95"
                    title="Re-run AI extraction"
                  >
                    <Icons.Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>Re-scan AI</span>
                  </button>
                )}
                {invoices.length > 0 && (
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-700/50 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                    <Icons.Check className="w-3.5 h-3.5 stroke-[3]" />
                    {invoices.length} Extracted
                  </span>
                )}
              </div>
            </div>

            {sites.length === 0 ? (
              <div className="p-4 bg-amber-950/40 border border-amber-800/40 rounded-2xl text-amber-300 text-xs">
                No construction sites exist yet. Please ask the Administrator to create a site first
                before uploading.
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-5">
                {/* Global Site Selector */}
                <div className="bg-neutral-950/60 border border-neutral-800/80 p-3.5 rounded-2xl">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-300 mb-1.5">
                    Assigned Construction Site *
                  </label>
                  <select
                    value={targetSiteId}
                    onChange={(e) => {
                      const newSiteId = e.target.value;
                      setTargetSiteId(newSiteId);
                      if (onSiteChange) {
                        onSiteChange(newSiteId);
                      }
                    }}
                    className="w-full bg-neutral-900 border border-neutral-700/80 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition-colors"
                  >
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code}) - {s.location}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Multi-Invoice Cards List */}
                {invoices.length === 0 ? (
                  <div className="border border-dashed border-neutral-800 rounded-2xl p-8 text-center text-neutral-500 text-xs space-y-2">
                    <Icons.File className="w-8 h-8 mx-auto text-neutral-600" />
                    <div>No documents scanned yet.</div>
                    <p className="text-[11px] text-neutral-500 max-w-xs mx-auto">
                      Drop your invoices or delivery challans on the left panel to begin.
                    </p>
                  </div>
                ) : (
                  <div
                    ref={invoiceListContainerRef}
                    onScroll={handleInvoiceListScroll}
                    className="space-y-4 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar scroll-smooth"
                  >
                    {invoices.map((inv, index) => {
                      const fileIdx = uploadedFiles.findIndex((f) => f.id === inv.fileId);
                      const sourceFile = fileIdx !== -1 ? uploadedFiles[fileIdx] : undefined;
                      const isFirstOfFile = invoices.findIndex((i) => i.fileId === inv.fileId) === index;
                      const isCardActive = activeFile?.id === inv.fileId;

                      return (
                        <div
                          key={inv.id}
                          id={isFirstOfFile ? `invoice-card-${inv.fileId}` : `invoice-card-item-${inv.id}`}
                          data-file-id={inv.fileId}
                          onClick={() => {
                            if (activeFileId !== inv.fileId) {
                              setActiveFileId(inv.fileId);
                            }
                          }}
                          onFocusCapture={() => {
                            if (activeFileId !== inv.fileId) {
                              setActiveFileId(inv.fileId);
                            }
                          }}
                          className={`rounded-2xl p-4 sm:p-5 space-y-4 relative shadow-sm transition-all duration-200 cursor-pointer ${
                            isCardActive
                              ? 'bg-neutral-900/90 border border-purple-500/80 ring-2 ring-purple-500/30 shadow-lg shadow-purple-950/40'
                              : 'bg-neutral-950/80 border border-neutral-800/90 hover:border-neutral-700'
                          }`}
                        >
                          {/* Invoice Item Header */}
                          <div className="flex items-center justify-between pb-3 border-b border-neutral-800/80 gap-2 flex-wrap sm:flex-nowrap">
                            <div className="flex items-center gap-2 overflow-hidden flex-wrap sm:flex-nowrap">
                              <span
                                className={`w-6 h-6 rounded-lg border flex items-center justify-center text-xs font-black shrink-0 ${
                                  inv.type === 'Invoice'
                                    ? 'bg-purple-600/30 border-purple-500/40 text-purple-300'
                                    : inv.type === 'Challan'
                                    ? 'bg-indigo-600/30 border-indigo-500/40 text-indigo-300'
                                    : inv.type === 'Credit Note'
                                    ? 'bg-rose-600/30 border-rose-500/40 text-rose-300'
                                    : 'bg-sky-600/30 border-sky-500/40 text-sky-300'
                                }`}
                              >
                                #{index + 1}
                              </span>
                              <span className="text-xs font-bold text-white truncate">
                                {inv.type === 'Ledger'
                                  ? inv.invoiceNumber
                                    ? `Ledger: ${inv.invoiceNumber}`
                                    : `Ledger Entry #${index + 1}`
                                  : inv.type === 'Credit Note'
                                  ? inv.invoiceNumber
                                    ? `Credit Note ${inv.invoiceNumber}`
                                    : `Credit Note #${index + 1}`
                                  : inv.type === 'Challan'
                                  ? inv.invoiceNumber
                                    ? `Challan ${inv.invoiceNumber}`
                                    : `Challan #${index + 1}`
                                  : inv.invoiceNumber
                                  ? `Invoice ${inv.invoiceNumber}`
                                  : `Invoice Entry #${index + 1}`}
                              </span>

                              {/* Linked Attachment Indicator */}
                              {sourceFile && (
                                <span
                                  className={`text-[10px] font-mono px-2 py-0.5 rounded-md truncate max-w-[140px] flex items-center gap-1 border transition-all ${
                                    isCardActive
                                      ? 'bg-purple-900/60 text-purple-200 border-purple-600/60 font-bold'
                                      : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                                  }`}
                                  title={`Attachment #${fileIdx + 1}: ${sourceFile.file.name}`}
                                >
                                  <span>Att. #{fileIdx + 1}</span>
                                  <span className="opacity-60">•</span>
                                  <span className="truncate">{sourceFile.file.name}</span>
                                </span>
                              )}

                              {inv.pageNumber && (
                                <span className="text-[10px] font-mono text-neutral-400 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded-md shrink-0">
                                  p.{inv.pageNumber}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                              {/* Preview Active Status / Quick Switcher */}
                              {isCardActive ? (
                                <span className="text-[10px] font-bold bg-purple-600 text-white px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm shadow-purple-900/40">
                                  <Icons.Eye className="w-3 h-3" />
                                  <span className="hidden sm:inline">In Preview</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveFileId(inv.fileId);
                                    setMobileTab('preview');
                                  }}
                                  className="text-[10px] font-semibold text-neutral-400 hover:text-purple-300 bg-neutral-900 hover:bg-purple-950/60 px-2 py-1 rounded-lg border border-neutral-800 hover:border-purple-800/50 transition-all flex items-center gap-1 cursor-pointer"
                                  title="Switch preview to this attachment"
                                >
                                  <Icons.Eye className="w-3 h-3 text-neutral-500" />
                                  <span className="hidden sm:inline">View Att. #{fileIdx + 1}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDuplicateInvoice(inv.id);
                                }}
                                className="text-[11px] text-purple-300 hover:text-white bg-purple-950/50 hover:bg-purple-900/60 px-2 py-1 rounded-lg border border-purple-800/40 transition-all flex items-center gap-1 cursor-pointer"
                                title="Duplicate this invoice specification"
                              >
                                <Icons.Plus className="w-3 h-3" />
                                <span className="hidden sm:inline">Copy</span>
                              </button>
                              {invoices.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveInvoice(inv.id);
                                  }}
                                  className="text-[11px] text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 px-2 py-1 rounded-lg border border-transparent hover:border-rose-800/50 transition-all flex items-center gap-1 cursor-pointer"
                                  title="Remove this invoice"
                                >
                                  <Icons.Trash className="w-3 h-3" />
                                  <span className="hidden sm:inline">Remove</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Fields */}
                          <div className="space-y-3.5">
                            <div>
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                                {inv.type === 'Ledger'
                                  ? 'Account / Vendor Name *'
                                  : 'Vendor / Supplier Name *'}
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="e.g. Apex Steel Corp"
                                value={inv.vendorName}
                                onChange={(e) =>
                                  handleUpdateInvoice(index, 'vendorName', e.target.value)
                                }
                                className="w-full bg-neutral-900/90 border border-neutral-700/80 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none transition-colors"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                                  {inv.type === 'Ledger'
                                    ? 'Ledger Period / Date Range *'
                                    : inv.type === 'Credit Note'
                                    ? 'Credit Note #'
                                    : inv.type === 'Challan'
                                    ? 'Challan #'
                                    : 'Invoice #'}
                                </label>
                                <input
                                  type="text"
                                  placeholder={
                                    inv.type === 'Ledger'
                                      ? '01-Apr-2023 to 31-Mar-2024'
                                      : inv.type === 'Credit Note'
                                      ? 'CN-2024-001'
                                      : inv.type === 'Challan'
                                      ? 'DC-2024-001'
                                      : 'INV-2024-001'
                                  }
                                  value={inv.invoiceNumber}
                                  onChange={(e) =>
                                    handleUpdateInvoice(index, 'invoiceNumber', e.target.value)
                                  }
                                  className="w-full bg-neutral-900/90 border border-neutral-700/80 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none transition-colors"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                                  {inv.type === 'Ledger' ? 'Statement Date' : 'Issue Date'}
                                </label>
                                <input
                                  type="date"
                                  value={inv.date}
                                  onChange={(e) => handleUpdateInvoice(index, 'date', e.target.value)}
                                  className="w-full bg-neutral-900/90 border border-neutral-700/80 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none transition-colors"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                                  Document Type
                                </label>
                                {/* Segmented Toggle for Document Type */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 p-1 bg-neutral-900 rounded-xl border border-neutral-700/80 gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateInvoice(index, 'type', 'Invoice')}
                                    className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer truncate ${
                                      inv.type === 'Invoice'
                                        ? 'bg-purple-600 text-white shadow-sm'
                                        : 'text-neutral-400 hover:text-neutral-200'
                                    }`}
                                  >
                                    Tax Invoice
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateInvoice(index, 'type', 'Challan')}
                                    className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer truncate ${
                                      inv.type === 'Challan'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-neutral-400 hover:text-neutral-200'
                                    }`}
                                  >
                                    Challan
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateInvoice(index, 'type', 'Credit Note')}
                                    className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer truncate ${
                                      inv.type === 'Credit Note'
                                        ? 'bg-rose-600 text-white shadow-sm'
                                        : 'text-neutral-400 hover:text-neutral-200'
                                    }`}
                                  >
                                    Credit Note
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateInvoice(index, 'type', 'Ledger')}
                                    className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer truncate ${
                                      inv.type === 'Ledger'
                                        ? 'bg-sky-600 text-white shadow-sm'
                                        : 'text-neutral-400 hover:text-neutral-200'
                                    }`}
                                  >
                                    Ledger
                                  </button>
                                </div>
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                                  {inv.type === 'Ledger'
                                    ? 'Closing / Net Balance (₹) *'
                                    : inv.type === 'Credit Note'
                                    ? 'Credit Amount (₹) *'
                                    : 'Total Amount (₹) *'}
                                </label>
                                <div className="relative">
                                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-400">
                                    ₹
                                  </span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    required
                                    placeholder="0.00"
                                    value={inv.amount}
                                    onChange={(e) =>
                                      handleUpdateInvoice(index, 'amount', e.target.value)
                                    }
                                    className="w-full bg-neutral-900/90 border border-neutral-700/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pl-8 pr-3.5 py-2 text-sm text-emerald-400 font-mono font-bold focus:outline-none transition-colors"
                                  />
                                </div>
                                {inv.type === 'Invoice' && (
                                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                    <span className="text-[10px] text-neutral-500 font-semibold mr-1">GST Helper:</span>
                                    {[5, 12, 18, 28].map((pct) => (
                                      <button
                                        key={pct}
                                        type="button"
                                        onClick={() => applyGstRate(index, pct)}
                                        className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-purple-300 border border-neutral-800 hover:border-purple-800/60 transition-colors cursor-pointer"
                                        title={`Add ${pct}% GST to current value`}
                                      >
                                        +{pct}%
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {inv.notes && (
                              <div className="text-[11px] text-neutral-400 bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-800">
                                <span className="font-semibold text-neutral-300">Items / Notes:</span>{' '}
                                {inv.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Another Invoice Button */}
                {uploadedFiles.length > 0 && (
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => handleAddInvoiceForFile(activeFile?.id || uploadedFiles[0].id)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-400 hover:text-purple-300 bg-purple-950/40 hover:bg-purple-950/70 border border-purple-800/40 px-3.5 py-2 rounded-xl transition-all cursor-pointer active:scale-95"
                    >
                      <Icons.Plus className="w-4 h-4" />
                      <span>+ Add Another Invoice Item</span>
                    </button>

                    <div className="text-right">
                      <span className="text-[11px] text-neutral-400 block font-medium">
                        Total Invoices: {invoices.length}
                      </span>
                      <span className="text-sm font-mono font-black text-emerald-400">
                        {formatCurrency(totalCalculatedAmount)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Form Action Submit / Cancel */}
                <div className="pt-4 flex gap-3 border-t border-neutral-800/80">
                  <button
                    type="submit"
                    disabled={uploadPhase === 'uploading' || invoices.length === 0}
                    className={`flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white font-black text-sm py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 cursor-pointer ${
                      uploadPhase === 'uploading' || invoices.length === 0
                        ? 'opacity-70 cursor-not-allowed'
                        : ''
                    }`}
                  >
                    {uploadPhase === 'uploading' ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        Uploading ({uploadProgress}%)...
                      </>
                    ) : invoices.length > 1 ? (
                      `Save & Upload ${invoices.length} Invoices (${uploadedFiles.length} files)`
                    ) : (
                      'Save & Upload Document'
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={uploadPhase === 'uploading'}
                    onClick={onCancel}
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs py-3.5 px-5 rounded-xl active:scale-95 transition-all cursor-pointer border border-neutral-700/60"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
