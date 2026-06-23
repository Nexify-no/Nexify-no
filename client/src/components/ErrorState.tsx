/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export function ErrorState({
  title = 'Noe gikk galt',
  description = 'Vennligst prøv igjen senere',
  onRetry,
  icon,
  className = '',
}: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}
    >
      <div className="text-destructive mb-4">
        {icon || <AlertCircle className="h-16 w-16" />}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-center mb-6 max-w-md">
        {description}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          Prøv igjen
        </Button>
      )}
    </div>
  );
}