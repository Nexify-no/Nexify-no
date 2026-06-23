/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('empty-state', className)}>
      {icon && <div className="empty-state-icon">{icon}</div>}
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-description">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

interface EmptyStateWithImageProps extends EmptyStateProps {
  image?: string;
  imageAlt?: string;
  illustration?: "posts" | "dashboard" | "calendar" | "content";
}

export function EmptyStateWithImage({
  image,
  imageAlt,
  icon,
  title,
  description,
  action,
  className,
  illustration,
}: EmptyStateWithImageProps) {
  const illustrationMap: Record<string, string> = {
    posts: "/empty-state-posts.svg",
    dashboard: "/empty-state-dashboard.svg",
    calendar: "/empty-state-calendar.svg",
    content: "/hero-content-generation.svg",
  };

  const illustrationPath = illustration ? illustrationMap[illustration] : null;
  const imagePath = illustrationPath || image;

  return (
    <div className={cn('empty-state', className)}>
      {imagePath && (
        <img
          src={imagePath}
          alt={imageAlt || title}
          className="w-48 h-48 mb-4 object-contain"
        />
      )}
      {icon && !imagePath && <div className="empty-state-icon">{icon}</div>}
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-description">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}