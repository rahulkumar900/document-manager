import React from 'react';
import { DocumentRecord, SiteRecord, UserAccount } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Icons } from '../ui/icons';
import { DocumentActionMenu } from './DocumentActionMenu';

interface DocumentTableProps {
  documents: DocumentRecord[];
  siteMap: Map<string, SiteRecord>;
  currentUser: UserAccount;
  selectedDocIds: Set<string>;
  onToggleSelect: (docId: string) => void;
  onToggleSelectPage: () => void;
  isAllPageSelected: boolean;
  onPreview: (docId: string) => void;
  onVerify: (docId: string) => void;
  onEdit: (doc: DocumentRecord) => void;
  onDelete: (doc: DocumentRecord) => void;
}

export const DocumentTable: React.FC<DocumentTableProps> = React.memo(({
  documents,
  siteMap,
  currentUser,
  selectedDocIds,
  onToggleSelect,
  onToggleSelectPage,
  isAllPageSelected,
  onPreview,
  onVerify,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="w-full h-auto bg-neutral-900 border border-neutral-800 rounded-3xl shadow-xl mb-8 relative overflow-hidden">
      {/* 1. Mobile Optimized Card List View (< sm screens) */}
      <div className="block sm:hidden divide-y divide-neutral-800/80">
        {/* Mobile Page Select All Header */}
        <div className="p-3.5 bg-neutral-950/80 flex items-center justify-between border-b border-neutral-800 text-xs">
          <button
            type="button"
            onClick={onToggleSelectPage}
            className="flex items-center gap-2 text-neutral-300 font-semibold active:scale-95 transition-transform cursor-pointer"
          >
            <div
              className={`w-4 h-4 rounded-md flex items-center justify-center transition-all border ${
                isAllPageSelected && documents.length > 0
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'bg-neutral-900 border-neutral-700 text-transparent'
              }`}
            >
              <Icons.Check className="w-3 h-3 stroke-[3]" />
            </div>
            <span>{isAllPageSelected ? 'Deselect Page' : 'Select All Page'}</span>
          </button>
          <span className="text-[11px] font-mono text-neutral-500">
            {documents.length} item{documents.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Mobile Document Cards List */}
        {documents.map((doc) => {
          const site = siteMap.get(doc.siteId);
          const isSelected = selectedDocIds.has(doc.id);

          return (
            <div
              key={doc.id}
              onClick={() => onPreview(doc.id)}
              className={`p-4 transition-colors cursor-pointer active:bg-neutral-800/60 relative ${
                isSelected ? 'bg-purple-950/30' : 'hover:bg-neutral-800/30'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Left: Checkbox + Vendor & Meta */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(doc.id);
                    }}
                    className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all border shrink-0 mt-0.5 ${
                      isSelected
                        ? 'bg-purple-600 border-purple-500 text-white shadow-sm'
                        : 'bg-neutral-950 border-neutral-700 text-transparent'
                    }`}
                    aria-label={`Select document ${doc.invoiceNumber}`}
                  >
                    <Icons.Check className="w-3.5 h-3.5 stroke-[3]" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-white truncate">{doc.vendorName}</h4>
                      <span
                        className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
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

                    <div className="text-xs font-mono text-neutral-400 mt-1 flex items-center gap-2 flex-wrap">
                      <span className="text-purple-300 font-semibold">{doc.invoiceNumber}</span>
                      <span>•</span>
                      <span>{formatDate(doc.date)}</span>
                    </div>

                    <div className="text-[11px] text-neutral-500 mt-1 flex items-center gap-1.5">
                      <Icons.Building className="w-3 h-3 text-neutral-500 shrink-0" />
                      <span className="truncate">{site ? `${site.name} (${site.code})` : 'Unassigned'}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Amount, Status & 3-dot Menu */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <div className="text-sm font-black font-mono text-emerald-400">
                    {formatCurrency(doc.amount)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                        doc.status === 'verified'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border-amber-800'
                      }`}
                    >
                      {doc.status === 'verified' ? 'Verified' : 'Pending'}
                    </span>
                    <div onClick={(e) => e.stopPropagation()}>
                      <DocumentActionMenu
                        document={doc}
                        currentUser={currentUser}
                        onPreview={onPreview}
                        onVerify={onVerify}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        align="right"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Mobile Total Footer */}
        {documents.length > 0 && (
          <div className="p-4 bg-neutral-950/90 border-t border-neutral-800 flex items-center justify-between text-xs">
            <span className="text-neutral-400 font-bold uppercase tracking-wider text-[10px]">
              Page Total ({documents.length} docs):
            </span>
            <span className="font-mono font-black text-sm text-emerald-400">
              {formatCurrency(documents.reduce((sum, doc) => sum + (Number(doc.amount) || 0), 0))}
            </span>
          </div>
        )}
      </div>

      {/* 2. Tablet & Desktop Full Table View (>= sm screens) */}
      <div className="hidden sm:block w-full h-auto overflow-x-auto rounded-3xl">
        <table className="w-full h-auto text-left text-xs sm:text-sm">
          <thead>
            <tr className="bg-neutral-950/70 border-b border-neutral-800 text-[11px] font-black uppercase tracking-wider text-neutral-400">
              <th className="py-4 px-4 w-10 text-center">
                <button
                  type="button"
                  onClick={onToggleSelectPage}
                  className={`w-4 h-4 rounded-md flex items-center justify-center transition-all border ${
                    isAllPageSelected && documents.length > 0
                      ? 'bg-purple-600 border-purple-500 text-white'
                      : 'bg-neutral-950 border-neutral-700 hover:border-neutral-500 text-transparent'
                  }`}
                  title={isAllPageSelected ? 'Deselect all on this page' : 'Select all on this page'}
                  aria-label="Select all on this page"
                >
                  <Icons.Check className="w-3 h-3 stroke-[3]" />
                </button>
              </th>
              <th className="py-4 px-4">Vendor / Supplier</th>
              <th className="py-4 px-4">Invoice #</th>
              <th className="py-4 px-4">Site</th>
              <th className="py-4 px-4">Date</th>
              <th className="py-4 px-4">Type</th>
              <th className="py-4 px-4 text-right">Amount</th>
              <th className="py-4 px-4 text-center">Status</th>
              <th className="py-4 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800 font-medium h-auto">
            {documents.map((doc) => {
              const site = siteMap.get(doc.siteId);
              const isSelected = selectedDocIds.has(doc.id);

              return (
                <tr
                  key={doc.id}
                  className={`transition-colors group cursor-pointer relative hover:z-20 ${
                    isSelected
                      ? 'bg-purple-950/20 hover:bg-purple-950/30'
                      : 'hover:bg-neutral-800/40'
                  }`}
                  onClick={() => onPreview(doc.id)}
                >
                  {/* Row Checkbox */}
                  <td
                    className="py-4 px-4 text-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(doc.id);
                    }}
                  >
                    <button
                      type="button"
                      className={`w-4 h-4 rounded-md flex items-center justify-center transition-all border ${
                        isSelected
                          ? 'bg-purple-600 border-purple-500 text-white shadow-sm'
                          : 'bg-neutral-950 border-neutral-700 hover:border-neutral-500 text-transparent'
                      }`}
                      aria-label={`Select document ${doc.invoiceNumber}`}
                    >
                      <Icons.Check className="w-3 h-3 stroke-[3]" />
                    </button>
                  </td>

                  <td className="py-4 px-4">
                    <div className="font-bold text-white group-hover:text-neutral-200">
                      {doc.vendorName}
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono">
                      By {doc.uploadedBy}
                    </div>
                  </td>

                  <td className="py-4 px-4 font-mono text-neutral-300">
                    <div className="flex items-center gap-1.5">
                      <span>{doc.invoiceNumber}</span>
                      {doc.fileUrl && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400" title="Cloud File Uploaded" />
                      )}
                    </div>
                  </td>

                  <td className="py-4 px-4">
                    <div className="text-neutral-300 font-semibold">{site?.name || 'Unassigned'}</div>
                    <div className="text-[10px] font-mono text-neutral-500">{site?.code || 'SITE'}</div>
                  </td>

                  <td className="py-4 px-4 font-mono text-neutral-400">
                    {formatDate(doc.date)}
                  </td>

                  <td className="py-4 px-4">
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
                  </td>

                  <td className="py-4 px-4 text-right font-mono font-bold text-white">
                    {formatCurrency(doc.amount)}
                  </td>

                  <td className="py-4 px-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
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
                    </span>
                  </td>

                  <td
                    className="py-4 px-4 text-right relative"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end">
                      <DocumentActionMenu
                        document={doc}
                        currentUser={currentUser}
                        onPreview={onPreview}
                        onVerify={onVerify}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        align="right"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {documents.length > 0 && (
            <tfoot className="bg-neutral-950/90 border-t-2 border-neutral-800 text-xs font-bold">
              <tr>
                <td className="py-4 px-4 text-center">
                  <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                </td>
                <td className="py-4 px-4 text-white uppercase tracking-wider font-mono text-[11px]" colSpan={4}>
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-400">Page Total:</span>
                    <span className="text-purple-300 font-bold font-sans">
                      {documents.length} document{documents.length > 1 ? 's' : ''}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-4 text-right uppercase tracking-wider text-neutral-400 text-[11px]">
                  Total:
                </td>
                <td className="py-4 px-4 text-right font-mono font-black text-sm text-emerald-400">
                  {formatCurrency(
                    documents.reduce((sum, doc) => sum + (Number(doc.amount) || 0), 0)
                  )}
                </td>
                <td className="py-4 px-4" colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
});

DocumentTable.displayName = 'DocumentTable';
