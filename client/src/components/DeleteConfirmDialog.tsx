/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  itemName?: string;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

export function DeleteConfirmDialog({
  isOpen,
  title,
  description,
  itemName,
  isLoading = false,
  onConfirm,
  onCancel,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  isDangerous = true,
}: DeleteConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            {isDangerous && (
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
            )}
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="mt-2">
            {description}
            {itemName && (
              <div className="mt-2 p-2 bg-muted rounded text-foreground font-medium">
                {itemName}
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex gap-3 justify-end">
          <AlertDialogCancel onClick={onCancel} disabled={isConfirming || isLoading}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isConfirming || isLoading}
            className={isDangerous ? 'bg-destructive hover:bg-destructive/90' : ''}
          >
            {isConfirming || isLoading ? (
              <>
                <span className="inline-block animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                {confirmText}ing...
              </>
            ) : (
              confirmText
            )}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Hook for managing delete confirmation state
 */
export function useDeleteConfirm() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<Partial<DeleteConfirmDialogProps>>({});

  const openDeleteConfirm = (
    confirmConfig: Omit<DeleteConfirmDialogProps, 'isOpen' | 'onCancel'>
  ) => {
    setConfig(confirmConfig);
    setIsOpen(true);
  };

  const closeDeleteConfirm = () => {
    setIsOpen(false);
  };

  return {
    isOpen,
    config,
    openDeleteConfirm,
    closeDeleteConfirm,
  };
}