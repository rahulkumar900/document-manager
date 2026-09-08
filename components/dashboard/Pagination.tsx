import React from 'react';
import { Icons } from '../ui/icons';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  totalAmount?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  totalAmount,
  onPageChange,
  onPageSizeChange,
}) => {
  if (totalItems === 0) return null;

  const startIdx = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endIdx = Math.min(currentPage * pageSize, totalItems);

  // Calculate visible page range (with smart ellipsis)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="bg-neutral-900/90 border border-neutral-800/80 rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl mt-6">
      {/* Left: Range, Document Count & Total Amount */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400">
        <div className="font-mono">
          Showing <span className="text-white font-bold">{startIdx}</span> -{' '}
          <span className="text-white font-bold">{endIdx}</span> of{' '}
          <span className="text-white font-bold">{totalItems}</span> documents
        </div>

        {totalAmount !== undefined && (
          <div className="flex items-center gap-1.5 pl-3 border-l border-neutral-800 font-mono">
            <span className="text-neutral-400 text-[11px] uppercase font-bold">Total:</span>
            <span className="text-emerald-400 font-black text-xs">
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalAmount)}
            </span>
          </div>
        )}

        {/* Rows per page selector */}
        {onPageSizeChange && (
          <div className="flex items-center gap-2 pl-3 border-l border-neutral-800">
            <span className="text-neutral-400 text-[11px]">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-neutral-950 border border-neutral-800 text-white rounded-xl px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-neutral-600 transition-colors"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        )}
      </div>

      {/* Right: Pagination Navigation Controls */}
      <div className="flex items-center space-x-1 sm:space-x-1.5">
        {/* First Page Button (Desktop) */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="hidden sm:inline-flex p-2 sm:p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
          title="First Page"
        >
          <Icons.ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Previous Page Button */}
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="p-2 sm:p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
          title="Previous Page"
        >
          <Icons.ChevronLeft className="w-4 h-4" />
        </button>

        {/* Compact Mobile Page Indicator */}
        <div className="sm:hidden px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs font-mono font-bold text-white">
          <span>{currentPage}</span>
          <span className="text-neutral-500 mx-1">/</span>
          <span className="text-neutral-400">{totalPages}</span>
        </div>

        {/* Numeric Page Buttons (Tablet & Desktop) */}
        <div className="hidden sm:flex items-center space-x-1">
          {getPageNumbers().map((pageItem, idx) => {
            if (pageItem === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-7 sm:w-9 h-7 sm:h-9 flex items-center justify-center text-neutral-600 text-xs font-mono"
                >
                  ...
                </span>
              );
            }

            const pageNum = Number(pageItem);
            const isActive = currentPage === pageNum;

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`w-8 sm:w-9 h-8 sm:h-9 rounded-xl text-xs font-bold font-mono transition-all ${
                  isActive
                    ? 'bg-white text-neutral-950 shadow-lg shadow-white/5 font-black scale-105'
                    : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next Page Button */}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="p-2 sm:p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
          title="Next Page"
        >
          <Icons.ChevronRight className="w-4 h-4" />
        </button>

        {/* Last Page Button (Desktop) */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          className="hidden sm:inline-flex p-2 sm:p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
          title="Last Page"
        >
          <Icons.ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
