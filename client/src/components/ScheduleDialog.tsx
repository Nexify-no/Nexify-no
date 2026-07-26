/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

// Schedule a saved post (MB4). Shows date, time, timezone, platform and the
// brand's publish destination plus a preview, then writes a real scheduled_posts
// row so the post appears in the calendar immediately.

import { useEffect, useState } from "react";
import { CalendarClock, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

type Props = {
  open: boolean;
  onClose: () => void;
  postId: number | null;
  platform: "linkedin" | "twitter" | "instagram" | "facebook";
  content: string;
  imageUrl?: string | null;
  /** Pre-selected date (e.g. clicked in the calendar), ISO or yyyy-mm-dd. */
  defaultDate?: string | null;
  onScheduled?: () => void;
};

const pad = (n: number) => String(n).padStart(2, "0");

export function ScheduleDialog({ open, onClose, postId, platform, content, imageUrl, defaultDate, onScheduled }: Props) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Oslo";
  const initial = defaultDate ? new Date(defaultDate) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const [date, setDate] = useState(isoDate(initial));
  const [time, setTime] = useState("09:00");

  // PR #81: the dialog stays mounted between openings (it just renders null), so
  // useState's initial values are only ever read once. Without this reset:
  //
  //  - clicking a second date in /kalender reopened the dialog still showing the
  //    FIRST date, and confirming scheduled the post to the wrong day;
  //  - on /innlegg, where there is no defaultDate at all, the date and time the
  //    user typed for draft A were still there for draft B — one click put B on
  //    A's date. An early-return on a missing defaultDate would have left exactly
  //    that case broken, so the fallback is the explicit default instead.
  useEffect(() => {
    if (!open) return;
    const d = defaultDate ? new Date(defaultDate) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    setDate(isoDate(Number.isNaN(d.getTime()) ? new Date(Date.now() + 24 * 60 * 60 * 1000) : d));
    setTime("09:00");
  }, [open, defaultDate]);

  const utils = trpc.useUtils();
  const flags = trpc.brands.flags.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const multiBrand = flags.data?.enabled === true;
  const dest = trpc.social.destinations.useQuery(undefined, { enabled: open && multiBrand });
  const destination = dest.data?.platforms.find((p) => p.platform === platform);
  // PR #81: name the brand this is scheduled for. Without it the dialog looked
  // identical for Penna and Ballong, so there was nothing to catch a mis-click
  // before the post went into the wrong brand's calendar.
  const brands = trpc.brands.list.useQuery(undefined, { enabled: open && multiBrand, staleTime: 60 * 1000 });
  const activeBrand = brands.data?.brands.find((b) => b.id === brands.data?.activeBrandId);

  const schedule = trpc.scheduling.schedulePost.useMutation({
    onSuccess: async () => {
      toast.success("Innlegget er planlagt");
      await utils.invalidate();
      onScheduled?.();
      onClose();
    },
    onError: (e) => toast.error(e.message || "Kunne ikke planlegge innlegget"),
  });

  if (!open) return null;

  const when = new Date(`${date}T${time}:00`);
  const valid = postId != null && !Number.isNaN(when.getTime()) && when.getTime() > Date.now();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-background border shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-base font-semibold flex items-center gap-2"><CalendarClock className="h-4 w-4" />Planlegg innlegg</h2>
          <button type="button" onClick={onClose} aria-label="Lukk" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Dato</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Klokkeslett</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
            </label>
          </div>

          <dl className="rounded-xl border divide-y text-sm">
            {activeBrand && (
              <div className="flex justify-between gap-3 px-3 py-2">
                <dt className="text-muted-foreground">Merkevare</dt>
                <dd className="font-medium truncate">{activeBrand.name}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3 px-3 py-2">
              <dt className="text-muted-foreground">Tidssone</dt><dd className="font-medium">{tz}</dd>
            </div>
            <div className="flex justify-between gap-3 px-3 py-2">
              <dt className="text-muted-foreground">Plattform</dt><dd className="font-medium capitalize">{platform}</dd>
            </div>
            {dest.data && (
              <div className="flex justify-between gap-3 px-3 py-2">
                <dt className="text-muted-foreground">Publiseres som</dt>
                <dd className="font-medium truncate">
                  {destination?.connected ? (destination.destinationName || "Ukjent side") : <span className="text-amber-600">Ikke tilkoblet</span>}
                </dd>
              </div>
            )}
          </dl>

          {imageUrl && <img src={imageUrl} alt="" className="w-full rounded-xl border" />}
          <p className="whitespace-pre-wrap rounded-xl border bg-muted/30 p-3 text-sm leading-relaxed max-h-40 overflow-y-auto">{content}</p>

          {postId == null && (
            <p className="text-xs text-amber-600">Lagre innlegget først — da kan du planlegge det.</p>
          )}
          {!Number.isNaN(when.getTime()) && when.getTime() <= Date.now() && (
            <p className="text-xs text-amber-600">Velg et tidspunkt fram i tid.</p>
          )}
        </div>

        <div className="border-t px-5 py-3 flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>Avbryt</Button>
          <Button
            disabled={!valid || schedule.isPending}
            onClick={() => postId != null && schedule.mutate({ postId, platform, scheduledFor: when, timezone: tz })}
          >
            {schedule.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Planlegger …</> : "Planlegg"}
          </Button>
        </div>
      </div>
    </div>
  );
}
