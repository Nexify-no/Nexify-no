/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import React from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SuccessStateProps {
  title?: string;
  description?: string;
  onDismiss?: () => void;
  onAction?: () => void;
  actionLabel?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function SuccessState({
  title = 'Suksess!',
  description = 'Operasjonen ble fullført',
  onDismiss,
  onAction,
  actionLabel = 'Fortsett',
  icon,
  className = '',
}: SuccessStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}
    >
      <div className="text-green-500 mb-4">
        {icon || <CheckCircle className="h-16 w-16" />}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-center mb-6 max-w-md">
        {description}
      </p>
      <div className="flex gap-3">
        {onDismiss && (
          <Button onClick={onDismiss} variant="outline">
            Lukk
          </Button>
        )}
        {onAction && (
          <Button onClick={onAction} className="bg-green-500 hover:bg-green-600">
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}