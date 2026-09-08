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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
      {documents.map((doc) => {
        const site = siteMap.get(doc.siteId);
        const isSelected = selectedDocIds.has(doc.id);

        return (
          <div
            key={doc.id}
            onClick={() => onPreview(doc.id)}
            className={`group cursor-pointer rounded-3xl p-6 transition-all duration-200 shadow-sm hover:shadow-xl hover:shadow-neutral-950/50 flex flex-col justify-between border relative hover:z-20 ${
              isSelected
                ? 'bg-neutral-900 border-purple-500/80 ring-2 ring-purple-500/40'
                : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <div>
              {/* Header: Checkbox, Type, Status, Cloud indicator, and Minified Action Menu */}
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex items-center gap-2.5">
                  {/* Selection Checkbox */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(doc.id);
                    }}
                    className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all border ${
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
                  <div
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                      doc.status === 'verified'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
                        : 'bg-amber-950/80 text-amber-300 border-amber-800/80'
                    }`}
                  >
                    {doc.status === 'verified' ? (
                      <>
                        <Icons.Check className="w-3 h-3" />
                        Verified
                      </>
                    ) : (
                      <>
                        <Icons.Clock className="w-3 h-3" />
                        Pending
                      </>
                    )}
                  </div>

                  {/* Minified Action Menu */}
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

              {/* Vendor & Invoice # */}
              <div className="mb-4">
                <h3 className="text-base font-bold text-white group-hover:text-neutral-200 line-clamp-1">
                  {doc.vendorName}
                </h3>
                <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 mt-0.5">
                  <span>{doc.invoiceNumber}</span>
                  <span>•</span>
                  <span>{formatDate(doc.date)}</span>
                </div>
              </div>

              {/* Site Scope Pill */}
              <div className="bg-neutral-950/70 rounded-2xl p-3 border border-neutral-800/80 mb-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400 truncate max-w-[170px]">
                    {site ? site.name : 'Unknown Site'}
                  </span>
                  <span className="font-mono text-[10px] font-bold bg-neutral-800 px-2 py-0.5 rounded text-neutral-300">
                    {site?.code || 'SITE'}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom: Amount and Quick Preview Bar */}
            <div>
              <div className="flex items-baseline justify-between pt-4 border-t border-neutral-800/80">
                <span className="text-xs text-neutral-400 uppercase font-semibold">Amount</span>
                <span className="text-xl font-black font-mono text-white">
                  {formatCurrency(doc.amount)}
                </span>
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
