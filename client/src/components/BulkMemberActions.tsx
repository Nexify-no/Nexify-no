/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Bulk actions on selected members.
 *
 * All three buttons used to lie. Each case in the confirm handler was a `// TODO`
 * followed by a success toast:
 *
 *     case "notification":
 *       // TODO: Call bulk notification API
 *       toast.success(`Notification sent to ${selectedCount} members`);
 *
 * An admin selected 200 members, wrote a message, pressed Confirm, and was told
 * it had been delivered. Nothing was sent, no role changed, nobody was suspended.
 * The component was not even given the selected ids — only a count — so it could
 * not have acted on them if it had wanted to.
 *
 * Now it takes `selectedIds` and calls real procedures, and it reports what the
 * server actually did: how many were changed, and which ones were refused and
 * why (the last administrator, yourself, a customer who opted out of email).
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Mail, Shield, Ban } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface BulkMemberActionsProps {
  selectedIds: number[];
  onSelectAll: (checked: boolean) => void;
  isAllSelected: boolean;
  onDone?: () => void;
}

type ActionType = "notification" | "role" | "suspend" | null;

/** Turn the server's per-user refusals into one readable line. */
function reportSkipped(skipped: Array<{ email: string; reason: string }>) {
  if (skipped.length === 0) return;
  const head = skipped
    .slice(0, 3)
    .map((s) => `${s.email} (${s.reason})`)
    .join(", ");
  const more = skipped.length > 3 ? ` +${skipped.length - 3} til` : "";
  toast.warning(`${skipped.length} ble hoppet over: ${head}${more}`);
}

export function BulkMemberActions({
  selectedIds,
  onSelectAll,
  isAllSelected,
  onDone,
}: BulkMemberActionsProps) {
  const [actionType, setActionType] = useState<ActionType>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [suspendReason, setSuspendReason] = useState("");

  const selectedCount = selectedIds.length;

  // Tells the compose dialog how many of the selected members will actually be
  // reached, and whether email is configured at all — before anything is typed.
  const audience = trpc.admin.previewEmailAudience.useQuery(
    { userIds: selectedIds },
    { enabled: isDialogOpen && actionType === "notification" && selectedCount > 0 }
  );

  const close = () => {
    setIsDialogOpen(false);
    setActionType(null);
    setSubject("");
    setNotificationMessage("");
    setSuspendReason("");
    setNewRole("user");
    onDone?.();
  };

  const sendEmail = trpc.admin.sendEmail.useMutation({
    onSuccess: (r) => {
      // The exact counts, not "sent to N members". A skip and a failure are not
      // the same thing as a delivery, and the admin needs to know which happened.
      toast.success(`Sendt: ${r.sent} · Feilet: ${r.failed} · Hoppet over: ${r.skipped}`);
      if (r.skipped > 0) {
        toast.info("Hoppet over = brukeren har slått av e-postvarsler, eller mangler adresse.");
      }
      close();
    },
    onError: (e) => toast.error(e.message || "Kunne ikke sende e-post"),
  });

  const setRole = trpc.admin.bulkSetRole.useMutation({
    onSuccess: (r) => {
      toast.success(`${r.updated} bruker(e) fikk rollen ${newRole}`);
      reportSkipped(r.skipped);
      close();
    },
    onError: (e) => toast.error(e.message || "Kunne ikke oppdatere roller"),
  });

  const setStatus = trpc.admin.bulkSetStatus.useMutation({
    onSuccess: (r) => {
      toast.success(`${r.updated} konto(er) sperret`);
      reportSkipped(r.skipped);
      close();
    },
    onError: (e) => toast.error(e.message || "Kunne ikke sperre kontoer"),
  });

  const isProcessing = sendEmail.isPending || setRole.isPending || setStatus.isPending;

  const handleConfirm = () => {
    switch (actionType) {
      case "notification":
        if (!subject.trim()) return toast.error("Skriv et emne");
        if (!notificationMessage.trim()) return toast.error("Skriv en melding");
        sendEmail.mutate({
          userIds: selectedIds,
          subject: subject.trim(),
          body: notificationMessage.trim(),
          respectOptOut: true,
        });
        break;
      case "role":
        setRole.mutate({ userIds: selectedIds, role: newRole });
        break;
      case "suspend":
        setStatus.mutate({
          userIds: selectedIds,
          status: "suspended",
          reason: suspendReason.trim() || undefined,
        });
        break;
    }
  };

  if (selectedCount === 0) return null;

  const emailUnavailable = audience.data?.emailConfigured === false;

  return (
    <>
      <Card className="border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-900 dark:text-orange-100">
            <AlertTriangle className="h-5 w-5" />
            Massehandlinger ({selectedCount} valgt)
          </CardTitle>
          <CardDescription>Utfør en handling på flere medlemmer samtidig</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-900 rounded-lg border">
            <Checkbox checked={isAllSelected} onCheckedChange={onSelectAll} id="select-all" />
            <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
              Velg alle medlemmer på denne siden
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              onClick={() => { setActionType("notification"); setIsDialogOpen(true); }}
              className="gap-2"
              disabled={isProcessing}
            >
              <Mail className="h-4 w-4" />
              Send e-post
            </Button>

            <Button
              onClick={() => { setActionType("role"); setIsDialogOpen(true); }}
              variant="secondary"
              className="gap-2"
              disabled={isProcessing}
            >
              <Shield className="h-4 w-4" />
              Endre rolle
            </Button>

            <Button
              onClick={() => { setActionType("suspend"); setIsDialogOpen(true); }}
              variant="destructive"
              className="gap-2"
              disabled={isProcessing}
            >
              <Ban className="h-4 w-4" />
              Sperr kontoer
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Handlingen gjelder de {selectedCount} valgte medlemmene. Du får se nøyaktig hva som ble
            utført — og hva som ble hoppet over.
          </p>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(o) => (o ? setIsDialogOpen(true) : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "notification" && "Send e-post"}
              {actionType === "role" && "Endre rolle"}
              {actionType === "suspend" && "Sperr kontoer"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "notification" && `Til ${selectedCount} valgte medlemmer`}
              {actionType === "role" && `Endrer rolle for ${selectedCount} medlemmer`}
              {actionType === "suspend" && `Sperrer ${selectedCount} kontoer`}
            </DialogDescription>
          </DialogHeader>

          {actionType === "notification" && (
            <div className="space-y-4">
              {emailUnavailable && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-900 dark:bg-red-950/20 dark:border-red-900 dark:text-red-100">
                  E-post er ikke konfigurert på serveren (<code>SENDGRID_API_KEY</code> mangler).
                  Ingenting vil bli sendt — og du får en feilmelding, ikke en falsk kvittering.
                </div>
              )}
              <Input
                placeholder="Emne"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={300}
              />
              <Textarea
                placeholder="Skriv meldingen …"
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
                className="min-h-[140px]"
                maxLength={20000}
              />
              <p className="text-xs text-muted-foreground">
                Sendes med Penna-malen. Medlemmer som har slått av e-postvarsler blir hoppet over —
                og talt opp for deg etterpå.
                {audience.data ? ` Når fram til ${audience.data.count} adresse(r).` : ""}
              </p>
            </div>
          )}

          {actionType === "role" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Ny rolle</label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as "admin" | "user")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Bruker</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Din egen konto og den siste administratoren blir aldri nedgradert — de hoppes over
                og vises i kvitteringen.
              </p>
            </div>
          )}

          {actionType === "suspend" && (
            <div className="space-y-4">
              <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                <p className="text-sm text-red-900 dark:text-red-100">
                  {selectedCount} konto(er) mister tilgangen umiddelbart — også pågående økter.
                  Dette er reversibelt: dataene røres ikke.
                </p>
              </div>
              <Input
                placeholder="Begrunnelse (vises i admin, valgfritt)"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                maxLength={500}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={isProcessing}>
              Avbryt
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isProcessing || (actionType === "notification" && emailUnavailable)}
              variant={actionType === "suspend" ? "destructive" : "default"}
            >
              {isProcessing ? "Utfører …" : "Bekreft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
