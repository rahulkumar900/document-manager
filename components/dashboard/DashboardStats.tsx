import React from 'react';
import { DocumentRecord, SiteRecord } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Icons } from '../ui/icons';

interface DashboardStatsProps {
  documents: DocumentRecord[];
  sites: SiteRecord[];
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ documents, sites }) => {
  const totalVolume = documents.reduce((sum, doc) => sum + (doc.amount || 0), 0);
  const verifiedCount = documents.filter((doc) => doc.status === 'verified').length;
  const pendingCount = documents.filter((doc) => doc.status === 'uploaded').length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Stat 1: Total Volume */}
      <div className="bg-card border border-border rounded-3xl p-5 shadow-sm hover:border-border/80 transition-colors">
        <div className="flex items-center justify-between text-muted-foreground mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">Total Volume</span>
          <div className="w-8 h-8 rounded-xl bg-muted text-foreground flex items-center justify-center">
            <Icons.File className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-black font-mono tracking-tight text-foreground">
          {formatCurrency(totalVolume)}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1 font-medium">
          {documents.length} captured invoices & challans
        </div>
      </div>

      {/* Stat 2: Verified Documents */}
      <div className="bg-card border border-border rounded-3xl p-5 shadow-sm hover:border-border/80 transition-colors">
        <div className="flex items-center justify-between text-muted-foreground mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">Verified Audits</span>
          <div className="w-8 h-8 rounded-xl bg-emerald-950/80 text-emerald-400 flex items-center justify-center border border-emerald-800/50">
            <Icons.Check className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-black font-mono tracking-tight text-emerald-400">
          {verifiedCount}
        </div>
        <div className="text-[11px] text-emerald-400/80 mt-1 font-medium">
          Reviewed & approved by Checkers
        </div>
      </div>

      {/* Stat 3: Pending Approvals */}
      <div className="bg-card border border-border rounded-3xl p-5 shadow-sm hover:border-border/80 transition-colors">
        <div className="flex items-center justify-between text-muted-foreground mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">Pending Action</span>
          <div className="w-8 h-8 rounded-xl bg-amber-950/80 text-amber-400 flex items-center justify-center border border-amber-800/50">
            <Icons.Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-black font-mono tracking-tight text-amber-400">
          {pendingCount}
        </div>
        <div className="text-[11px] text-amber-400/80 mt-1 font-medium">
          Awaiting compliance verification
        </div>
      </div>

      {/* Stat 4: Active Construction Sites */}
      <div className="bg-card border border-border rounded-3xl p-5 shadow-sm hover:border-border/80 transition-colors">
        <div className="flex items-center justify-between text-muted-foreground mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">Active Sites</span>
          <div className="w-8 h-8 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center border border-border">
            <Icons.Building className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-black font-mono tracking-tight text-foreground">
          {sites.length}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1 font-medium">
          Registered construction zones
        </div>
      </div>
    </div>
  );
};
