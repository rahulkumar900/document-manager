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
                  ? 'bg-neutral-900 border-purple-500 ring-2 ring-purple-500/40 shadow-lg shadow-purple-950/40'
                  : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900 shadow-sm hover:shadow-xl hover:shadow-neutral-950/60'
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
                          ? 'bg-purple-600 border-purple-500 text-white shadow-sm'
                          : 'bg-neutral-950 border-neutral-700 hover:border-neutral-500 text-transparent'
                      }`}
                      aria-label={`Select document ${doc.invoiceNumber}`}
                    >
                      <Icons.Check className="w-3 h-3 stroke-[3]" />
                    </button>

                    <h3 className="text-sm font-bold text-white group-hover:text-purple-200 truncate transition-colors">
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
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-800/60 text-xs">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border shrink-0 ${
                        doc.type === 'Invoice'
                          ? 'bg-purple-950/70 text-purple-300 border-purple-800/60'
                          : doc.type === 'Challan'
                          ? 'bg-indigo-950/70 text-indigo-300 border-indigo-800/60'
                          : doc.type === 'Credit Note'
                          ? 'bg-rose-950/70 text-rose-300 border-rose-800/60'
                          : 'bg-sky-950/70 text-sky-300 border-sky-800/60'
                      }`}
                    >
                      {doc.type}
                    </span>

                    <span className="font-mono text-xs text-neutral-300 truncate max-w-[120px]">
                      {doc.invoiceNumber}
                    </span>

                    <span className="text-neutral-600">•</span>

                    <span className="text-[10px] font-mono text-neutral-400 bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800 shrink-0">
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
                            ? 'bg-purple-600 border-purple-500 text-white shadow-sm'
                            : 'bg-neutral-950 border-neutral-700 hover:border-neutral-500 text-transparent'
                        }`}
                        aria-label={`Select document ${doc.invoiceNumber}`}
                      >
                        <Icons.Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>

                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                          doc.type === 'Invoice'
                            ? 'bg-purple-950/80 text-purple-300 border-purple-800/80'
                            : doc.type === 'Challan'
                            ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800/80'
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
                    <h3 className="text-base font-bold text-white group-hover:text-purple-200 transition-colors line-clamp-1">
                      {doc.vendorName}
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 mt-1">
                      <span className="text-purple-300 font-semibold">{doc.invoiceNumber}</span>
                      <span>•</span>
                      <span>{formatDate(doc.date)}</span>
                    </div>
                  </div>

                  {/* Site Scope Card */}
                  <div className="bg-neutral-950/70 rounded-xl p-3 border border-neutral-800/80 mb-4">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Icons.Building className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                        <span className="text-neutral-300 truncate font-medium">
                          {site ? site.name : 'Unknown Site'}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] font-bold bg-neutral-800 px-2 py-0.5 rounded text-neutral-300 shrink-0">
                        {site?.code || 'SITE'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer: Amount & Quick Actions */}
                <div className="flex items-baseline justify-between pt-3.5 border-t border-neutral-800/80 mt-auto">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-neutral-400 block mb-0.5">
                      Total Amount
                    </span>
                    <span className="text-xl font-black font-mono text-white group-hover:text-emerald-400 transition-colors">
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
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                      title="Preview Document"
                    >
                      <Icons.Eye className="w-3.5 h-3.5 text-purple-400" />
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
        <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg mb-8">
          <div className="flex items-center gap-2.5 text-xs text-neutral-400">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span>
              Showing total for <strong className="text-white font-bold">{documents.length}</strong> document{documents.length > 1 ? 's' : ''} on this page
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs uppercase font-bold text-neutral-400 tracking-wider">
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
