'use client';

import React, { useState, useMemo } from 'react';
import { UserAccount, SiteRecord, DocumentRecord, DocumentType } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Icons } from '../ui/icons';

type TimePeriod = 'all' | '30d' | 'this_month' | 'this_year';

interface DashboardAnalyticsViewProps {
  currentUser: UserAccount;
  sites: SiteRecord[];
  documents: DocumentRecord[];
  onNavigateDocuments: (siteIdFilter?: string, typeFilter?: DocumentType) => void;
  onOpenUpload: () => void;
  onSelectDocument: (doc: DocumentRecord) => void;
}

export const DashboardAnalyticsView: React.FC<DashboardAnalyticsViewProps> = ({
  currentUser,
  sites,
  documents,
  onNavigateDocuments,
  onOpenUpload,
  onSelectDocument,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('all');

  // Filter documents accessible by the user role
  const userScopedDocs = useMemo(() => {
    if (currentUser.assignedSiteId === 'all') {
      return documents;
    }
    return documents.filter((d) => d.siteId === currentUser.assignedSiteId);
  }, [documents, currentUser.assignedSiteId]);

  // Apply Time Period Filter
  const accessibleDocuments = useMemo(() => {
    if (selectedPeriod === 'all') return userScopedDocs;

    const now = new Date();
    return userScopedDocs.filter((doc) => {
      const docDate = new Date(doc.date || doc.createdAt);
      if (isNaN(docDate.getTime())) return true;

      if (selectedPeriod === '30d') {
        const diffDays = (now.getTime() - docDate.getTime()) / (1000 * 3600 * 24);
        return diffDays <= 30;
      }
      if (selectedPeriod === 'this_month') {
        return (
          docDate.getMonth() === now.getMonth() &&
          docDate.getFullYear() === now.getFullYear()
        );
      }
      if (selectedPeriod === 'this_year') {
        return docDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [userScopedDocs, selectedPeriod]);

  // Compute Core Financial & Document KPIs
  const totalAmount = accessibleDocuments.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const totalCount = accessibleDocuments.length;
  const verifiedDocs = accessibleDocuments.filter((d) => d.status === 'verified');
  const pendingDocs = accessibleDocuments.filter((d) => d.status === 'uploaded');

  const verifiedCount = verifiedDocs.length;
  const pendingCount = pendingDocs.length;
  const verifiedAmount = verifiedDocs.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const pendingAmount = pendingDocs.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const verificationRate = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 100;

  // Compute Site Spend Breakdown
  const siteAnalytics = useMemo(() => {
    return sites
      .map((site) => {
        const siteDocs = accessibleDocuments.filter((d) => d.siteId === site.id);
        const siteSpend = siteDocs.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
        const sitePending = siteDocs.filter((d) => d.status === 'uploaded').length;
        const percentageOfTotal = totalAmount > 0 ? (siteSpend / totalAmount) * 100 : 0;

        return {
          ...site,
          docCount: siteDocs.length,
          totalSpend: siteSpend,
          pendingCount: sitePending,
          percentageOfTotal,
        };
      })
      .sort((a, b) => b.totalSpend - a.totalSpend);
  }, [sites, accessibleDocuments, totalAmount]);

  // Compute Document Type Distribution
  const typeDistribution = useMemo(() => {
    const types: DocumentType[] = ['Invoice', 'Challan', 'Credit Note', 'Ledger'];
    const colorMap: Record<DocumentType, { label: string; colorClass: string; bgClass: string; borderClass: string; barClass: string }> = {
      Invoice: { label: 'Tax Invoices', colorClass: 'text-primary', bgClass: 'bg-primary/15', borderClass: 'border-primary/30', barClass: 'bg-primary' },
      Challan: { label: 'Delivery Challans', colorClass: 'text-indigo-300', bgClass: 'bg-indigo-950/40', borderClass: 'border-indigo-800/50', barClass: 'bg-indigo-500' },
      'Credit Note': { label: 'Credit Notes', colorClass: 'text-rose-300', bgClass: 'bg-rose-950/40', borderClass: 'border-rose-800/50', barClass: 'bg-rose-500' },
      Ledger: { label: 'Vendor Ledgers', colorClass: 'text-sky-300', bgClass: 'bg-sky-950/40', borderClass: 'border-sky-800/50', barClass: 'bg-sky-500' },
    };

    return types.map((type) => {
      const docsOfType = accessibleDocuments.filter((d) => d.type === type);
      const amount = docsOfType.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
      const percentage = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;

      return {
        type,
        label: colorMap[type].label,
        count: docsOfType.length,
        totalAmount: amount,
        percentage,
        colorClass: colorMap[type].colorClass,
        bgClass: colorMap[type].bgClass,
        borderClass: colorMap[type].borderClass,
        barClass: colorMap[type].barClass,
      };
    });
  }, [accessibleDocuments, totalAmount]);

  // Compute Top 5 Vendors by Spend
  const topVendors = useMemo(() => {
    const vendorMap = new Map<string, { name: string; totalSpend: number; count: number }>();
    accessibleDocuments.forEach((d) => {
      const name = d.vendorName.trim() || 'Unknown Vendor';
      const prev = vendorMap.get(name) || { name, totalSpend: 0, count: 0 };
      vendorMap.set(name, {
        name,
        totalSpend: prev.totalSpend + (Number(d.amount) || 0),
        count: prev.count + 1,
      });
    });

    return Array.from(vendorMap.values())
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 5)
      .map((v) => ({
        ...v,
        percentageOfTotal: totalAmount > 0 ? (v.totalSpend / totalAmount) * 100 : 0,
      }));
  }, [accessibleDocuments, totalAmount]);

  // Recent 5 uploaded documents
  const recentDocuments = useMemo(() => {
    return [...accessibleDocuments]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [accessibleDocuments]);

  // Site map for lookup
  const siteMap = useMemo(() => {
    return new Map(sites.map((s) => [s.id, s]));
  }, [sites]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* 1. Header & Period Filters */}
      <div className="bg-card border border-border rounded-3xl p-5 sm:p-7 backdrop-blur-xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-muted-foreground">
              {currentUser.assignedSiteId === 'all'
                ? 'All Construction Sites'
                : `Site: ${siteMap.get(currentUser.assignedSiteId)?.name || 'Assigned Site'}`}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            Welcome back, {currentUser.name}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Financial analytics, site spend distributions, and document verification queue.
          </p>
        </div>

        {/* Period Selector & Quick CTAs */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Timeframe pill switcher */}
          <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border text-xs">
            <button
              type="button"
              onClick={() => setSelectedPeriod('all')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                selectedPeriod === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriod('30d')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                selectedPeriod === '30d' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              30 Days
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriod('this_month')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                selectedPeriod === 'this_month' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              This Month
            </button>
          </div>

          <button
            onClick={onOpenUpload}
            className="inline-flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground font-bold text-xs py-2 px-3.5 rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Icons.Plus className="w-3.5 h-3.5" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* 2. Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Total Spend */}
        <div className="bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden group hover:border-muted-foreground/30 transition-all">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Total Portfolio Spend
            </span>
            <div className="w-8 h-8 rounded-xl bg-secondary text-secondary-foreground border border-border flex items-center justify-center shadow-inner">
              <Icons.Building className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-foreground font-mono tracking-tight">
            {formatCurrency(totalAmount)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5">
            <span className="font-semibold text-foreground">{totalCount} total</span> documents recorded
          </p>
        </div>

        {/* Verified Value */}
        <div className="bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden group hover:border-muted-foreground/30 transition-all">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Verified Value
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 flex items-center justify-center shadow-inner">
              <Icons.Check className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight">
            {formatCurrency(verifiedAmount)}
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
            <span>{verifiedCount} verified</span>
            <span className="font-bold text-emerald-400">{verificationRate}% rate</span>
          </div>
        </div>

        {/* Pending Verification */}
        <div 
          onClick={() => pendingCount > 0 && onNavigateDocuments()}
          className={`bg-card border rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden transition-all ${
            pendingCount > 0 
              ? 'border-amber-500/40 hover:border-amber-500/70 cursor-pointer group' 
              : 'border-border'
          }`}
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Pending Verification
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-950/60 border border-amber-800/50 text-amber-400 flex items-center justify-center shadow-inner">
              <Icons.Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tracking-tight">
            {formatCurrency(pendingAmount)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 flex items-center justify-between">
            <span className="font-semibold text-amber-400">{pendingCount} pending check</span>
            {pendingCount > 0 && (
              <span className="text-amber-400 group-hover:underline font-bold">Review →</span>
            )}
          </p>
        </div>

        {/* Active Sites */}
        <div className="bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden group hover:border-muted-foreground/30 transition-all">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Construction Sites
            </span>
            <div className="w-8 h-8 rounded-xl bg-secondary text-secondary-foreground border border-border flex items-center justify-center shadow-inner">
              <Icons.Building className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-foreground font-mono tracking-tight">
            {sites.length}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Multi-site real-time tracking
          </p>
        </div>
      </div>

      {/* 3. Middle Section: Site Spend Allocation & Document Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Site Spend Breakdown */}
        <div className="lg:col-span-2 bg-card border border-border rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-foreground tracking-tight flex items-center gap-2">
                <Icons.Building className="w-4 h-4 text-primary" />
                <span>Site Spend Breakdown</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Financial allocation and invoice density across construction sites
              </p>
            </div>
            <button
              onClick={() => onNavigateDocuments()}
              className="text-xs font-bold text-foreground hover:underline cursor-pointer"
            >
              View in Explorer →
            </button>
          </div>

          <div className="space-y-3 pt-1">
            {siteAnalytics.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No construction sites registered yet.
              </div>
            ) : (
              siteAnalytics.map((site) => (
                <div
                  key={site.id}
                  onClick={() => onNavigateDocuments(site.id)}
                  className="p-3.5 rounded-2xl bg-muted/30 hover:bg-muted/60 border border-border hover:border-muted-foreground/40 transition-all cursor-pointer group space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-secondary border border-border text-secondary-foreground font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                        {site.code}
                      </span>
                      <div className="truncate">
                        <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                          {site.name}
                        </h4>
                        <span className="text-[10px] text-muted-foreground">
                          {site.docCount} docs • {site.pendingCount > 0 ? `${site.pendingCount} pending` : 'All verified'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs sm:text-sm font-black font-mono text-foreground">
                        {formatCurrency(site.totalSpend)}
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground font-bold">
                        {site.percentageOfTotal.toFixed(1)}% of spend
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(site.percentageOfTotal, 2)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Col: Document Type Distribution */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-xl space-y-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground tracking-tight flex items-center gap-2">
              <Icons.File className="w-4 h-4 text-primary" />
              <span>Document Types</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Breakdown by invoice, challan, ledger & credit note
            </p>
          </div>

          <div className="space-y-2.5 pt-1">
            {typeDistribution.map((item) => (
              <div
                key={item.type}
                onClick={() => onNavigateDocuments(undefined, item.type)}
                className={`p-3 rounded-2xl border border-border bg-muted/30 hover:bg-muted/60 transition-all cursor-pointer group flex items-center justify-between gap-3`}
              >
                <div>
                  <h4 className="text-xs font-bold text-foreground group-hover:underline">
                    {item.label}
                  </h4>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {item.count} document{item.count !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black font-mono text-foreground">
                    {formatCurrency(item.totalAmount)}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {item.percentage.toFixed(1)}% share
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Bottom Section: Top Vendors & Pending Verification Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Vendors by Spend */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-bold text-foreground tracking-tight flex items-center gap-2">
              <Icons.Users className="w-4 h-4 text-primary" />
              <span>Top Suppliers & Vendors</span>
            </h3>
            <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
              Ranked by Spend
            </span>
          </div>

          <div className="space-y-2.5">
            {topVendors.length === 0 ? (
              <div className="p-8 text-center bg-muted/20 rounded-2xl border border-border text-xs text-muted-foreground">
                No vendor transactions recorded yet.
              </div>
            ) : (
              topVendors.map((vendor, idx) => (
                <div
                  key={vendor.name}
                  onClick={() => onNavigateDocuments()}
                  className="p-3 rounded-2xl bg-muted/30 hover:bg-muted/60 border border-border transition-all flex items-center justify-between gap-3 cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-secondary text-foreground font-mono text-[11px] font-bold flex items-center justify-center shrink-0 border border-border">
                      {idx + 1}
                    </span>
                    <div className="truncate">
                      <h4 className="text-xs font-bold text-foreground transition-colors truncate">
                        {vendor.name}
                      </h4>
                      <span className="text-[10px] text-muted-foreground">
                        {vendor.count} document{vendor.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-black font-mono text-emerald-400">
                      {formatCurrency(vendor.totalSpend)}
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {vendor.percentageOfTotal.toFixed(1)}% of spend
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending Verification Action Queue */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <h3 className="text-sm sm:text-base font-bold text-foreground tracking-tight">
                Pending Verification Queue
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
              {pendingCount} Pending
            </span>
          </div>

          <div className="space-y-2.5">
            {pendingDocs.length === 0 ? (
              <div className="p-8 text-center bg-muted/20 rounded-2xl border border-border">
                <Icons.Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-foreground">All Documents Verified!</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  There are no pending documents waiting for checker verification.
                </p>
              </div>
            ) : (
              pendingDocs.slice(0, 4).map((doc) => {
                const site = siteMap.get(doc.siteId);
                return (
                  <div
                    key={doc.id}
                    onClick={() => onSelectDocument(doc)}
                    className="p-3 rounded-2xl bg-muted/30 hover:bg-muted/60 border border-border hover:border-amber-500/30 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground group-hover:text-amber-400 transition-colors truncate">
                          {doc.vendorName}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border">
                          {doc.invoiceNumber}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">
                        {site?.name || 'Site'} • {formatDate(doc.date)}
                      </span>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-2.5">
                      <div>
                        <div className="text-xs font-black font-mono text-amber-400">
                          {formatCurrency(doc.amount)}
                        </div>
                        <span className="text-[9px] font-bold uppercase text-amber-400">
                          Needs Check
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground group-hover:text-foreground p-1 rounded-lg bg-secondary group-hover:bg-amber-500/20 transition-colors">
                        →
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
