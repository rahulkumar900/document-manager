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
    <div className="w-full h-auto bg-card border border-border rounded-3xl shadow-xl mb-8 relative overflow-hidden">
      {/* 1. Mobile Optimized Card List View (< sm screens) */}
      <div className="block sm:hidden divide-y divide-border/80">
        {/* Mobile Page Select All Header */}
        <div className="p-3.5 bg-muted/50 flex items-center justify-between border-b border-border text-xs">
          <button
            type="button"
            onClick={onToggleSelectPage}
            className="flex items-center gap-2 text-foreground font-semibold active:scale-95 transition-transform cursor-pointer"
          >
            <div
              className={`w-4 h-4 rounded-md flex items-center justify-center transition-all border ${
                isAllPageSelected && documents.length > 0
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'bg-background border-input text-transparent'
              }`}
            >
              <Icons.Check className="w-3 h-3 stroke-[3]" />
            </div>
            <span>{isAllPageSelected ? 'Deselect Page' : 'Select All Page'}</span>
          </button>
          <span className="text-[11px] font-mono text-muted-foreground">
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
              className={`p-4 transition-colors cursor-pointer active:bg-accent/60 relative ${
                isSelected ? 'bg-primary/10' : 'hover:bg-muted/40'
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
                        ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                        : 'bg-background border-input text-transparent'
                    }`}
                    aria-label={`Select document ${doc.invoiceNumber}`}
                  >
                    <Icons.Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-foreground truncate">{doc.vendorName}</h4>
                      <span
                        className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          doc.type === 'Invoice'
                            ? 'bg-secondary text-secondary-foreground border-border'
                            : doc.type === 'Challan'
                            ? 'bg-secondary text-secondary-foreground border-border'
                            : doc.type === 'Credit Note'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                        }`}
                      >
                        {doc.type}
                      </span>
                    </div>

                    <div className="text-xs font-mono text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                      <span className="text-foreground font-semibold">{doc.invoiceNumber}</span>
                      <span>•</span>
                      <span>{formatDate(doc.date)}</span>
                    </div>

                    <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                      <Icons.Building className="w-3 h-3 text-muted-foreground shrink-0" />
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
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
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
          <div className="p-4 bg-muted/20 border-t border-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
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
            <tr className="bg-muted/40 border-b border-border text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              <th className="py-4 px-4 w-10 text-center">
                <button
                  type="button"
                  onClick={onToggleSelectPage}
                  className={`w-4 h-4 rounded-md flex items-center justify-center transition-all border ${
                    isAllPageSelected && documents.length > 0
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-background border-input hover:border-muted-foreground text-transparent'
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
          <tbody className="divide-y divide-border font-medium h-auto">
            {documents.map((doc) => {
              const site = siteMap.get(doc.siteId);
              const isSelected = selectedDocIds.has(doc.id);

              return (
                <tr
                  key={doc.id}
                  className={`transition-colors group cursor-pointer relative hover:z-20 ${
                    isSelected
                      ? 'bg-accent/40 hover:bg-accent/60'
                      : 'hover:bg-muted/40'
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
                          ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                          : 'bg-background border-input hover:border-muted-foreground text-transparent'
                      }`}
                      aria-label={`Select document ${doc.invoiceNumber}`}
                    >
                      <Icons.Check className="w-3 h-3 stroke-[3]" />
                    </button>
                  </td>

                  <td className="py-4 px-4">
                    <div className="font-bold text-foreground group-hover:text-primary transition-colors">
                      {doc.vendorName}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      By {doc.uploadedBy}
                    </div>
                  </td>

                  <td className="py-4 px-4 font-mono text-foreground">
                    <div className="flex items-center gap-1.5">
                      <span>{doc.invoiceNumber}</span>
                      {doc.fileUrl && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400" title="Cloud File Uploaded" />
                      )}
                    </div>
                  </td>

                  <td className="py-4 px-4">
                    <div className="text-foreground font-semibold">{site?.name || 'Unassigned'}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{site?.code || 'SITE'}</div>
                  </td>

                  <td className="py-4 px-4 font-mono text-muted-foreground">
                    {formatDate(doc.date)}
                  </td>

                  <td className="py-4 px-4">
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
                  </td>

                  <td className="py-4 px-4 text-right font-mono font-bold text-foreground">
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
            <tfoot className="bg-muted/40 border-t-2 border-border text-xs font-bold">
              <tr>
                <td className="py-4 px-4 text-center">
                  <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                </td>
                <td className="py-4 px-4 text-foreground uppercase tracking-wider font-mono text-[11px]" colSpan={4}>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Page Total:</span>
                    <span className="text-foreground font-bold font-sans">
                      {documents.length} document{documents.length > 1 ? 's' : ''}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-4 text-right uppercase tracking-wider text-muted-foreground text-[11px]">
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
