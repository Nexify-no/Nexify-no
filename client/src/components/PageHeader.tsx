/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PageHeaderProps {
  title: string;
  description: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="flex items-center gap-1 mb-3 sm:mb-4 lg:mb-6">
      <h1 className="text-base sm:text-lg md:text-2xl lg:text-3xl font-bold truncate flex-1">{title}</h1>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
              <HelpCircle className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-sm">
            <p>{description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}