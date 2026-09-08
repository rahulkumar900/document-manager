'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DocumentRecord, UserAccount } from '@/lib/types';
import { Icons } from '../ui/icons';

interface DocumentActionMenuProps {
  document: DocumentRecord;
  currentUser: UserAccount;
  onPreview: (docId: string) => void;
  onVerify: (docId: string) => void;
  onEdit: (doc: DocumentRecord) => void;
  onDelete: (doc: DocumentRecord) => void;
  align?: 'left' | 'right';
}

export const DocumentActionMenu: React.FC<DocumentActionMenuProps> = ({
  document: doc,
  currentUser,
  onPreview,
  onVerify,
  onEdit,
  onDelete,
  align = 'right',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; left?: number; right?: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isVerifier = currentUser.role === 'Checker' || currentUser.role === 'Admin';
  const canModify = currentUser.role === 'Admin' || currentUser.role === 'Site Accountant';
  const canVerify = isVerifier && doc.status === 'uploaded';
  const fileSource = doc.fileUrl || doc.fileData;

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < 240;

      const newCoords: { top?: number; bottom?: number; left?: number; right?: number } = {};

      if (openUpward) {
        newCoords.bottom = window.innerHeight - rect.top + 6;
      } else {
        newCoords.top = rect.bottom + 6;
      }

      if (align === 'right') {
        newCoords.right = window.innerWidth - rect.right;
      } else {
        newCoords.left = rect.left;
      }

      setCoords(newCoords);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      if (isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-label="Open Actions Menu"
        aria-expanded={isOpen}
        className={`p-2 rounded-xl transition-all border ${
          isOpen
            ? 'bg-neutral-800 text-white border-neutral-700 shadow-md ring-2 ring-purple-500/50'
            : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white border-neutral-800 hover:border-neutral-700'
        }`}
      >
        <Icons.MoreVertical className="w-4 h-4" />
      </button>

      {isOpen &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: coords.top !== undefined ? `${coords.top}px` : 'auto',
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : 'auto',
              left: coords.left !== undefined ? `${coords.left}px` : 'auto',
              right: coords.right !== undefined ? `${coords.right}px` : 'auto',
            }}
            className="w-52 bg-neutral-900/98 backdrop-blur-2xl border border-neutral-700/90 rounded-2xl shadow-2xl shadow-black p-1.5 z-[9999] animate-in fade-in zoom-in-95 duration-100 divide-y divide-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Main Actions */}
            <div className="space-y-0.5 pb-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onPreview(doc.id);
                }}
                className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-neutral-200 hover:text-white hover:bg-neutral-800/80 rounded-xl transition-colors"
              >
                <Icons.Eye className="w-3.5 h-3.5 text-neutral-400" />
                <span>Preview File</span>
              </button>

              {canModify && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onEdit(doc);
                  }}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-neutral-200 hover:text-white hover:bg-neutral-800/80 rounded-xl transition-colors"
                >
                  <Icons.Edit className="w-3.5 h-3.5 text-purple-400" />
                  <span>Edit Details</span>
                </button>
              )}

              {canVerify && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onVerify(doc.id);
                  }}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-emerald-300 hover:text-emerald-200 hover:bg-emerald-950/60 rounded-xl transition-colors"
                >
                  <Icons.Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                  <span>Verify Document</span>
                </button>
              )}

              {fileSource && (
                <a
                  href={fileSource}
                  download={doc.fileName || `${doc.invoiceNumber}.pdf`}
                  onClick={() => setIsOpen(false)}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800/80 rounded-xl transition-colors"
                >
                  <Icons.Download className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Download File</span>
                </a>
              )}
            </div>

            {/* Destructive Actions */}
            {canModify && (
              <div className="pt-1">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onDelete(doc);
                  }}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 rounded-xl transition-colors"
                >
                  <Icons.Trash className="w-3.5 h-3.5 text-rose-400" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
};
