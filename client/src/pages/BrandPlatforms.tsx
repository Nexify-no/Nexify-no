/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * Publish destinations for the ACTIVE brand (PR #82).
 *
 * Everything here is scoped to one brand on purpose. "Which accounts is Penna
 * connected to?" is a different question from "which accounts does this login
 * own", and answering the second one is how a Penna post went out through
 * Ballong's LinkedIn.
 *
 * It also carries the one-time job of assigning a pre-multi-brand LinkedIn
 * connection to the brand it actually belongs to. That mapping is never guessed:
 * an account with several brands gets `needs_brand_assignment` and the user
 * decides.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, BadgeCheck, Building2, Link2, Loader2, Plug } from "lucide-react";
import { toast } from "sonner";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

const PLATFORM_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "X",
};

export default function BrandPlatforms() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const flags = trpc.brands.flags.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const enabled = flags.data?.enabled === true;

  const destinations = trpc.social.destinations.useQuery(undefined, { enabled });
  const unassigned = trpc.social.unassigned.useQuery(undefined, { enabled });
  const brands = trpc.brands.list.useQuery(undefined, { enabled });

  const [assigning, setAssigning] = useState<number | null>(null);
  const [choice, setChoice] = useState<Record<number, number>>({});

  const assign = trpc.social.assignBrand.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      setAssigning(null);
      toast.success("Tilkoblingen er tilordnet merkevaren");
    },
    onError: (e) => { setAssigning(null); toast.error(e.message); },
  });

  if (!enabled) {
    return (
      <main className="container max-w-3xl py-8">
        <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Kanaler", current: true }]} />
        <p className="mt-6 text-sm text-muted-foreground">
          Flere merkevarer er ikke aktivert for denne kontoen.
        </p>
      </main>
    );
  }

  const rows = destinations.data?.platforms ?? [];
  const brandName = destinations.data?.brandName ?? "";
  const legacy = unassigned.data ?? [];
  const activeBrands = brands.data?.brands ?? [];

  return (
    <main className="container max-w-3xl py-6 sm:py-8">
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Kanaler", current: true }]} className="mb-2" />

      <div className="mt-4 mb-6 flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10">
          <Plug className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight">Kanaler</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {brandName
              ? <>Hvor <span className="font-medium text-foreground">{brandName}</span> publiserer. Bytt merkevare i menyen for å se en annen.</>
              : "Hvor denne merkevaren publiserer."}
          </p>
        </div>
      </div>

      {/* ── Legacy connection that could not be mapped safely ───────────────── */}
      {legacy.length > 0 && (
        <Card className="mb-6 border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
              Tilkobling uten merkevare
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Denne kontoen ble koblet til før du hadde flere merkevarer, så vi vet ikke hvilken den
              tilhører — og vi gjetter ikke. Velg merkevaren den skal publisere for.
            </p>
            {legacy.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl border bg-background p-3">
                <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                  <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="font-medium">{PLATFORM_LABEL[c.platform] ?? c.platform}</span>
                  {c.destinationName && (
                    <span className="truncate text-muted-foreground">— {c.destinationName}</span>
                  )}
                </span>
                <select
                  // No placeholder value: while brands.list loads there is no
                  // matching <option>, and Tilordne then silently did nothing.
                  value={choice[c.id] ?? activeBrands[0]?.id ?? ""}
                  onChange={(e) => setChoice((prev) => ({ ...prev, [c.id]: Number(e.target.value) }))}
                  disabled={assigning === c.id}
                  className="rounded-md border bg-background px-2 py-1.5 text-sm disabled:opacity-60"
                  aria-label="Velg merkevare"
                >
                  {activeBrands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={assigning === c.id || activeBrands.length === 0 || brands.isLoading}
                  onClick={() => {
                    const brandId = choice[c.id] ?? activeBrands[0]?.id;
                    if (!brandId) return;
                    setAssigning(c.id);
                    assign.mutate({ connectionId: c.id, brandId });
                  }}
                >
                  {assigning === c.id
                    ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />Tilordner …</>
                    : "Tilordne"}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── The active brand's destinations ─────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Kanaler for denne merkevaren
          </CardTitle>
        </CardHeader>
        <CardContent>
          {destinations.isLoading && (
            <div className="grid place-items-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            </div>
          )}

          {destinations.isError && (
            <div className="rounded-xl border border-destructive/40 p-4 text-sm">
              <p className="text-muted-foreground">Kunne ikke laste kanalene.</p>
              <button
                type="button"
                onClick={() => destinations.refetch()}
                className="mt-2 font-medium underline underline-offset-2"
              >
                Prøv igjen
              </button>
            </div>
          )}

          {!destinations.isLoading && !destinations.isError && (
            <ul className="divide-y">
              {rows.map((p) => (
                <li key={p.platform} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{PLATFORM_LABEL[p.platform] ?? p.platform}</span>
                    <span className="block text-xs text-muted-foreground">
                      {p.connected
                        ? <>Publiseres som {p.destinationName || "ukjent side"}</>
                        : p.status === "needs_brand_assignment"
                          ? "Venter på at du velger merkevare"
                          : "Ingen konto koblet til"}
                    </span>
                  </span>
                  {p.connected ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-400">
                      <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      Tilkoblet
                    </span>
                  ) : (
                    // One clear action, every time. An unconnected channel used to
                    // show nothing at all, so there was no way to find out how to
                    // fix it from the page that told you it was broken.
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLocation("/settings")}
                    >
                      Koble til konto
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        Et innlegg kan bare publiseres gjennom en kanal som tilhører samme merkevare. Uten en
        tilkoblet kanal kan du fortsatt lage og lagre innlegg, men ikke publisere eller planlegge dem.
      </p>
    </main>
  );
}
