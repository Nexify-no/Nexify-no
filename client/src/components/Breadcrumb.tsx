/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import React from 'react';
import { Link } from 'wouter';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1.5 text-xs ${className}`}
    >
      <ol className="flex items-center gap-1.5">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1.5">
            {item.href && !item.current ? (
              <Link href={item.href}>
                <span className="text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer">
                  {item.label}
                </span>
              </Link>
            ) : (
              <span
                className={
                  item.current
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground'
                }
              >
                {item.label}
              </span>
            )}
            {index < items.length - 1 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}