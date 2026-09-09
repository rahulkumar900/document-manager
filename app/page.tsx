'use client';

import React, { useState, useMemo, useEffect, Suspense, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  UserAccount,
  SiteRecord,
  DocumentRecord,
  ViewMode,
  DisplayLayout,
  FilterRule,
  getStoredUsers,
  getStoredSites,
  getStoredDocuments,
  getStoredSession,
  saveSession,
  saveDocuments,
  syncSitesWithSupabase,
  syncDocumentsWithSupabase,
  syncUsersWithSupabase,
  initializeAuthSession,
  signOutWithSupabase,
  fetchUserProfile,
  supabase,
  updateDocumentVerificationInSupabase,
  updateDocumentInSupabase,
  deleteDocumentFromSupabase,
} from '@/lib/store';
import { exportDocumentsToZip } from '@/lib/exportZip';
import { findDatabaseDuplicate } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { applyFilterRules } from '@/lib/filterUtils';

// Core UI Components
import { Navbar } from '@/components/layout/Navbar';
import { AuthView } from '@/components/auth/AuthView';
import { DashboardAnalyticsView } from '@/components/dashboard/DashboardAnalyticsView';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { DocumentGrid } from '@/components/dashboard/DocumentGrid';
import { DocumentTable } from '@/components/dashboard/DocumentTable';
import { Pagination } from '@/components/dashboard/Pagination';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { BulkActionBar } from '@/components/dashboard/BulkActionBar';
import { LoadingFallback } from '@/components/ui/LoadingFallback';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Icons } from '@/components/ui/icons';

// Dynamically Imported Heavy Modals & Views (Code Splitting Optimization)
const DocumentPreviewView = dynamic(
  () => import('@/components/preview/DocumentPreviewView').then((mod) => mod.DocumentPreviewView),
  { loading: () => <LoadingFallback label="Loading document preview..." /> }
);

const DocumentUploadView = dynamic(
  () => import('@/components/upload/DocumentUploadView').then((mod) => mod.DocumentUploadView),
  { loading: () => <LoadingFallback label="Loading document upload center..." /> }
);

const ExportProgressModal = dynamic(
  () => import('@/components/dashboard/ExportProgressModal').then((mod) => mod.ExportProgressModal),
  { ssr: false }
);

const AdminHubModal = dynamic(
  () => import('@/components/admin/AdminHubModal').then((mod) => mod.AdminHubModal),
  { ssr: false }
);

const AdvancedFilterModal = dynamic(
  () => import('@/components/dashboard/AdvancedFilterModal').then((mod) => mod.AdvancedFilterModal),
  { ssr: false }
);

const UserProfileModal = dynamic(
  () => import('@/components/profile/UserProfileModal').then((mod) => mod.UserProfileModal),
  { ssr: false }
);

function DocumentPortalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // --------------------------------------------------------------------------
  // URL SEARCH PARAMS HELPER
  // --------------------------------------------------------------------------
  const updateUrlParams = (updates: Record<string, string | null>) => {
    startTransition(() => {
      const currentQuery = typeof window !== 'undefined' ? window.location.search : searchParams.toString();
      const params = new URLSearchParams(currentQuery);
      Object.entries(updates).forEach(([key, val]) => {
        if (
          val === null ||
          val === undefined ||
          val === '' ||
          (key === 'site' && val === 'all') ||
          (key === 'page' && val === '1') ||
          (key === 'layout' && val === 'grid') ||
          (key === 'view' && val === 'dashboard')
        ) {
          params.delete(key);
        } else {
          params.set(key, val);
        }
      });
      const query = params.toString();
      const newUrl = query ? `?${query}` : '/';
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', newUrl);
      }
      router.replace(newUrl, { scroll: false });
    });
  };

  // --------------------------------------------------------------------------
  // CORE STATE
  // --------------------------------------------------------------------------
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [currentView, setCurrentView] = useState<ViewMode>('auth');
  const [isHydrated, setIsHydrated] = useState(false);

  // Entities
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [sites, setSites] = useState<SiteRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);

  // Dashboard Filters & Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [displayLayout, setDisplayLayout] = useState<DisplayLayout>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>('all');

  // Multi-Selection State
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

  // Advanced Multi-Option Filter Rules State
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Export Progress State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{
    current: number;
    total: number;
    message: string;
  } | null>(null);

  // Active Selected Document for Preview & Editable Sidebar
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [isEditingSidebar, setIsEditingSidebar] = useState(false);

  // Admin Management Modal State
  const [isAdminHubOpen, setIsAdminHubOpen] = useState(false);

  // User Profile & Settings Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // --------------------------------------------------------------------------
  // 1. HYDRATION & SUPABASE AUTH INITIALIZATION (Runs once on mount)
  // --------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      const loadedSites = getStoredSites();
      const loadedDocs = getStoredDocuments();
      setSites(loadedSites);
      setDocuments(loadedDocs);

      // Hydrate session from Supabase Auth & profiles
      const authUser = await initializeAuthSession();
      if (!isMounted) return;

      if (authUser) {
        setCurrentUser(authUser);
      } else {
        setCurrentUser(null);
        setCurrentView('auth');
      }

      setIsHydrated(true);

      // Background Supabase Data Sync
      const [cloudSites, cloudDocs, cloudUsers] = await Promise.all([
        syncSitesWithSupabase(),
        syncDocumentsWithSupabase(),
        syncUsersWithSupabase(),
      ]);
      if (isMounted) {
        if (cloudSites.length > 0) setSites(cloudSites);
        if (cloudDocs.length > 0) setDocuments(cloudDocs);
        if (cloudUsers.length > 0) setUsers(cloudUsers);
      }
    };

    initialize();

    // Supabase Auth real-time listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id, session.user.email);
          if (profile && isMounted) {
            setCurrentUser((prev) => {
              if (
                prev &&
                prev.id === profile.id &&
                prev.role === profile.role &&
                prev.assignedSiteId === profile.assignedSiteId &&
                prev.name === profile.name &&
                prev.email === profile.email
              ) {
                return prev; // Maintain stable reference to prevent unneeded re-renders
              }
              return profile;
            });
            saveSession(profile);
            // Only transition to dashboard if user was strictly on the auth/login view
            setCurrentView((prev) => (prev === 'auth' ? 'dashboard' : prev));
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        saveSession(null);
        setCurrentView('auth');
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // --------------------------------------------------------------------------
  // 2. URL SEARCH PARAMS REACTIVE SYNCHRONIZATION
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!isHydrated) return;

    if (currentUser) {
      // Sync View: only switch if explicitly declared in searchParams, otherwise preserve current view
      const viewParam = searchParams.get('view') as ViewMode | null;
      if (viewParam && ['auth', 'dashboard', 'documents', 'upload', 'preview'].includes(viewParam)) {
        setCurrentView((prev) => (prev !== viewParam ? viewParam : prev));
      } else {
        // Only default to dashboard if currently on auth view
        setCurrentView((prev) => (prev === 'auth' ? 'dashboard' : prev));
      }

      // Sync Search Query
      const qParam = searchParams.get('q');
      setSearchQuery(qParam || '');

      // Sync Layout
      const layoutParam = searchParams.get('layout') as DisplayLayout | null;
      if (layoutParam === 'list' || layoutParam === 'grid') {
        setDisplayLayout(layoutParam);
      }

      // Sync Page
      const pageParam = searchParams.get('page');
      if (pageParam && !isNaN(Number(pageParam))) {
        setCurrentPage(Math.max(1, parseInt(pageParam, 10)));
      } else {
        setCurrentPage(1);
      }

      // Sync Document ID & Sidebar
      const docParam = searchParams.get('docId');
      setActiveDocumentId(docParam || null);

      const editParam = searchParams.get('edit');
      setIsEditingSidebar(editParam === 'true');

      // Sync Site Filter
      const siteParam = searchParams.get('site');
      if (siteParam) {
        if (currentUser.assignedSiteId === 'all' || currentUser.assignedSiteId === siteParam) {
          setSelectedSiteFilter(siteParam);
        }
      } else if (currentUser.assignedSiteId !== 'all') {
        setSelectedSiteFilter(currentUser.assignedSiteId);
      } else {
        setSelectedSiteFilter('all');
      }
    }
  }, [searchParams, isHydrated, currentUser]);

  // --------------------------------------------------------------------------
  // MEMOIZED DERIVATIONS
  // --------------------------------------------------------------------------
  const siteMap = useMemo(() => {
    const map = new Map<string, SiteRecord>();
    sites.forEach((s) => map.set(s.id, s));
    return map;
  }, [sites]);

  const activeDocument = useMemo(() => {
    return documents.find((doc) => doc.id === activeDocumentId) || null;
  }, [documents, activeDocumentId]);

  const filteredDocuments = useMemo(() => {
    let list = documents;

    // 1. Scoped Site Accountant
    if (currentUser?.role === 'Site Accountant' && currentUser.assignedSiteId !== 'all') {
      list = list.filter((doc) => doc.siteId === currentUser.assignedSiteId);
    }

    // 2. Dropdown site filter (supports both site ID and code)
    if (selectedSiteFilter !== 'all') {
      const matchingSite = sites.find(
        (s) => s.id === selectedSiteFilter || s.code.toLowerCase() === selectedSiteFilter.toLowerCase()
      );
      const targetId = matchingSite ? matchingSite.id : selectedSiteFilter;
      list = list.filter((doc) => doc.siteId === targetId);
    }

    // 3. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((doc) =>
        doc.vendorName.toLowerCase().includes(q) ||
        doc.invoiceNumber.toLowerCase().includes(q) ||
        doc.type.toLowerCase().includes(q) ||
        doc.amount.toString().includes(q)
      );
    }

    // 4. Multi-Option Filter Rules (Key, Operator, Value)
    if (filterRules.length > 0) {
      list = applyFilterRules(list, filterRules);
    }

    return list;
  }, [documents, currentUser, selectedSiteFilter, searchQuery, filterRules, sites]);

  const totalPages = Math.ceil(filteredDocuments.length / pageSize) || 1;

  const paginatedDocuments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDocuments.slice(start, start + pageSize);
  }, [filteredDocuments, currentPage, pageSize]);

  const isAllPageSelected = useMemo(() => {
    if (paginatedDocuments.length === 0) return false;
    return paginatedDocuments.every((d) => selectedDocIds.has(d.id));
  }, [paginatedDocuments, selectedDocIds]);

  // --------------------------------------------------------------------------
  // MULTI-SELECT HANDLERS
  // --------------------------------------------------------------------------
  const handleToggleSelectDoc = (docId: string) => {
    const next = new Set(selectedDocIds);
    if (next.has(docId)) {
      next.delete(docId);
    } else {
      next.add(docId);
    }
    setSelectedDocIds(next);
  };

  const handleSelectAllPage = () => {
    const next = new Set(selectedDocIds);
    paginatedDocuments.forEach((d) => next.add(d.id));
    setSelectedDocIds(next);
  };

  const handleSelectAllFiltered = () => {
    const next = new Set(selectedDocIds);
    filteredDocuments.forEach((d) => next.add(d.id));
    setSelectedDocIds(next);
  };

  const handleDeselectAll = () => {
    setSelectedDocIds(new Set());
  };

  // --------------------------------------------------------------------------
  // EXPORT ZIP HANDLERS
  // --------------------------------------------------------------------------
  const handleExportZip = async (docsToExport: DocumentRecord[]) => {
    if (docsToExport.length === 0) return;
    setIsExporting(true);
    setExportProgress({ current: 0, total: docsToExport.length, message: 'Starting export process...' });

    try {
      await exportDocumentsToZip(docsToExport, siteMap, (current, total, message) => {
        setExportProgress({ current, total, message });
      });
    } catch (err) {
      console.error('Export ZIP error:', err);
      alert('Failed to generate ZIP archive. Check console for details.');
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const handleExportSelected = () => {
    const docs = documents.filter((d) => selectedDocIds.has(d.id));
    handleExportZip(docs);
  };

  const handleExportAllFiltered = () => {
    handleExportZip(filteredDocuments);
  };

  // --------------------------------------------------------------------------
  // BATCH ACTIONS
  // --------------------------------------------------------------------------
  const handleBatchVerify = async () => {
    if (!currentUser) return;
    const verifiedAt = new Date().toISOString();
    const updated = documents.map((doc) => {
      if (selectedDocIds.has(doc.id) && doc.status === 'uploaded') {
        return {
          ...doc,
          status: 'verified' as const,
          verifiedBy: currentUser.name,
          verifiedAt,
        };
      }
      return doc;
    });

    setDocuments(updated);
    saveDocuments(updated);

    // Sync to Supabase in parallel
    await Promise.all(
      Array.from(selectedDocIds).map((id) =>
        updateDocumentVerificationInSupabase(id, currentUser.name, verifiedAt)
      )
    );
    setSelectedDocIds(new Set());
  };

  const handleBatchDelete = async () => {
    const count = selectedDocIds.size;
    if (!confirm(`Are you sure you want to delete all ${count} selected document(s)?`)) {
      return;
    }

    const docsToDelete = documents.filter((d) => selectedDocIds.has(d.id));
    const updated = documents.filter((d) => !selectedDocIds.has(d.id));
    setDocuments(updated);
    saveDocuments(updated);
    setSelectedDocIds(new Set());

    // Sync to Supabase in parallel
    await Promise.all(
      docsToDelete.map((d) => deleteDocumentFromSupabase(d.id, d.filePath))
    );
  };

  // --------------------------------------------------------------------------
  // ACTIONS
  // --------------------------------------------------------------------------
  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    saveSession(user);
    setCurrentView('dashboard');
    setCurrentPage(1);
    setSelectedSiteFilter(user.assignedSiteId !== 'all' ? user.assignedSiteId : 'all');
    updateUrlParams({ view: 'dashboard', site: user.assignedSiteId !== 'all' ? user.assignedSiteId : null });
  };

  const handleLogout = async () => {
    await signOutWithSupabase();
    setCurrentUser(null);
    saveSession(null);
    setCurrentView('auth');
    setActiveDocumentId(null);
    setIsEditingSidebar(false);
    setSelectedDocIds(new Set());
    updateUrlParams({ view: null, docId: null, edit: null, site: null, q: null, page: null });
  };

  const handleVerifyDocument = async (docId: string) => {
    if (!currentUser) return;
    const verifiedAt = new Date().toISOString();
    const updated = documents.map((doc) => {
      if (doc.id === docId) {
        return {
          ...doc,
          status: 'verified' as const,
          verifiedBy: currentUser.name,
          verifiedAt,
        };
      }
      return doc;
    });

    setDocuments(updated);
    saveDocuments(updated);
    await updateDocumentVerificationInSupabase(docId, currentUser.name, verifiedAt);
  };

  const handleUploadSuccess = (newDocOrDocs: DocumentRecord | DocumentRecord[]) => {
    const newDocsList = Array.isArray(newDocOrDocs) ? newDocOrDocs : [newDocOrDocs];
    const updated = [...newDocsList, ...documents];
    setDocuments(updated);
    saveDocuments(updated);
    setCurrentView('dashboard');
    setCurrentPage(1);
    updateUrlParams({ view: 'dashboard' });
  };

  const handleStartEditDocument = (doc: DocumentRecord) => {
    setActiveDocumentId(doc.id);
    setIsEditingSidebar(true);
    setCurrentView('preview');
    updateUrlParams({ view: 'preview', docId: doc.id, edit: 'true' });
  };

  const handleSaveEditDocument = async (updatedDoc: DocumentRecord) => {
    // Exact 4-field duplicate check (vendorName, invoiceNumber, date, amount)
    const duplicate = findDatabaseDuplicate(
      {
        vendorName: updatedDoc.vendorName,
        invoiceNumber: updatedDoc.invoiceNumber,
        date: updatedDoc.date,
        amount: updatedDoc.amount,
      },
      documents,
      updatedDoc.id
    );

    if (duplicate) {
      alert(
        `Cannot save changes: A duplicate document already exists!\n\n` +
          `• Vendor: ${duplicate.vendorName}\n` +
          `• Invoice #: ${duplicate.invoiceNumber}\n` +
          `• Date: ${duplicate.date}\n` +
          `• Amount: ₹${duplicate.amount.toLocaleString()}\n\n` +
          `All 4 fields match an existing document in the system.`
      );
      return;
    }

    const updated = documents.map((d) => (d.id === updatedDoc.id ? updatedDoc : d));
    setDocuments(updated);
    saveDocuments(updated);
    setIsEditingSidebar(false);
    updateUrlParams({ view: 'preview', docId: updatedDoc.id, edit: null });
    const ok = await updateDocumentInSupabase(updatedDoc);
    if (!ok) {
      console.warn('Notice: document update was not saved to remote database.');
    }
  };

  const handleDeleteDocument = async (doc: DocumentRecord) => {
    if (!confirm(`Are you sure you want to delete document "${doc.invoiceNumber}" (${doc.vendorName})?`)) {
      return;
    }

    const updated = documents.filter((d) => d.id !== doc.id);
    setDocuments(updated);
    saveDocuments(updated);

    if (activeDocumentId === doc.id) {
      setActiveDocumentId(null);
      setIsEditingSidebar(false);
      setCurrentView('dashboard');
      updateUrlParams({ view: 'dashboard', docId: null, edit: null });
    }

    await deleteDocumentFromSupabase(doc.id, doc.filePath);
  };

  // --------------------------------------------------------------------------
  // RENDER VIEWS
  // --------------------------------------------------------------------------
  if (!isHydrated) {
    return <LoadingFallback label="Connecting to Site Docs..." />;
  }

  // View 1: Auth
  if (currentView === 'auth' || !currentUser) {
    return <AuthView sites={sites} onLoginSuccess={handleLoginSuccess} />;
  }

  // View 2: Preview & Inline Editable Sidebar
  if (currentView === 'preview' && activeDocument) {
    return (
      <DocumentPreviewView
        document={activeDocument}
        sites={sites}
        siteMap={siteMap}
        currentUser={currentUser}
        initialEditMode={isEditingSidebar}
        existingDocuments={documents}
        onBack={() => {
          setActiveDocumentId(null);
          setIsEditingSidebar(false);
          setCurrentView('dashboard');
          updateUrlParams({ view: 'dashboard', docId: null, edit: null });
        }}
        onVerify={handleVerifyDocument}
        onSaveDocument={handleSaveEditDocument}
        onDelete={handleDeleteDocument}
      />
    );
  }

  // View 3: Upload
  if (currentView === 'upload') {
    return (
      <DocumentUploadView
        currentUser={currentUser}
        sites={sites}
        existingDocuments={documents}
        selectedSiteId={selectedSiteFilter}
        onSiteChange={(newSiteId) => {
          setSelectedSiteFilter(newSiteId);
          updateUrlParams({ site: newSiteId === 'all' ? null : newSiteId });
        }}
        onCancel={() => {
          setCurrentView('dashboard');
          updateUrlParams({ view: 'dashboard' });
        }}
        onUploadSuccess={handleUploadSuccess}
      />
    );
  }

  // View 4: Dashboard or Documents (Tabbed Shell)
  const isDocumentsView = currentView === 'documents';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans relative pb-20">
      {/* Top Navbar with Navigation Tabs */}
      <Navbar
        currentUser={currentUser}
        sites={sites}
        activeTab={isDocumentsView ? 'documents' : 'dashboard'}
        totalDocCount={documents.length}
        pendingDocCount={documents.filter((d) => d.status === 'uploaded').length}
        onTabChange={(tab) => {
          setCurrentView(tab);
          updateUrlParams({ view: tab === 'dashboard' ? null : tab });
        }}
        onOpenUpload={() => {
          setCurrentView('upload');
          updateUrlParams({ view: 'upload' });
        }}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenAdminHub={() => setIsAdminHubOpen(true)}
        onLogout={handleLogout}
        onNavigateDashboard={() => {
          setCurrentView('dashboard');
          setActiveDocumentId(null);
          setIsEditingSidebar(false);
          updateUrlParams({ view: null, docId: null, edit: null });
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 sm:py-8">
        {!isDocumentsView ? (
          /* TAB 1: Analytics Dashboard */
          <DashboardAnalyticsView
            currentUser={currentUser}
            sites={sites}
            documents={documents}
            onNavigateDocuments={(siteIdFilter, typeFilter) => {
              if (siteIdFilter) {
                setSelectedSiteFilter(siteIdFilter);
              }
              if (typeFilter) {
                setFilterRules([
                  {
                    id: 'type-' + Date.now(),
                    key: 'type',
                    operator: 'equals',
                    value: typeFilter,
                  },
                ]);
              }
              setCurrentPage(1);
              setCurrentView('documents');
              updateUrlParams({
                view: 'documents',
                site: siteIdFilter && siteIdFilter !== 'all' ? siteIdFilter : null,
                page: null,
              });
            }}
            onOpenUpload={() => {
              setCurrentView('upload');
              updateUrlParams({ view: 'upload' });
            }}
            onSelectDocument={(doc) => {
              setActiveDocumentId(doc.id);
              setIsEditingSidebar(false);
              setCurrentView('preview');
              updateUrlParams({ view: 'preview', docId: doc.id, edit: null });
            }}
          />
        ) : (
          /* TAB 2: Document Explorer & Listing */
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Search, Filter & Layout Controls */}
            <DashboardFilters
              currentUser={currentUser}
              sites={sites}
              siteMap={siteMap}
              searchQuery={searchQuery}
              onSearchChange={(q) => {
                setSearchQuery(q);
                setCurrentPage(1);
                updateUrlParams({ q: q || null, page: null });
              }}
              selectedSiteFilter={selectedSiteFilter}
              onSiteFilterChange={(siteId) => {
                setSelectedSiteFilter(siteId);
                setCurrentPage(1);
                updateUrlParams({ site: siteId === 'all' ? null : siteId, page: null });
              }}
              filterRules={filterRules}
              onApplyFilterRules={(newRules) => {
                setFilterRules(newRules);
                setCurrentPage(1);
              }}
              onRemoveFilterRule={(ruleId) => {
                setFilterRules((prev) => prev.filter((r) => r.id !== ruleId));
                setCurrentPage(1);
              }}
              onClearAllFilters={() => {
                setFilterRules([]);
                setSearchQuery('');
                setSelectedSiteFilter(
                  currentUser.assignedSiteId !== 'all' ? currentUser.assignedSiteId : 'all'
                );
                setCurrentPage(1);
                updateUrlParams({ q: null, site: null });
              }}
              displayLayout={displayLayout}
              onLayoutChange={(layout) => {
                setDisplayLayout(layout);
                updateUrlParams({ layout: layout === 'grid' ? null : layout });
              }}
              onStartUpload={() => {
                setCurrentView('upload');
                updateUrlParams({ view: 'upload' });
              }}
              onExportAll={handleExportAllFiltered}
              onExportSelected={handleExportSelected}
              selectedCount={selectedDocIds.size}
              isExporting={isExporting}
              totalDocumentCount={filteredDocuments.length}
            />

            {/* Document Grid or Table */}
            {filteredDocuments.length === 0 ? (
              <EmptyState
                hasFilters={!!searchQuery || selectedSiteFilter !== 'all' || filterRules.length > 0}
                onClearFilters={() => {
                  setFilterRules([]);
                  setSearchQuery('');
                  setSelectedSiteFilter(
                    currentUser.assignedSiteId !== 'all' ? currentUser.assignedSiteId : 'all'
                  );
                  updateUrlParams({ q: null, site: null });
                }}
                onStartUpload={() => {
                  setCurrentView('upload');
                  updateUrlParams({ view: 'upload' });
                }}
              />
            ) : displayLayout === 'grid' ? (
              <DocumentGrid
                documents={paginatedDocuments}
                siteMap={siteMap}
                currentUser={currentUser}
                selectedDocIds={selectedDocIds}
                onToggleSelect={handleToggleSelectDoc}
                onPreview={(docId) => {
                  setActiveDocumentId(docId);
                  setIsEditingSidebar(false);
                  setCurrentView('preview');
                  updateUrlParams({ view: 'preview', docId, edit: null });
                }}
                onVerify={handleVerifyDocument}
                onEdit={handleStartEditDocument}
                onDelete={handleDeleteDocument}
              />
            ) : (
              <DocumentTable
                documents={paginatedDocuments}
                siteMap={siteMap}
                currentUser={currentUser}
                selectedDocIds={selectedDocIds}
                onToggleSelect={handleToggleSelectDoc}
                onToggleSelectPage={() => {
                  if (isAllPageSelected) {
                    const next = new Set(selectedDocIds);
                    paginatedDocuments.forEach((d) => next.delete(d.id));
                    setSelectedDocIds(next);
                  } else {
                    handleSelectAllPage();
                  }
                }}
                isAllPageSelected={isAllPageSelected}
                onPreview={(docId) => {
                  setActiveDocumentId(docId);
                  setIsEditingSidebar(false);
                  setCurrentView('preview');
                  updateUrlParams({ view: 'preview', docId, edit: null });
                }}
                onVerify={handleVerifyDocument}
                onEdit={handleStartEditDocument}
                onDelete={handleDeleteDocument}
              />
            )}

            {/* Pagination Controls */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredDocuments.length}
              pageSize={pageSize}
              totalAmount={filteredDocuments.reduce((sum, d) => sum + (Number(d.amount) || 0), 0)}
              onPageChange={(p) => {
                setCurrentPage(p);
                updateUrlParams({ page: p === 1 ? null : p.toString() });
              }}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
                updateUrlParams({ page: null, limit: newSize === 6 ? null : newSize.toString() });
              }}
            />
          </div>
        )}
      </main>

      {/* Mobile Floating Action Button (FAB) for instant 1-tap upload */}
      {selectedDocIds.size === 0 && (
        <button
          onClick={() => {
            setCurrentView('upload');
            updateUrlParams({ view: 'upload' });
          }}
          className="sm:hidden fixed bottom-6 right-5 z-40 bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground font-black text-sm py-3.5 px-4 rounded-2xl shadow-2xl flex items-center gap-2 border border-border cursor-pointer animate-in fade-in slide-in-from-bottom-4 duration-300"
          aria-label="Upload document"
        >
          <Icons.Plus className="w-5 h-5 stroke-[2.5]" />
          <span>Upload</span>
        </button>
      )}

      {/* Floating Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedDocIds.size}
        totalFilteredCount={filteredDocuments.length}
        currentUser={currentUser}
        isExporting={isExporting}
        exportProgressMessage={exportProgress?.message}
        onExportSelected={handleExportSelected}
        onVerifySelected={handleBatchVerify}
        onDeleteSelected={handleBatchDelete}
        onSelectAllPage={handleSelectAllPage}
        onSelectAllFiltered={handleSelectAllFiltered}
        onDeselectAll={handleDeselectAll}
        isAllPageSelected={isAllPageSelected}
      />

      {/* Export Progress Modal */}
      <ExportProgressModal
        isOpen={isExporting}
        current={exportProgress?.current || 0}
        total={exportProgress?.total || 0}
        message={exportProgress?.message || ''}
      />

      {/* Admin Hub Modal */}
      <AdminHubModal
        isOpen={isAdminHubOpen}
        onClose={() => setIsAdminHubOpen(false)}
        users={users}
        sites={sites}
        onUsersUpdated={(u) => setUsers(u)}
        onSitesUpdated={(s) => setSites(s)}
        currentUser={currentUser}
      />

      {/* Advanced Multi-Option Filter Builder Modal */}
      <AdvancedFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        sites={sites}
        allDocuments={documents}
        currentRules={filterRules}
        onApplyRules={(newRules) => {
          setFilterRules(newRules);
          setCurrentPage(1);
        }}
      />

      {/* Account Profile & Password Settings Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        sites={sites}
        onProfileUpdated={(updatedUser) => {
          setCurrentUser(updatedUser);
          setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
        }}
      />
    </div>
  );
}

export default function Home() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback label="Loading Site Docs portal..." />}>
        <DocumentPortalContent />
      </Suspense>
    </ErrorBoundary>
  );
}
