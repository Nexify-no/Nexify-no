/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 *
 * Lightweight, dependency-free onboarding tour. Shows a sequence of centered
 * cards explaining the platform. Appears automatically once for new users, and
 * can be restarted from Settings (which sets the START_KEY flag + opens /dashboard).
 */
import { useEffect, useState, type ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Sparkles, PenTool, CalendarDays, Mic, Rocket, X } from "lucide-react";

const DONE_KEY = "nexify_onboarding_v1_done";
const START_KEY = "nexify_start_tour";

type Step = {
  icon: ReactNode;
  title: { no: string; en: string };
  body: { no: string; en: string };
};

const STEPS: Step[] = [
  {
    icon: <Sparkles className="h-7 w-7 text-white" />,
    title: { no: "Velkommen til Nexify AI! 🎉", en: "Welcome to Nexify AI! 🎉" },
    body: {
      no: "La oss ta en rask omvisning så du kommer raskt i gang med å lage profesjonelt innhold for sosiale medier.",
      en: "Let's take a quick tour so you can start creating professional social media content right away.",
    },
  },
  {
    icon: <PenTool className="h-7 w-7 text-white" />,
    title: { no: "Generer innlegg", en: "Generate posts" },
    body: {
      no: 'Gå til "Generer", velg plattform (LinkedIn, Twitter, Instagram, Facebook), skriv en idé – og AI lager et ferdig innlegg på sekunder.',
      en: 'Go to "Generate", pick a platform (LinkedIn, Twitter, Instagram, Facebook), type an idea – and AI creates a finished post in seconds.',
    },
  },
  {
    icon: <CalendarDays className="h-7 w-7 text-white" />,
    title: { no: "Planlegg innholdet", en: "Plan your content" },
    body: {
      no: 'Bruk "Kalender" og "Beste tid" for å planlegge når innleggene skal publiseres for maksimal rekkevidde.',
      en: 'Use "Calendar" and "Best time" to schedule when your posts go out for maximum reach.',
    },
  },
  {
    icon: <Mic className="h-7 w-7 text-white" />,
    title: { no: "Din egen stemme", en: "Your own voice" },
    body: {
      no: '"Stemmetrening" lærer AI-en å skrive i din unike stil – så innholdet alltid høres ut som deg (Pro).',
      en: '"Voice training" teaches the AI to write in your unique style – so content always sounds like you (Pro).',
    },
  },
  {
    icon: <Rocket className="h-7 w-7 text-white" />,
    title: { no: "Klar til å begynne!", en: "Ready to go!" },
    body: {
      no: "Du har 2 gratis innlegg. Vil du ha ubegrenset generering, AI-bilder og planlegging? Oppgrader til Pro i Innstillinger.",
      en: "You have 2 free posts. Want unlimited generation, AI images and scheduling? Upgrade to Pro in Settings.",
    },
  },
];

export default function OnboardingTour() {
  const { language } = useLanguage();
  const lang: "no" | "en" = language === "en" ? "en" : "no";
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(START_KEY) === "1") {
        localStorage.removeItem(START_KEY);
        setStep(0);
        setOpen(true);
        return;
      }
      if (!localStorage.getItem(DONE_KEY)) {
        setOpen(true);
      }
    } catch {
      /* localStorage unavailable — skip tour */
    }
  }, []);

  const finish = () => {
    try {
      localStorage.setItem(DONE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  if (!open) return null;

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={finish} />

      {/* Card */}
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-gray-100 dark:border-slate-800 p-6">
        <button
          onClick={finish}
          aria-label={lang === "no" ? "Lukk" : "Close"}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20 mb-4">
            {s.icon}
          </div>
          <h2 className="text-xl font-bold mb-2">{s.title[lang]}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">{s.body[lang]}</p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 my-5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === step ? "w-6 bg-primary" : "w-2 bg-gray-300 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={finish}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {lang === "no" ? "Hopp over" : "Skip"}
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((v) => v - 1)}>
                {lang === "no" ? "Forrige" : "Back"}
              </Button>
            )}
            {isLast ? (
              <Button onClick={finish}>{lang === "no" ? "Kom i gang" : "Get started"}</Button>
            ) : (
              <Button onClick={() => setStep((v) => v + 1)}>
                {lang === "no" ? "Neste" : "Next"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
