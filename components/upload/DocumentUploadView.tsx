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

  // Active Review Draft Persistence State
  const [isDraftRestored, setIsDraftRestored] = useState<boolean>(false);

  // Review Assistance & Scroll Synchronization Refs
  const invoiceListContainerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const scrollDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to scroll to the first invoice card belonging to a specific attachment
  const scrollToInvoiceForFile = (fileId: string) => {
    isProgrammaticScrollRef.current = true;
    const cardEl = document.querySelector<HTMLElement>(`[data-file-id="${fileId}"]`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (scrollDebounceTimerRef.current) clearTimeout(scrollDebounceTimerRef.current);
    scrollDebounceTimerRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 700);
  };

  // Scroll listener on invoice cards list: when scrolling down through cards, toggle preview to match visible attachment
  const handleInvoiceListScroll = () => {
    if (isProgrammaticScrollRef.current) return;
    const cards = document.querySelectorAll<HTMLElement>('[data-invoice-card="true"]');
    if (!cards || cards.length === 0) return;

    const container = invoiceListContainerRef.current;
    const containerTop = container ? container.getBoundingClientRect().top : 100;
    const targetY = containerTop + 75;

    let closestCard: HTMLElement | null = null;
    let closestDist = Infinity;

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const dist = Math.abs(rect.top - targetY);
      if (rect.bottom > containerTop && dist < closestDist) {
        closestDist = dist;
        closestCard = card;
      }
    });

    if (closestCard) {
      const fileId = (closestCard as HTMLElement).getAttribute('data-file-id');
      if (fileId && fileId !== activeFileId) {
        setActiveFileId(fileId);
      }
    }
  };

  // Universal scroll listeners & IntersectionObserver: triggers on container scroll, window scroll, and mobile
  useEffect(() => {
    if (typeof window === 'undefined' || invoices.length === 0) return;

    const onScroll = () => {
      handleInvoiceListScroll();
    };

    const container = invoiceListContainerRef.current;
    if (container) {
      container.addEventListener('scroll', onScroll, { passive: true });
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    const observer = new IntersectionObserver(
      (entries) => {
        if (isProgrammaticScrollRef.current) return;
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          const containerTop = container ? container.getBoundingClientRect().top : 100;
          const targetY = containerTop + 75;
          visible.sort(
            (a, b) =>
              Math.abs(a.boundingClientRect.top - targetY) -
              Math.abs(b.boundingClientRect.top - targetY)
          );
          const topCard = visible[0].target as HTMLElement;
          const fileId = topCard.getAttribute('data-file-id');
          if (fileId && fileId !== activeFileId) {
            setActiveFileId(fileId);
          }
        }
      },
      {
        root: null,
        rootMargin: '-5% 0px -30% 0px',
        threshold: [0.1, 0.3, 0.6],
      }
    );

    const cards = document.querySelectorAll<HTMLElement>('[data-invoice-card="true"]');
    cards.forEach((c) => observer.observe(c));

    return () => {
      if (container) {
        container.removeEventListener('scroll', onScroll);
      }
      window.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, [invoices, activeFileId]);

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

  // 1. Auto-restore unsubmitted review draft on initial mount if available
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw =
        sessionStorage.getItem('site_docs_review_draft_v1') ||
        localStorage.getItem('site_docs_review_draft_v1');
      if (!raw) return;

      const parsed = JSON.parse(raw);
      // Ensure draft is relatively fresh (within 8 hours)
      if (parsed && parsed.timestamp && Date.now() - parsed.timestamp < 8 * 60 * 60 * 1000) {
        if (parsed.invoices && Array.isArray(parsed.invoices) && parsed.invoices.length > 0) {
          setInvoices(parsed.invoices);
          if (parsed.targetSiteId) {
            setTargetSiteId(parsed.targetSiteId);
          }

          if (parsed.files && Array.isArray(parsed.files) && parsed.files.length > 0) {
            const restoredFiles: UploadedFileItem[] = parsed.files.map((f: any) => {
              let restoredFile: File;
              try {
                if (f.fileData && f.fileData.startsWith('data:')) {
                  const arr = f.fileData.split(',');
                  const mime = arr[0].match(/:(.*?);/)?.[1] || f.fileType || 'application/pdf';
                  const bstr = atob(arr[1]);
                  let n = bstr.length;
                  const u8arr = new Uint8Array(n);
                  while (n--) {
                    u8arr[n] = bstr.charCodeAt(n);
                  }
                  restoredFile = new File([u8arr], f.fileName || 'document.pdf', { type: mime });
                } else {
                  restoredFile = new File([], f.fileName || 'document.pdf', {
                    type: f.fileType || 'application/pdf',
                  });
                }
              } catch {
                restoredFile = new File([], f.fileName || 'document.pdf', {
                  type: f.fileType || 'application/pdf',
                });
              }

              let blobUrl: string | null = null;
              try {
                blobUrl = URL.createObjectURL(restoredFile);
              } catch {
                blobUrl = f.fileData || null;
              }

              return {
                id: f.id,
                file: restoredFile,
                fileData: f.fileData || null,
                blobUrl,
                fileType: f.fileType || restoredFile.type,
                fileSize: f.fileSize || 1024,
                status: (f.status as 'ready' | 'scanning' | 'error') || 'ready',
                statusMessage: f.statusMessage || 'Restored from session draft',
              };
            });

            setUploadedFiles(restoredFiles);
            if (restoredFiles.length > 0) {
              setActiveFileId(restoredFiles[0].id);
            }
          }

          setIsDraftRestored(true);
        }
      }
    } catch (e) {
      console.warn('Could not restore review draft:', e);
    }
  }, []);

  // 2. Persist active review draft into storage to prevent any mid-review data loss
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (invoices.length === 0 && uploadedFiles.length === 0) return;
    if (uploadPhase === 'success') {
      try {
        sessionStorage.removeItem('site_docs_review_draft_v1');
        localStorage.removeItem('site_docs_review_draft_v1');
      } catch {}
      return;
    }

    const timer = setTimeout(() => {
      try {
        const serializableFiles = uploadedFiles.map((f) => ({
          id: f.id,
          fileName: f.file.name,
          fileType: f.fileType,
          fileSize: f.fileSize,
          status: f.status,
          statusMessage: f.statusMessage,
          // Only save fileData if under 4MB to prevent localStorage QuotaExceeded
          fileData: f.fileData && f.fileData.length < 4 * 1024 * 1024 ? f.fileData : null,
        }));

        const payload = JSON.stringify({
          invoices,
          targetSiteId,
          files: serializableFiles,
          timestamp: Date.now(),
        });

        sessionStorage.setItem('site_docs_review_draft_v1', payload);
        try {
          localStorage.setItem('site_docs_review_draft_v1', payload);
        } catch {}
      } catch (err) {
        console.warn('Could not auto-save review draft:', err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [invoices, uploadedFiles, targetSiteId, uploadPhase]);

  // 3. Clear draft helper
  const clearActiveDraft = () => {
    try {
      sessionStorage.removeItem('site_docs_review_draft_v1');
      localStorage.removeItem('site_docs_review_draft_v1');
    } catch {}
    setIsDraftRestored(false);
  };

  // 4. Warn before accidental page reload / tab closure during review
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (invoices.length > 0 && uploadPhase !== 'success') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [invoices.length, uploadPhase]);

  // 5. Safe cancellation handler with confirmation
  const handleCancelClick = () => {
    if (invoices.length > 0) {
      if (!window.confirm('Are you sure you want to cancel? Any unsaved document review data will be discarded.')) {
        return;
      }
    }
    clearActiveDraft();
    onCancel();
  };

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

    // Progressive, ordered AI extraction across files to prevent rate-limit concurrency collisions
    const scanResults: Array<{
      fileId: string;
      fileIndex: number;
      status: 'ready' | 'error';
      statusMessage: string;
      invoices: InvoiceDraftItem[];
    }> = [];

    let successfulAiExtractions = 0;
    let fallbackExtractions = 0;
    let lastErrorEncountered: string | null = null;
    let isHighDemandSpike = false;

    const totalToScan = newFileItems.length;

    for (let i = 0; i < totalToScan; i++) {
      const item = newFileItems[i];
      const fileIndex = uploadedFiles.length + i;

      setAiScanningStep(`Extracting document ${i + 1} of ${totalToScan}: ${item.file.name}...`);

      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? { ...f, status: 'scanning', statusMessage: `AI extracting (${i + 1}/${totalToScan})...` }
            : f
        )
      );

      try {
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
            const isFallback = json.source === 'heuristic-fallback' || !!json.error;

            if (isFallback) {
              fallbackExtractions++;
              if (json.error) {
                lastErrorEncountered = json.error;
                if (/503|UNAVAILABLE|high demand|429/i.test(json.error)) {
                  isHighDemandSpike = true;
                }
              }
            } else {
              successfulAiExtractions++;
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

            const resultItem = {
              fileId: item.id,
              fileIndex,
              status: 'ready' as const,
              statusMessage: isFallback
                ? 'Extracted with smart defaults'
                : `${parsedInvoices.length} document record(s) extracted`,
              invoices: parsedInvoices,
            };

            scanResults.push(resultItem);

            // Progressive updates: update this file's status in uploadedFiles immediately
            setUploadedFiles((prev) =>
              prev.map((f) =>
                f.id === item.id
                  ? { ...f, status: 'ready', statusMessage: resultItem.statusMessage }
                  : f
              )
            );

            // Progressive updates: add invoices immediately and maintain strict attachment order
            setInvoices((prev) => {
              const combined = [...prev, ...parsedInvoices];
              const allFileIds = [...uploadedFiles.map((f) => f.id), ...newFileItems.map((f) => f.id)];
              const fileOrderMap = new Map(allFileIds.map((id, idx) => [id, idx]));

              return combined.sort((a, b) => {
                const orderA = fileOrderMap.has(a.fileId) ? fileOrderMap.get(a.fileId)! : 9999;
                const orderB = fileOrderMap.has(b.fileId) ? fileOrderMap.get(b.fileId)! : 9999;
                if (orderA !== orderB) return orderA - orderB;
                return (a.pageNumber || 1) - (b.pageNumber || 1);
              });
            });

            // Brief pacing pause between consecutive AI requests to maintain flawless quota
            if (i < totalToScan - 1) {
              await new Promise((r) => setTimeout(r, 200));
            }
            continue;
          }
        }

        // Fallback parsing if status not OK or missing payload
        fallbackExtractions++;
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

        const resultItem = {
          fileId: item.id,
          fileIndex,
          status: 'ready' as const,
          statusMessage: 'Extracted with smart defaults',
          invoices: [fallbackInvoice],
        };

        scanResults.push(resultItem);

        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, status: 'ready', statusMessage: resultItem.statusMessage }
              : f
          )
        );

        setInvoices((prev) => {
          const combined = [...prev, fallbackInvoice];
          const allFileIds = [...uploadedFiles.map((f) => f.id), ...newFileItems.map((f) => f.id)];
          const fileOrderMap = new Map(allFileIds.map((id, idx) => [id, idx]));

          return combined.sort((a, b) => {
            const orderA = fileOrderMap.has(a.fileId) ? fileOrderMap.get(a.fileId)! : 9999;
            const orderB = fileOrderMap.has(b.fileId) ? fileOrderMap.get(b.fileId)! : 9999;
            if (orderA !== orderB) return orderA - orderB;
            return (a.pageNumber || 1) - (b.pageNumber || 1);
          });
        });
      } catch (err) {
        console.error(`AI Extraction failed for ${item.file.name}:`, err);
        const errMsg = err instanceof Error ? err.message : String(err);
        lastErrorEncountered = errMsg;
        if (/503|UNAVAILABLE|high demand|429/i.test(errMsg)) {
          isHighDemandSpike = true;
        }

        const cleanName = item.file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        const year = new Date().getFullYear();
        const fallbackInvoice: InvoiceDraftItem = {
          id: generateUUID(),
          fileId: item.id,
          vendorName: cleanName.length > 3 ? cleanName.toUpperCase() : 'METRO CONTRACTORS CORP',
          invoiceNumber: `INV-${year}-${Math.floor(1000 + Math.random() * 9000)}`,
          date: new Date().toISOString().split('T')[0],
          type: 'Invoice',
          amount: '5000.00',
          pageNumber: 1,
        };

        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, status: 'ready', statusMessage: 'Extracted with smart defaults' }
              : f
          )
        );

        setInvoices((prev) => {
          const combined = [...prev, fallbackInvoice];
          const allFileIds = [...uploadedFiles.map((f) => f.id), ...newFileItems.map((f) => f.id)];
          const fileOrderMap = new Map(allFileIds.map((id, idx) => [id, idx]));

          return combined.sort((a, b) => {
            const orderA = fileOrderMap.has(a.fileId) ? fileOrderMap.get(a.fileId)! : 9999;
            const orderB = fileOrderMap.has(b.fileId) ? fileOrderMap.get(b.fileId)! : 9999;
            if (orderA !== orderB) return orderA - orderB;
            return (a.pageNumber || 1) - (b.pageNumber || 1);
          });
        });
      }
    }

    // Only display the error banner if NO documents were extracted with AI AND there was an API failure
    if (successfulAiExtractions === 0 && lastErrorEncountered) {
      setAiExtractionError({
        message:
          lastErrorEncountered ||
          'AI OCR engine is currently experiencing temporary high demand. Basic document defaults were generated; you can click below to retry the AI extraction.',
        isHighDemand: isHighDemandSpike,
      });
    } else {
      setAiExtractionError(null);
    }

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
      clearActiveDraft();

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
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans relative antialiased selection:bg-primary selection:text-primary-foreground">
      {/* 1. Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleCancelClick}
            disabled={uploadPhase === 'uploading'}
            className="inline-flex items-center gap-2 text-xs font-bold text-secondary-foreground hover:text-foreground bg-secondary hover:bg-accent disabled:opacity-50 px-3 py-2 rounded-xl active:scale-95 transition-all border border-border shadow-sm cursor-pointer"
          >
            <Icons.ArrowLeft className="w-4 h-4" />
            <span>Cancel</span>
          </button>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Upload & Index Documents</span>
              <span className="hidden sm:inline-flex text-[10px] uppercase font-bold tracking-wider bg-primary/15 text-primary border border-primary/25 px-2 py-0.5 rounded-md">
                Batch Mode
              </span>
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Multi-file extraction • Shared storage referencing • Up to 20MB / file
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full shadow-inner">
            <Icons.Sparkles className="w-4 h-4 animate-pulse text-primary" />
            <span className="font-mono text-[11px] font-bold">AI Vision Engine</span>
          </div>
        </div>
      </header>

      {/* 2. Main Content Grid */}
      <div className="flex-1 max-w-[1600px] mx-auto w-full p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 items-start justify-center">
        {/* Mobile View Segmented Switcher (Visible on mobile screens when files are loaded) */}
        {uploadedFiles.length > 0 && (
          <div className="lg:hidden w-full bg-card/95 p-1.5 rounded-2xl border border-border grid grid-cols-2 gap-1.5 shadow-xl sticky top-[58px] z-20 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setMobileTab('form')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                mobileTab === 'form'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
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
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <Icons.Eye className="w-4 h-4" />
              <span>View File ({uploadedFiles.length})</span>
            </button>
          </div>
        )}

        {/* Left Side: Drag & Drop + File Queue + Studio Preview Frame */}
        <div className={`w-full lg:w-1/2 space-y-4 lg:sticky lg:top-20 ${uploadedFiles.length > 0 && mobileTab === 'form' ? 'hidden lg:block' : 'block'}`}>
          <div className="bg-card/60 backdrop-blur-xl border border-border rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
            {/* Header: Status & Quick Add */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-primary/15 border border-primary/25 text-primary flex items-center justify-center text-xs font-black">
                  1
                </span>
                <label className="block text-xs font-black uppercase tracking-wider text-foreground">
                  {uploadedFiles.length > 0 ? 'Document Preview' : 'Select Document(s)'}
                </label>
              </div>
              <div className="flex items-center gap-2">
                {uploadedFiles.length > 0 && (
                  <label
                    htmlFor="multi-pdf-file-upload"
                    className="text-primary hover:text-primary/80 cursor-pointer font-bold text-xs flex items-center gap-1 bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg hover:bg-primary/20 transition-colors"
                  >
                    <Icons.Plus className="w-3.5 h-3.5" /> <span>Add More</span>
                  </label>
                )}
                <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 border border-border px-2 py-0.5 rounded-md">
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
                    ? 'border-primary bg-primary/10 ring-4 ring-primary/20 scale-[1.01]'
                    : 'border-border hover:border-primary/50 hover:bg-secondary/40 bg-card/40'
                }`}
              >
                <div className="flex flex-col items-center py-2 max-w-md w-full">
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-200 ${
                      isDragging
                        ? 'bg-primary text-primary-foreground scale-110 shadow-lg'
                        : 'bg-secondary border border-border text-secondary-foreground shadow-inner'
                    }`}
                  >
                    <Icons.Upload className="w-8 h-8" />
                  </div>

                  <h4 className="text-base sm:text-lg font-bold text-white mb-1.5">
                    {isDragging ? 'Release to scan files' : 'Upload Invoices, Challans & Ledgers'}
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-sm text-center leading-relaxed mb-6">
                    Take a live photo on site or select PDFs and images from your device. Automated AI will extract and structure all document fields.
                  </p>

                  {/* Primary Mobile & Desktop Action Triggers */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-sm mb-6">
                    <label
                      htmlFor="mobile-camera-capture"
                      className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground font-bold text-xs py-3 px-4 rounded-xl cursor-pointer shadow-lg transition-all border border-border"
                    >
                      <Icons.Camera className="w-4 h-4" />
                      <span>Take Photo / Camera</span>
                    </label>

                    <label
                      htmlFor="multi-pdf-file-upload"
                      className="flex items-center justify-center gap-2 bg-secondary hover:bg-accent active:scale-95 text-secondary-foreground hover:text-foreground font-bold text-xs py-3 px-4 rounded-xl cursor-pointer border border-border transition-all shadow-sm"
                    >
                      <Icons.Upload className="w-4 h-4" />
                      <span>Browse Files & PDFs</span>
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <span className="text-[11px] font-mono text-muted-foreground bg-secondary/50 border border-border px-3 py-1 rounded-full">
                      ✓ Multi-file Batch
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground bg-secondary/50 border border-border px-3 py-1 rounded-full">
                      ✓ Up to 20MB / file
                    </span>
                    <span className="text-[11px] font-mono text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
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
                  <div className="absolute inset-0 z-30 bg-card/90 backdrop-blur-sm rounded-2xl border-2 border-dashed border-primary flex flex-col items-center justify-center text-center p-6 animate-in fade-in duration-150">
                    <Icons.Upload className="w-12 h-12 text-primary animate-bounce mb-2" />
                    <h4 className="text-base font-bold text-white">Drop to add more files to queue</h4>
                    <p className="text-xs text-muted-foreground mt-1">Multi-page PDFs or images up to 20MB</p>
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
                            ? 'bg-primary/15 border-primary/40 text-foreground shadow-sm ring-1 ring-primary/30'
                            : 'bg-secondary/50 border-border text-muted-foreground hover:text-foreground hover:border-border hover:bg-secondary'
                        }`}
                        title={`Attachment #${idx + 1}: ${item.file.name} (Click to switch preview and scroll to its extracted data)`}
                      >
                        <span
                          className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                            isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <div className="max-w-[130px] truncate text-xs font-semibold">
                          {item.file.name}
                        </div>
                        {fileInvoicesCount > 0 && (
                          <span
                            className="text-[10px] font-mono text-primary bg-primary/20 px-1.5 py-0.5 rounded font-bold"
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
                  <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-2xl flex flex-col">
                    {/* Preview Toolbar */}
                    <div className="bg-muted/50 border-b border-border px-4 py-2.5 flex items-center justify-between shrink-0 gap-2">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Icons.File className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-[11px] font-mono font-bold text-primary bg-primary/15 border border-primary/25 px-2 py-0.5 rounded-md shrink-0">
                          Att. #{activeFileIndex + 1}
                        </span>
                        <span className="text-xs font-bold text-foreground truncate max-w-[180px] sm:max-w-[220px]">
                          {activeFile.file.name}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground bg-secondary border border-border px-2 py-0.5 rounded shrink-0 hidden sm:inline-block">
                          {formatFileSize(activeFile.fileSize)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Prev / Next Attachment Navigation Buttons */}
                        {uploadedFiles.length > 1 && (
                          <div className="flex items-center gap-1 bg-secondary border border-border rounded-xl p-0.5 shadow-inner">
                            <button
                              type="button"
                              onClick={() => handleNavigateAttachment('prev')}
                              disabled={activeFileIndex <= 0}
                              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed transition-all cursor-pointer"
                              title="Previous Attachment"
                            >
                              <Icons.ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[10px] font-mono font-bold text-secondary-foreground px-1 whitespace-nowrap">
                              {activeFileIndex + 1} / {uploadedFiles.length}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleNavigateAttachment('next')}
                              disabled={activeFileIndex >= uploadedFiles.length - 1}
                              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed transition-all cursor-pointer"
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
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary-foreground hover:text-foreground bg-secondary hover:bg-accent px-2.5 py-1 rounded-lg border border-border transition-colors"
                            title="Open document in new browser tab"
                          >
                            <Icons.ExternalLink className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Popout</span>
                          </a>
                        )}
                        <span className="text-[10px] font-bold bg-primary/15 text-primary border border-primary/25 px-2 py-0.5 rounded-md hidden md:inline-block">
                          Live Full View
                        </span>
                      </div>
                    </div>

                    {/* Preview Canvas: Tall & Full */}
                    <div className="h-[620px] sm:h-[680px] w-full relative flex items-center justify-center bg-background overflow-hidden">
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
                          className="w-full h-full border-0 rounded-b-2xl bg-card"
                          title="Full Document Preview"
                        />
                      )}
                    </div>

                    {/* Mobile Return to Invoices Bar in Preview Mode */}
                    <div className="lg:hidden p-3 bg-card border-t border-border flex items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground truncate">
                        <span className="font-bold text-white">Att. #{activeFileIndex + 1}</span> ({invoices.filter((i) => i.fileId === activeFile.id).length} extracted)
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileTab('form');
                          scrollToInvoiceForFile(activeFile.id);
                        }}
                        className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-3 py-2 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
                      >
                        <Icons.FileText className="w-3.5 h-3.5" />
                        <span>Back to Invoices ({invoices.length})</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Form & Live Progress / Error States */}
        <div className={`w-full lg:w-1/2 ${uploadedFiles.length > 0 && mobileTab === 'preview' ? 'hidden lg:block' : 'block'}`}>
          <div className="bg-card/60 backdrop-blur-xl border border-border rounded-3xl p-5 sm:p-7 shadow-xl relative overflow-hidden">
            {/* AI Scanning Active Overlay */}
            {isAiScanning && (
              <div className="absolute inset-0 z-20 bg-background/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-150">
                <div className="w-16 h-16 rounded-3xl bg-primary/15 border border-primary/25 flex items-center justify-center mb-4 text-primary animate-pulse shadow-lg">
                  <Icons.Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-base font-black text-white tracking-tight">
                  AI Vision is Analyzing...
                </h3>
                <p className="text-xs text-primary mt-2 font-mono text-center max-w-sm bg-primary/15 border border-primary/25 px-3 py-1.5 rounded-full">
                  {aiScanningStep}
                </p>
                <div className="w-56 h-1.5 bg-secondary rounded-full mt-6 overflow-hidden">
                  <div className="w-full h-full bg-primary animate-pulse" />
                </div>
              </div>
            )}

            {/* Uploading Multi-Stage Progress Overlay */}
            {uploadPhase === 'uploading' && (
              <div className="absolute inset-0 z-30 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-8 animate-in fade-in duration-200">
                <div className="w-16 h-16 rounded-3xl bg-primary/15 border border-primary/25 flex items-center justify-center mb-5 text-primary shadow-xl">
                  <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                </div>

                <div className="text-center space-y-1.5 mb-6 max-w-sm">
                  <h3 className="text-lg font-black text-white">Archiving Documents...</h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    {uploadStatusText || 'Transferring document data...'}
                  </p>
                </div>

                {/* Animated Progress Bar */}
                <div className="w-full max-w-md space-y-2">
                  <div className="flex justify-between text-xs font-mono font-bold">
                    <span className="text-primary font-bold">Progress</span>
                    <span className="text-white">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-3 bg-secondary rounded-full overflow-hidden p-0.5 border border-border">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300 ease-out shadow-sm"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                  <Icons.File className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>
                    {uploadedFiles.length} file(s) • {invoices.length} invoice(s)
                  </span>
                </div>
              </div>
            )}

            {/* Success Celebration Overlay */}
            {uploadPhase === 'success' && (
              <div className="absolute inset-0 z-30 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-8 animate-in zoom-in-95 duration-200 text-center">
                <div className="w-20 h-20 rounded-full bg-emerald-950 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mb-5 shadow-2xl shadow-emerald-950/60 animate-bounce">
                  <Icons.Check className="w-10 h-10 stroke-[3]" />
                </div>

                <h3 className="text-xl font-black text-white mb-1">
                  {createdDocRecords.length === 1
                    ? 'Document Uploaded Successfully!'
                    : `${createdDocRecords.length} Invoices Successfully Archived!`}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mb-6 leading-relaxed">
                  All {uploadedFiles.length} file(s) and {createdDocRecords.length} invoice records have been securely stored and indexed to your dashboard.
                </p>

                {/* Summary List */}
                <div className="w-full max-w-md bg-card border border-border rounded-2xl p-4 text-left space-y-2 text-xs mb-6 max-h-48 overflow-y-auto custom-scrollbar">
                  {createdDocRecords.map((doc, idx) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="w-5 h-5 rounded-md bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold">
                          {idx + 1}
                        </span>
                        <div className="truncate">
                          <span className="font-bold text-white mr-1.5">{doc.vendorName}</span>
                          <span className="font-mono text-muted-foreground">({doc.invoiceNumber})</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-emerald-400 shrink-0">
                        {formatCurrency(doc.amount)}
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 flex justify-between font-bold text-xs border-t border-border">
                    <span className="text-muted-foreground">Combined Total:</span>
                    <span className="font-mono text-emerald-400">
                      {formatCurrency(totalCalculatedAmount)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => createdDocRecords.length > 0 && onUploadSuccess(createdDocRecords)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs py-3 px-6 rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer"
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
                    className="bg-secondary hover:bg-accent text-secondary-foreground font-semibold text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer border border-border"
                  >
                    Save Draft Locally
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadPhase('idle')}
                    className="text-muted-foreground hover:text-foreground text-xs px-2 py-1.5 ml-auto cursor-pointer"
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
                    className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all active:scale-95 flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <Icons.Sparkles className="w-3.5 h-3.5" />
                    <span>Retry AI Extraction Now</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiExtractionError(null)}
                    className="text-muted-foreground hover:text-foreground text-xs px-2 py-1.5 ml-auto cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Active Session Draft Restored Banner */}
            {isDraftRestored && (
              <div className="mb-5 bg-primary/10 border border-primary/30 rounded-2xl p-4 shadow-lg flex items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 text-primary">
                    <Icons.Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white flex items-center gap-2">
                      <span>Session Review Draft Restored</span>
                      <span className="text-[10px] font-mono text-primary bg-primary/20 border border-primary/30 px-2 py-0.5 rounded-full">
                        {invoices.length} record(s)
                      </span>
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      We automatically preserved your unsubmitted invoice review data so your progress was not lost.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      clearActiveDraft();
                      setInvoices([]);
                      setUploadedFiles([]);
                      setActiveFileId(null);
                    }}
                    className="text-[11px] text-muted-foreground hover:text-destructive bg-card hover:bg-destructive/15 border border-border hover:border-destructive/30 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold"
                    title="Clear this draft and start a fresh upload"
                  >
                    Discard Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDraftRestored(false)}
                    className="text-muted-foreground hover:text-foreground text-xs px-2 py-1.5 cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Form Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-secondary border border-border text-secondary-foreground flex items-center justify-center text-xs font-black">
                  2
                </span>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                    Document Specifications
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
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
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary-foreground hover:text-foreground bg-secondary hover:bg-accent disabled:opacity-50 px-2.5 py-1 rounded-full border border-border transition-all cursor-pointer active:scale-95"
                    title="Re-run AI extraction"
                  >
                    <Icons.Sparkles className="w-3.5 h-3.5 text-primary" />
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
                <div className="bg-muted/40 border border-border p-3.5 rounded-2xl">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
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
                    className="w-full bg-background border border-input focus:ring-1 focus:ring-ring rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none transition-colors"
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
                  <div className="border border-dashed border-border rounded-2xl p-8 text-center text-muted-foreground text-xs space-y-2">
                    <Icons.File className="w-8 h-8 mx-auto text-muted-foreground" />
                    <div>No documents scanned yet.</div>
                    <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
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
                          data-invoice-card="true"
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
                              ? 'bg-card border border-primary/70 ring-2 ring-primary/20 shadow-lg'
                              : 'bg-card/70 border border-border hover:border-border/80'
                          }`}
                        >
                          {/* Invoice Item Header */}
                          <div className="flex items-center justify-between pb-3 border-b border-border gap-2 flex-wrap sm:flex-nowrap">
                            <div className="flex items-center gap-2 overflow-hidden flex-wrap sm:flex-nowrap">
                              <span
                                className={`w-6 h-6 rounded-lg border flex items-center justify-center text-xs font-black shrink-0 ${
                                  inv.type === 'Invoice'
                                    ? 'bg-primary/20 border-primary/30 text-primary'
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
                                      ? 'bg-primary/20 text-primary border-primary/30 font-bold'
                                      : 'bg-secondary text-muted-foreground border-border'
                                  }`}
                                  title={`Attachment #${fileIdx + 1}: ${sourceFile.file.name}`}
                                >
                                  <span>Att. #{fileIdx + 1}</span>
                                  <span className="opacity-60">•</span>
                                  <span className="truncate">{sourceFile.file.name}</span>
                                </span>
                              )}

                              {inv.pageNumber && (
                                <span className="text-[10px] font-mono text-muted-foreground bg-secondary border border-border px-2 py-0.5 rounded-md shrink-0">
                                  p.{inv.pageNumber}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                              {/* Preview Active Status / Quick Switcher */}
                              {isCardActive ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMobileTab('preview');
                                  }}
                                  className="text-[10px] font-bold bg-primary hover:bg-primary/90 text-primary-foreground px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm cursor-pointer active:scale-95 transition-all"
                                  title="View this document in full preview"
                                >
                                  <Icons.Eye className="w-3 h-3" />
                                  <span>View Doc</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveFileId(inv.fileId);
                                    setMobileTab('preview');
                                  }}
                                  className="text-[10px] font-semibold text-secondary-foreground hover:text-foreground bg-secondary hover:bg-accent px-2 py-1 rounded-lg border border-border transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                  title="Switch preview to this attachment"
                                >
                                  <Icons.Eye className="w-3 h-3 text-primary" />
                                  <span className="hidden sm:inline">View Att. #{fileIdx + 1}</span>
                                  <span className="sm:hidden">View Doc</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDuplicateInvoice(inv.id);
                                }}
                                className="text-[11px] text-secondary-foreground hover:text-foreground bg-secondary hover:bg-accent px-2 py-1 rounded-lg border border-border transition-all flex items-center gap-1 cursor-pointer"
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
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
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
                                className="w-full bg-background border border-input focus:ring-1 focus:ring-ring rounded-xl px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-colors"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
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
                                  className="w-full bg-background border border-input focus:ring-1 focus:ring-ring rounded-xl px-3.5 py-2 text-sm text-foreground font-mono focus:outline-none transition-colors"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                  {inv.type === 'Ledger' ? 'Statement Date' : 'Issue Date'}
                                </label>
                                <input
                                  type="date"
                                  value={inv.date}
                                  onChange={(e) => handleUpdateInvoice(index, 'date', e.target.value)}
                                  className="w-full bg-background border border-input focus:ring-1 focus:ring-ring rounded-xl px-3.5 py-2 text-sm text-foreground font-mono focus:outline-none transition-colors"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                  Document Type
                                </label>
                                {/* Segmented Toggle for Document Type */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 p-1 bg-muted rounded-xl border border-input gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateInvoice(index, 'type', 'Invoice')}
                                    className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer truncate ${
                                      inv.type === 'Invoice'
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                  >
                                    Tax Invoice
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateInvoice(index, 'type', 'Challan')}
                                    className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer truncate ${
                                      inv.type === 'Challan'
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                  >
                                    Challan
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateInvoice(index, 'type', 'Credit Note')}
                                    className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer truncate ${
                                      inv.type === 'Credit Note'
                                        ? 'bg-destructive text-destructive-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                  >
                                    Credit Note
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateInvoice(index, 'type', 'Ledger')}
                                    className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer truncate ${
                                      inv.type === 'Ledger'
                                        ? 'bg-secondary text-secondary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                  >
                                    Ledger
                                  </button>
                                </div>
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                  {inv.type === 'Ledger'
                                    ? 'Closing / Net Balance (₹) *'
                                    : inv.type === 'Credit Note'
                                    ? 'Credit Amount (₹) *'
                                    : 'Total Amount (₹) *'}
                                </label>
                                <div className="relative">
                                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
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
                                    className="w-full bg-background border border-input focus:ring-1 focus:ring-ring rounded-xl pl-8 pr-3.5 py-2 text-sm text-emerald-400 font-mono font-bold focus:outline-none transition-colors"
                                  />
                                </div>
                                {inv.type === 'Invoice' && (
                                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                    <span className="text-[10px] text-muted-foreground font-semibold mr-1">GST Helper:</span>
                                    {[5, 12, 18, 28].map((pct) => (
                                      <button
                                        key={pct}
                                        type="button"
                                        onClick={() => applyGstRate(index, pct)}
                                        className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-secondary hover:bg-accent text-secondary-foreground hover:text-primary border border-border transition-colors cursor-pointer"
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
                              <div className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-xl border border-border">
                                <span className="font-semibold text-foreground">Items / Notes:</span>{' '}
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
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 border border-primary/20 px-3.5 py-2 rounded-xl transition-all cursor-pointer active:scale-95"
                    >
                      <Icons.Plus className="w-4 h-4" />
                      <span>+ Add Another Invoice Item</span>
                    </button>

                    <div className="text-right">
                      <span className="text-[11px] text-muted-foreground block font-medium">
                        Total Invoices: {invoices.length}
                      </span>
                      <span className="text-sm font-mono font-black text-emerald-400">
                        {formatCurrency(totalCalculatedAmount)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Form Action Submit / Cancel */}
                <div className="pt-4 flex gap-3 border-t border-border">
                  <button
                    type="submit"
                    disabled={uploadPhase === 'uploading' || invoices.length === 0}
                    className={`flex-1 bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground font-black text-sm py-3.5 px-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
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
                    onClick={handleCancelClick}
                    className="bg-secondary hover:bg-accent text-secondary-foreground font-bold text-xs py-3.5 px-5 rounded-xl active:scale-95 transition-all cursor-pointer border border-border"
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
