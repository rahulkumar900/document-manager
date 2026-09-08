import React from 'react';
import { DocumentRecord, SiteRecord, UserAccount } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Icons } from '../ui/icons';
import { DocumentActionMenu } from './DocumentActionMenu';

interface DocumentGridProps {
  documents: DocumentRecord[];
  siteMap: Map<string, SiteRecord>;
  currentUser: UserAccount;
  selectedDocIds: Set<string>;
  onToggleSelect: (docId: string) => void;
  onPreview: (docId: string) => void;
  onVerify: (docId: string) => void;
  onEdit: (doc: DocumentRecord) => void;
  onDelete: (doc: DocumentRecord) => void;
}

export const DocumentGrid: React.FC<DocumentGridProps> = React.memo(({
  documents,
  siteMap,
  currentUser,
  selectedDocIds,
  onToggleSelect,
  onPreview,
  onVerify,
  onEdit,
  onDelete,
}) => {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-5 mb-6">
        {documents.map((doc) => {
          const site = siteMap.get(doc.siteId);
          const isSelected = selectedDocIds.has(doc.id);
          const canVerifyThisDoc =
            (currentUser.role === 'Checker' || currentUser.role === 'Admin') &&
            doc.status === 'uploaded';

          return (
            <div
              key={doc.id}
              onClick={() => onPreview(doc.id)}
              className={`group cursor-pointer rounded-2xl md:rounded-3xl transition-all duration-200 border relative hover:z-20 ${
                isSelected
                  ? 'bg-card border-ring ring-2 ring-ring/40 shadow-lg'
                  : 'bg-card border-border hover:border-muted-foreground/30 shadow-sm hover:shadow-xl'
              }`}
            >
              {/* ========================================================= */}
              {/* 1. MOBILE LAYOUT (Compact Dense Card - Under 768px)       */}
              {/* ========================================================= */}
              <div className="md:hidden p-3.5 space-y-2.5">
                {/* Row 1: Checkbox + Vendor Name + Amount */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect(doc.id);
                      }}
                      className={`w-4 h-4 rounded-md flex items-center justify-center transition-all border shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                          : 'bg-background border-input hover:border-muted-foreground text-transparent'
                      }`}
                      aria-label={`Select document ${doc.invoiceNumber}`}
                    >
                      <Icons.Check className="w-3 h-3 stroke-[3]" />
                    </button>

                    <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                      {doc.vendorName}
                    </h3>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-base font-black font-mono text-emerald-400">
                      {formatCurrency(doc.amount)}
                    </span>
                  </div>
                </div>

                {/* Row 2: Type Pill • Invoice # • Site Code • Status • Action Menu */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/80 text-xs">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border shrink-0 ${
                        doc.type === 'Invoice'
                          ? 'bg-secondary text-secondary-foreground border-border'
                          : doc.type === 'Challan'
                          ? 'bg-muted text-muted-foreground border-border'
                          : doc.type === 'Credit Note'
                          ? 'bg-rose-950/70 text-rose-300 border-rose-800/60'
                          : 'bg-sky-950/70 text-sky-300 border-sky-800/60'
                      }`}
                    >
                      {doc.type}
                    </span>

                    <span className="font-mono text-xs text-foreground truncate max-w-[120px]">
                      {doc.invoiceNumber}
                    </span>

                    <span className="text-muted-foreground">•</span>

                    <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border shrink-0">
                      {site?.code || 'SITE'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                        doc.status === 'verified'
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
                          : 'bg-amber-950/80 text-amber-300 border-amber-800/80'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          doc.status === 'verified' ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                      />
                      <span>{doc.status === 'verified' ? 'Verified' : 'Pending'}</span>
                    </span>

                    <div onClick={(e) => e.stopPropagation()}>
                      <DocumentActionMenu
                        document={doc}
                        currentUser={currentUser}
                        onPreview={onPreview}
                        onVerify={onVerify}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ========================================================= */}
              {/* 2. DESKTOP & TABLET LAYOUT (Spacious Executive Card)      */}
              {/* ========================================================= */}
              <div className="hidden md:flex flex-col justify-between h-full p-5 lg:p-6">
                <div>
                  {/* Top Bar: Checkbox + Type Pill + Status + Action Menu */}
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSelect(doc.id);
                        }}
                        className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all border shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                            : 'bg-background border-input hover:border-muted-foreground text-transparent'
                        }`}
                        aria-label={`Select document ${doc.invoiceNumber}`}
                      >
                        <Icons.Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>

                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                          doc.type === 'Invoice'
                            ? 'bg-secondary text-secondary-foreground border-border'
                            : doc.type === 'Challan'
                            ? 'bg-muted text-muted-foreground border-border'
                            : doc.type === 'Credit Note'
                            ? 'bg-rose-950/80 text-rose-300 border-rose-800/80'
                            : 'bg-sky-950/80 text-sky-300 border-sky-800/80'
                        }`}
                      >
                        {doc.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
                          doc.status === 'verified'
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
                            : 'bg-amber-950/80 text-amber-300 border-amber-800/80'
                        }`}
                      >
                        {doc.status === 'verified' ? (
                          <>
                            <Icons.Check className="w-3 h-3 stroke-[2.5]" />
                            <span>Verified</span>
                          </>
                        ) : (
                          <>
                            <Icons.Clock className="w-3 h-3" />
                            <span>Pending</span>
                          </>
                        )}
                      </span>

                      <div onClick={(e) => e.stopPropagation()}>
                        <DocumentActionMenu
                          document={doc}
                          currentUser={currentUser}
                          onPreview={onPreview}
                          onVerify={onVerify}
                          onEdit={onEdit}
                          onDelete={onDelete}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Vendor Name & Reference */}
                  <div className="mb-3">
                    <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {doc.vendorName}
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mt-1">
                      <span className="text-foreground font-semibold">{doc.invoiceNumber}</span>
                      <span>•</span>
                      <span>{formatDate(doc.date)}</span>
                    </div>
                  </div>

                  {/* Site Scope Card */}
                  <div className="bg-muted/40 rounded-xl p-3 border border-border/80 mb-4">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Icons.Building className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-foreground truncate font-medium">
                          {site ? site.name : 'Unknown Site'}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] font-bold bg-secondary text-secondary-foreground border border-border px-2 py-0.5 rounded shrink-0">
                        {site?.code || 'SITE'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer: Amount & Quick Actions */}
                <div className="flex items-baseline justify-between pt-3.5 border-t border-border/80 mt-auto">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block mb-0.5">
                      Total Amount
                    </span>
                    <span className="text-xl font-black font-mono text-foreground group-hover:text-emerald-400 transition-colors">
                      {formatCurrency(doc.amount)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                    {canVerifyThisDoc && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onVerify(doc.id);
                        }}
                        className="p-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/60 text-emerald-400 hover:text-white transition-all cursor-pointer shadow-sm"
                        title="Quick Verify"
                      >
                        <Icons.Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreview(doc.id);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-accent border border-border transition-colors cursor-pointer"
                      title="Preview Document"
                    >
                      <Icons.Eye className="w-3.5 h-3.5 text-primary" />
                      <span>Preview</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid Summary Footer: Total Amount */}
      {documents.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg mb-8">
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span>
              Showing total for <strong className="text-foreground font-bold">{documents.length}</strong> document{documents.length > 1 ? 's' : ''} on this page
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
              Total Amount:
            </span>
            <span className="text-lg sm:text-xl font-mono font-black text-emerald-400">
              {formatCurrency(
                documents.reduce((sum, doc) => sum + (Number(doc.amount) || 0), 0)
              )}
            </span>
          </div>
        </div>
      )}
    </>
  );
});

DocumentGrid.displayName = 'DocumentGrid';
