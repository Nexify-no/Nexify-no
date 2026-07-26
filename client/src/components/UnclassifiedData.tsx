/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * "Uklassifisert" — the recovery surface for brand-less legacy data (PR #79).
 *
 * Brand-scoped reads no longer fall back to `OR brand_id IS NULL`, because that
 * fallback showed one brand's content inside every other brand. The trade-off
 * is that a row with no owner is now invisible everywhere — so it needs exactly
 * one place where the user can see it and say which brand it belongs to. This
 * is that place.
 *
 * Renders nothing when multi-brand is off or when the account has no unowned
 * rows, which is the normal case: accounts with a single brand had their legacy
 * data adopted automatically by migration 0092.
 */

import { useState } from "react";
import { FileQuestion, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export function UnclassifiedData() {
  const utils = trpc.useUtils();
  const flags = trpc.brands.flags.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const enabled = flags.data?.enabled === true;

  const list = trpc.brands.list.useQuery(undefined, { enabled, staleTime: 60 * 1000 });
  const unclassified = trpc.brands.unclassified.useQuery(undefined, { enabled, staleTime: 60 * 1000 });

  const [target, setTarget] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const classify = trpc.brands.classify.useMutation({
    onSuccess: async (res) => {
      // The rows move into a brand, so every cached list is now stale.
      await utils.invalidate();
      setBusy(false);
      toast.success(
        res.assigned === 0
          ? "Ingenting å flytte."
          : `${res.assigned} element${res.assigned === 1 ? "" : "er"} tilordnet merkevaren.`,
      );
    },
    onError: (e) => { setBusy(false); toast.error(e.message); },
  });

  if (!enabled) return null;
  // A failed count must not block the page — the data is still safe, just unshown.
  if (unclassified.isError || !unclassified.data || unclassified.data.total === 0) return null;
  if (!list.data || list.data.brands.length === 0) return null;

  const { brands, activeBrandId } = list.data;
  const chosen = target ?? activeBrandId ?? brands[0].id;
  const items = unclassified.data.items.filter((i) => i.count > 0);

  return (
    <section
      className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4"
      aria-labelledby="uklassifisert-heading"
    >
      <div className="flex items-start gap-3">
        <FileQuestion className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id="uklassifisert-heading" className="text-sm font-semibold">
            Uklassifisert innhold
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {unclassified.data.total} element
            {unclassified.data.total === 1 ? "" : "er"} ble laget før du hadde flere merkevarer, så
            vi vet ikke hvem de tilhører. De vises ikke under noen merkevare før du velger én — vi
            gjetter aldri.
          </p>

          <ul className="mt-3 flex flex-wrap gap-2">
            {items.map((i) => (
              <li
                key={i.key}
                className="rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground"
              >
                {i.label}: <span className="font-medium text-foreground">{i.count}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label htmlFor="uklassifisert-brand" className="text-sm text-muted-foreground">
              Tilordne til
            </label>
            <select
              id="uklassifisert-brand"
              value={chosen}
              onChange={(e) => setTarget(Number(e.target.value))}
              disabled={busy}
              className="rounded-md border bg-background px-2 py-1.5 text-sm disabled:opacity-60"
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy}
              onClick={() => { setBusy(true); classify.mutate({ brandId: chosen }); }}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Tilordne
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
