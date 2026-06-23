/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Download, Trash2, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";

export default function AccountSettings() {
  const [, setLocation] = useLocation();
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const exportDataMutation = trpc.user.exportData.useMutation({
    onSuccess: (data) => {
      // Create a downloadable JSON file
      const dataStr = JSON.stringify(data, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `innlegg-data-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Dataene dine er eksportert!");
      setIsExporting(false);
    },
    onError: (error) => {
      toast.error(`Feil ved eksport: ${error.message}`);
      setIsExporting(false);
    },
  });

  const deleteAccountMutation = trpc.user.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success("Kontoen din er slettet. Du blir nå logget ut.");
      setTimeout(() => {
        setLocation("/");
      }, 2000);
    },
    onError: (error) => {
      toast.error(`Feil ved sletting: ${error.message}`);
    },
  });

  const handleExportData = () => {
    setIsExporting(true);
    exportDataMutation.mutate();
  };

  const handleDeleteAccount = () => {
    if (confirmation !== "DELETE") {
      toast.error('Vennligst skriv "DELETE" for å bekrefte');
      return;
    }

    deleteAccountMutation.mutate({
      confirmation: "DELETE",
      reason: reason || undefined,
    });
  };

  return (
    <div className="container max-w-4xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Kontoinnstillinger</h1>
          <p className="text-muted-foreground mt-2">
            Administrer personvernet ditt og kontoinformasjon
          </p>
        </div>

        {/* Export Data Section */}
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Download className="h-6 w-6 text-blue-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-2">Eksporter dataene dine</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Last ned en kopi av alle dataene dine i JSON-format. Dette inkluderer profilen din,
                innstillinger og annen informasjon lagret i kontoen din.
              </p>
              <Button
                onClick={handleExportData}
                disabled={isExporting || exportDataMutation.isPending}
                variant="outline"
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting || exportDataMutation.isPending ? "Eksporterer..." : "Eksporter data"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Delete Account Section */}
        <Card className="p-6 border-destructive/50">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-2 text-destructive">Slett kontoen din</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Når du sletter kontoen din, vil alle dataene dine bli permanent fjernet fra våre
                servere. Denne handlingen kan ikke angres.
              </p>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Slett konto
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Er du helt sikker?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Denne handlingen kan ikke angres. Dette vil permanent slette kontoen din og
                      fjerne alle dataene dine fra våre servere.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="confirmation">
                        Skriv <span className="font-bold">DELETE</span> for å bekrefte
                      </Label>
                      <Input
                        id="confirmation"
                        value={confirmation}
                        onChange={(e) => setConfirmation(e.target.value)}
                        placeholder="DELETE"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reason">
                        Hvorfor sletter du kontoen din? (valgfritt)
                      </Label>
                      <Textarea
                        id="reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Din tilbakemelding hjelper oss med å forbedre tjenesten..."
                        rows={3}
                      />
                    </div>
                  </div>

                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => {
                      setConfirmation("");
                      setReason("");
                    }}>
                      Avbryt
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      disabled={confirmation !== "DELETE" || deleteAccountMutation.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleteAccountMutation.isPending ? "Sletter..." : "Slett konto permanent"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </Card>

        {/* Privacy Information */}
        <Card className="p-6 bg-muted/30">
          <h3 className="font-semibold mb-3">Dine rettigheter under GDPR</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• <strong>Rett til tilgang:</strong> Du kan eksportere alle dataene dine når som helst</li>
            <li>• <strong>Rett til sletting:</strong> Du kan slette kontoen din og alle tilknyttede data</li>
            <li>• <strong>Rett til dataportabilitet:</strong> Eksporterte data er i et maskinlesbart format (JSON)</li>
            <li>• <strong>Rett til å bli glemt:</strong> Når du sletter kontoen din, fjernes alle data permanent</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-4">
            For spørsmål om personvern, kontakt oss på{" "}
            <a href="mailto:privacy@nexify.no" className="text-primary hover:underline">
              privacy@nexify.no
            </a>
          </p>
        </Card>
      </div>
    </div>
  );
}