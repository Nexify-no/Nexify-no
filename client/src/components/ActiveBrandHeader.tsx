/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * Which brand am I working in? (PR #84)
 *
 * The brand switcher lives at the BOTTOM of a collapsible sidebar, so on the pages
 * where it matters most — writing and planning content — the answer was off-screen
 * on mobile and easy to miss on desktop. Every acceptance criterion in PR #79 is
 * about content not crossing brands; the user needs to see which one they are in
 * without going looking.
 *
 * Renders nothing when multi-brand is off: with one brand the question does not
 * exist, and a header answering it would be noise.
 */

import { Building2, ChevronRight, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type Props = {
  /** Extra context, e.g. which channel this brand publishes to. */
  subtitle?: string;
  className?: string;
};

export function ActiveBrandHeader({ subtitle, className }: Props) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const flags = trpc.brands.flags.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const enabled = flags.data?.enabled === true;
  const list = trpc.brands.list.useQuery(undefined, { enabled, staleTime: 60 * 1000 });

  const setActive = trpc.brands.setActive.useMutation({
    onSuccess: async () => {
      // Switching brand changes every list and example on the page, so drop the
      // whole cache rather than enumerating what depends on it.
      await utils.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!enabled) return null;

  const brands = list.data?.brands ?? [];
  const active = brands.find((b) => b.id === list.data?.activeBrandId) ?? brands[0];

  return (
    <div
      className={cn(
        "mb-5 flex items-center gap-3 rounded-xl border bg-muted/30 px-3.5 py-2.5",
        className,
      )}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10">
        {list.isLoading
          ? <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
          : <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
          Du jobber i
        </span>
        <span className="block truncate text-sm font-semibold">
          {list.isLoading ? "Laster …" : active?.name ?? "Ingen merkevare"}
        </span>
        {subtitle && (
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        )}
      </span>
      {/* Actually switches brand. The first version navigated to the channels page
          instead — so a user reading "Du jobber i Ballong" who wanted Penna clicked
          the one available control and landed somewhere that switches nothing.
          Only rendered when there is somewhere to switch TO. */}
      {brands.length > 1 && (
        <select
          aria-label="Bytt merkevare"
          value={active?.id ?? ""}
          disabled={setActive.isPending}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (!next || next === active?.id) return;
            setActive.mutate({ brandId: next });
          }}
          className="shrink-0 rounded-md border bg-background px-2 py-1.5 text-xs font-medium disabled:opacity-60"
        >
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      )}
      <button
        type="button"
        aria-label="Se kanaler for denne merkevaren"
        onClick={() => setLocation("/settings/platforms")}
        className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground"
      >
        Kanaler
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}
