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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 mb-6">
        {documents.map((doc) => {
          const site = siteMap.get(doc.siteId);
          const isSelected = selectedDocIds.has(doc.id);

          return (
            <div
              key={doc.id}
              onClick={() => onPreview(doc.id)}
              className={`group cursor-pointer rounded-2xl p-4 transition-all duration-200 border relative hover:z-20 ${
                isSelected
                  ? 'bg-neutral-900 border-purple-500 ring-2 ring-purple-500/40 shadow-lg shadow-purple-950/30'
                  : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900 shadow-sm'
              }`}
            >
              {/* Row 1: Checkbox + Vendor Name + Amount */}
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* Selection Checkbox */}
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

              {/* Row 2: Type Pill • Invoice # • Site Code • Date • Status • Action Menu */}
              <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-neutral-800/60 text-xs">
                <div className="flex items-center gap-2 overflow-hidden flex-wrap sm:flex-nowrap">
                  {/* Type Badge */}
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

                  {/* Invoice # */}
                  <span className="font-mono text-xs text-neutral-300 truncate max-w-[120px] sm:max-w-[140px]" title={doc.invoiceNumber}>
                    {doc.invoiceNumber}
                  </span>

                  <span className="text-neutral-600 hidden sm:inline">•</span>

                  {/* Site Pill */}
                  <span
                    className="text-[10px] font-mono text-neutral-400 bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800 truncate max-w-[110px]"
                    title={site ? `${site.name} (${site.code})` : 'Unassigned'}
                  >
                    {site?.code || 'SITE'}
                  </span>

                  <span className="text-neutral-600 hidden sm:inline">•</span>

                  {/* Date */}
                  <span className="text-[11px] text-neutral-400 whitespace-nowrap hidden sm:inline">
                    {formatDate(doc.date)}
                  </span>
                </div>

                {/* Status Badge & Action Menu */}
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

                  {/* Action Menu */}
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
