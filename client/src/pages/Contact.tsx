/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Mail, MapPin, Phone, Send, CheckCircle2 } from "lucide-react";

export default function Contact() {
  const [formData, setFormData] = useState({
    navn: "",
    epost: "",
    melding: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const contactMutation = trpc.system.sendContactMessage.useMutation({
    onSuccess: () => {
      toast.success("Meldingen din er sendt! Vi svarer innen 24 timer.");
      setSubmitted(true);
      setFormData({ navn: "", epost: "", melding: "" });
    },
    onError: (error) => {
      toast.error(`Feil ved sending: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.navn.trim()) {
      toast.error("Vennligst skriv inn navnet ditt");
      return;
    }
    if (!formData.epost.trim() || !formData.epost.includes("@")) {
      toast.error("Vennligst skriv inn en gyldig e-postadresse");
      return;
    }
    if (!formData.melding.trim() || formData.melding.trim().length < 10) {
      toast.error("Meldingen må være minst 10 tegn lang");
      return;
    }

    contactMutation.mutate(formData);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full border-2 border-green-200">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="h-20 w-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold mb-4">Takk for din melding!</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Vi har mottatt henvendelsen din og vil svare deg innen 24 timer.
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => setSubmitted(false)} variant="outline">
                Send en ny melding
              </Button>
              <Button asChild>
                <a href="/landing">Tilbake til forsiden</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Kontakt oss
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Har du spørsmål eller trenger hjelp? Vi er her for å hjelpe deg!
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Contact Form */}
          <Card className="border-2 hover:shadow-xl transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                Send oss en melding
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="navn">Navn *</Label>
                  <Input
                    id="navn"
                    value={formData.navn}
                    onChange={(e) => setFormData({ ...formData, navn: e.target.value })}
                    placeholder="Ditt fulle navn"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="epost">E-post *</Label>
                  <Input
                    id="epost"
                    type="email"
                    value={formData.epost}
                    onChange={(e) => setFormData({ ...formData, epost: e.target.value })}
                    placeholder="din@epost.no"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="melding">Melding *</Label>
                  <Textarea
                    id="melding"
                    value={formData.melding}
                    onChange={(e) => setFormData({ ...formData, melding: e.target.value })}
                    placeholder="Skriv din melding her..."
                    rows={6}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum 10 tegn
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={contactMutation.isPending}
                >
                  {contactMutation.isPending ? (
                    "Sender..."
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send melding
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <div className="space-y-6">
            <Card className="border-2">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">E-post</h3>
                    <p className="text-muted-foreground mb-2">
                      Send oss en e-post, vi svarer innen 24 timer
                    </p>
                    <a
                      href="mailto:support@nexify.no"
                      className="text-primary hover:underline font-medium"
                    >
                      support@nexify.no
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <Phone className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Telefon</h3>
                    <p className="text-muted-foreground mb-2">
                      Mandag - Fredag: 09:00 - 17:00
                    </p>
                    <a
                      href="tel:+4712345678"
                      className="text-primary hover:underline font-medium"
                    >
                      +47 123 45 678
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <MapPin className="h-6 w-6 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Adresse</h3>
                    <p className="text-muted-foreground">
                      Nexify CRM Systems AS<br />
                      [Adresse]<br />
                      [Postnummer] [By], Norge
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 bg-gradient-to-r from-primary/5 to-purple-500/5">
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-3">Ofte stilte spørsmål</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Før du kontakter oss, sjekk vår FAQ-side. Kanskje finner du svaret der!
                </p>
                <Button variant="outline" asChild className="w-full">
                  <a href="/faq">Gå til FAQ</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}