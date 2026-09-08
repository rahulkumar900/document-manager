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
            ? 'bg-secondary text-foreground border-border shadow-md ring-1 ring-ring'
            : 'bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border-border'
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
            className="w-52 bg-popover text-popover-foreground backdrop-blur-2xl border border-border rounded-2xl shadow-2xl p-1.5 z-[9999] animate-in fade-in zoom-in-95 duration-100 divide-y divide-border"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Main Actions */}
            <div className="space-y-0.5 pb-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onPreview(doc.id);
                }}
                className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent hover:text-accent-foreground rounded-xl transition-colors cursor-pointer"
              >
                <Icons.Eye className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Preview File</span>
              </button>

              {canModify && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onEdit(doc);
                  }}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent hover:text-accent-foreground rounded-xl transition-colors cursor-pointer"
                >
                  <Icons.Edit className="w-3.5 h-3.5 text-primary" />
                  <span>Edit Details</span>
                </button>
              )}

              {canVerify && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onVerify(doc.id);
                  }}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-xl transition-colors cursor-pointer"
                >
                  <Icons.Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                  <span>Verify Document</span>
                </button>
              )}

              {fileSource && (
                <a
                  href={fileSource}
                  download={doc.fileName || `${doc.invoiceNumber}.pdf`}
                  onClick={() => setIsOpen(false)}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent hover:text-accent-foreground rounded-xl transition-colors cursor-pointer"
                >
                  <Icons.Download className="w-3.5 h-3.5 text-muted-foreground" />
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
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-xl transition-colors cursor-pointer"
                >
                  <Icons.Trash className="w-3.5 h-3.5 text-destructive" />
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
