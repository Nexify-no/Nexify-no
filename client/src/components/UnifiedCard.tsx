/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface UnifiedCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'interactive' | 'gradient';
  padding?: 'compact' | 'standard' | 'spacious';
  onClick?: () => void;
}

export function UnifiedCard({
  children,
  className,
  variant = 'default',
  padding = 'standard',
  onClick,
}: UnifiedCardProps) {
  const paddingClasses = {
    compact: 'p-3',
    standard: 'p-4',
    spacious: 'p-6',
  };

  const variantClasses = {
    default: 'card-base',
    elevated: 'card-elevated',
    interactive: 'card-interactive',
    gradient: 'card-base bg-gradient-to-br from-primary/5 to-primary/10',
  };

  return (
    <div
      className={cn(
        variantClasses[variant],
        paddingClasses[padding],
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

interface UnifiedCardHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function UnifiedCardHeader({
  title,
  description,
  icon,
  action,
}: UnifiedCardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-start gap-3 flex-1">
        {icon && <div className="flex-shrink-0">{icon}</div>}
        <div className="flex-1 min-w-0">
          <h3 className="heading-5 truncate">{title}</h3>
          {description && <p className="body-sm mt-1">{description}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

interface UnifiedCardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function UnifiedCardContent({
  children,
  className,
}: UnifiedCardContentProps) {
  return <div className={cn('space-y-4', className)}>{children}</div>;
}

interface UnifiedCardFooterProps {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right' | 'between';
}

export function UnifiedCardFooter({
  children,
  className,
  align = 'between',
}: UnifiedCardFooterProps) {
  const alignClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 mt-4 pt-4 border-t border-border',
        alignClasses[align],
        className
      )}
    >
      {children}
    </div>
  );
}