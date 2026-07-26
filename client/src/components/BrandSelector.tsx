/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

// Active-brand selector (MB1, behind FEATURE_MULTI_BRAND). Renders nothing when
// the flag is off. Switching brands invalidates EVERY query so no data from the
// previous brand is ever shown, and shows a brandLoading state meanwhile.

import { useState } from "react";
import { AlertTriangle, Building2, Check, ChevronDown, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export function BrandSelector() {
  const utils = trpc.useUtils();
  const flags = trpc.brands.flags.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const enabled = flags.data?.enabled === true;
  const list = trpc.brands.list.useQuery(undefined, { enabled, staleTime: 60 * 1000 });
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const setActive = trpc.brands.setActive.useMutation({
    onSuccess: async () => {
      // Hard isolation: drop every cached query so nothing from the previous
      // brand flashes on screen. Views refetch under the new brand.
      await utils.invalidate();
      setSwitching(false);
      setOpen(false);
    },
    onError: (e) => { setSwitching(false); toast.error(e.message); },
  });
  const create = trpc.brands.create.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      setSwitching(false); setOpen(false); setAdding(false); setNewName("");
      toast.success("Merkevare opprettet");
    },
    onError: (e) => { setSwitching(false); toast.error(e.message); },
  });

  if (!enabled) return null;

  // Feature is on but the list could not be loaded. Rendering nothing here is
  // what made the switcher vanish with no explanation — say so instead, and offer
  // a retry. The message stays generic: server errors are never shown raw.
  if (list.isError) {
    return (
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 px-3 py-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          <span className="flex-1">Kunne ikke laste merkevarer.</span>
          <button
            type="button"
            onClick={() => list.refetch()}
            className="font-medium text-foreground underline underline-offset-2"
          >
            Prøv igjen
          </button>
        </div>
      </div>
    );
  }

  if (list.isLoading) {
    return (
      <div className="px-3 pb-2">
        <div className="h-9 w-full animate-pulse rounded-lg border bg-muted/50" aria-hidden="true" />
      </div>
    );
  }

  if (!list.data) return null;
  const { brands, activeBrandId } = list.data;
  const active = brands.find((b) => b.id === activeBrandId) ?? brands[0];
  if (!active) return null;

  return (
    <div className="relative px-3 pb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
        className="w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm hover:border-primary/50 disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 truncate">
          {switching ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <span className="truncate font-medium">{active.name}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && !switching && (
        <div className="absolute left-3 right-3 z-50 mt-1 rounded-lg border bg-background shadow-md p-1" role="listbox">
          {brands.map((b) => (
            <button
              key={b.id}
              type="button"
              role="option"
              aria-selected={b.id === activeBrandId}
              onClick={() => {
                if (b.id === activeBrandId) { setOpen(false); return; }
                setSwitching(true);
                setActive.mutate({ brandId: b.id });
              }}
              className="w-full flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-muted text-left"
            >
              <span className="truncate">{b.name}</span>
              {b.id === activeBrandId && <Check className="h-4 w-4 text-primary shrink-0" />}
            </button>
          ))}
          <div className="border-t mt-1 pt-1">
            {adding ? (
              <form
                className="flex items-center gap-1 p-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newName.trim();
                  if (!name) return;
                  setSwitching(true);
                  create.mutate({ name });
                }}
              >
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Navn på merkevaren"
                  className="flex-1 min-w-0 rounded-md border px-2 py-1.5 text-sm bg-background"
                />
                <button type="submit" className="rounded-md border px-2 py-1.5 text-sm hover:bg-muted" aria-label="Legg til">
                  <Plus className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                <Plus className="h-4 w-4" />
                Legg til merkevare
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
