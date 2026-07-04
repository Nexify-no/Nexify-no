/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * P0-5: Right-of-withdrawal (angrerett) consent gate shown BEFORE payment.
 * The user must (1) see the recurring/auto-renew terms and (2) tick a mandatory,
 * unchecked-by-default box acknowledging that the withdrawal right lapses once the
 * digital service is taken into use (angrerettloven § 22 bokstav n) before the pay
 * button becomes enabled.
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export type CheckoutConsentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "199 kr" */
  priceLabel: string;
  /** e.g. "måned" or "år" */
  periodLabel: string;
  isLoading?: boolean;
  onConfirm: () => void;
};

export function CheckoutConsentDialog({
  open,
  onOpenChange,
  priceLabel,
  periodLabel,
  isLoading = false,
  onConfirm,
}: CheckoutConsentDialogProps) {
  const [accepted, setAccepted] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setAccepted(false); // reset on close so it's always unchecked next time
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bekreft abonnement</DialogTitle>
          <DialogDescription>
            Du belastes {priceLabel} nå, og deretter {priceLabel} per {periodLabel} frem til du sier
            opp. Ingen bindingstid – avbryt når som helst under Innstillinger.
          </DialogDescription>
        </DialogHeader>

        <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm cursor-pointer">
          <Checkbox
            checked={accepted}
            onCheckedChange={(v) => setAccepted(v === true)}
            className="mt-0.5"
            aria-label="Samtykke til angrerett"
          />
          <span>
            Jeg samtykker til at den digitale tjenesten leveres umiddelbart, og bekrefter at
            angreretten bortfaller når tjenesten tas i bruk, jf. angrerettloven § 22 bokstav n.
          </span>
        </label>

        <DialogFooter>
          <Button
            className="w-full"
            disabled={!accepted || isLoading}
            onClick={onConfirm}
          >
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Betal – abonnementet fornyes automatisk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CheckoutConsentDialog;
