/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * "Kom i gang" — the first-run wizard (/kom-i-gang, alias /onboarding).
 *
 * Six full-screen steps, exactly ONE task per screen, mobile-first:
 *   1 Legg til nettsiden din   → one URL field
 *   2 Vi gjør jobben           → passive AI analysis (auto-advances)
 *   3 Stemmer dette?           → confirm 3 cards (edit ONE field at a time)
 *   4 Koble til én kanal       → one-tap LinkedIn OAuth (others "kommer snart")
 *   5 Godkjenn innleggene dine → swipe/✓/✗ through generated drafts
 *   6 Autopiloten er på        → done; approved posts are smart-scheduled
 *
 * Everything auto-saves to localStorage (per user), so Back / OAuth round-trips /
 * reloads never lose data. No sidebar: the route is listed in PageLayout's
 * noSidebarExact.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { ArrowRight, Check, ChevronLeft, Globe, Pencil, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { PennaWordmark, PennaIntro, PenLoader } from "@/components/PennaWordmark";
import { SIG_WORD } from "@/components/pennaSignature";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLoginUrl } from "@/const";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types & copy
// ---------------------------------------------------------------------------

type ToneKey = "professional" | "casual" | "friendly" | "formal" | "humorous";
type Platform = "linkedin" | "twitter" | "instagram" | "facebook";

interface Analysis {
  companyName: string;
  industry: string;
  toneKey: ToneKey;
  toneLabel: string;
  audience: string;
  topics: string[];
  language: "no" | "en";
  sourceUrl: string;
}

interface QueueItem {
  postId: number;
  content: string;
  imageUrl: string | null;
  platform: Platform;
  decided?: "approved" | "skipped";
}

interface WizardState {
  /** First-open chooser: the user explicitly picks the wizard or the classic
   *  app. Once made, deliberate visits to /kom-i-gang go straight to step 1. */
  choiceMade: boolean;
  step: 1 | 2 | 3 | 4 | 5 | 6;
  url: string;
  /** The URL the current analysis was produced from — changing the URL on
   *  step 1 and pressing Start re-runs the analysis instead of confirming
   *  a stale profile. */
  analyzedUrl: string;
  manual: boolean;
  analysis: Analysis | null;
  connected: boolean;
  skippedConnect: boolean;
  generated: boolean;
  queue: QueueItem[];
  approvedCount: number;
}

const INITIAL_STATE: WizardState = {
  choiceMade: false,
  step: 1,
  url: "",
  analyzedUrl: "",
  manual: false,
  analysis: null,
  connected: false,
  skippedConnect: false,
  generated: false,
  queue: [],
  approvedCount: 0,
};

const STORAGE_PREFIX = "penna_wizard_v1:";
const TOUR_DONE_KEY = "penna_onboarding_v1_done"; // suppress the old dashboard tour

const TONE_LABELS: Record<"no" | "en", Record<ToneKey, string>> = {
  no: {
    professional: "Profesjonell",
    casual: "Uformell",
    friendly: "Vennlig",
    formal: "Formell",
    humorous: "Humoristisk",
  },
  en: {
    professional: "Professional",
    casual: "Casual",
    friendly: "Friendly",
    formal: "Formal",
    humorous: "Humorous",
  },
};

const COPY = {
  no: {
    stepOf: (n: number) => `Steg ${n} av 6`,
    back: "Tilbake",
    close: "Lukk",
    exitWizard: "Avslutt og fortsett senere",
    introTagline: "Fra idé til ferdig innlegg — på sekunder.",
    // 0 — first-open chooser
    chooseTitle: "Hvordan vil du starte?",
    chooseSupport: "Du kan bytte når som helst.",
    chooseWizard: "Bruk veiviseren",
    chooseWizardDesc: "Vi setter opp merkevaren, kanalen og de første innleggene. Under 3 minutter.",
    chooseWizardBadge: "Anbefalt",
    chooseClassic: "Utforsk selv",
    chooseClassicDesc: "Gå rett til dashbordet. Veiviseren venter på deg der.",
    // 1
    s1Title: "Legg til nettsiden din",
    s1Support: "Vi lærer om bedriften din fra nettsiden.",
    s1Placeholder: "dinbedrift.no",
    s1Cta: "Start",
    s1Skip: "Hopp over — jeg har ikke nettside",
    s1Invalid: "Det ligner ikke på en nettadresse. Prøv f.eks. dinbedrift.no",
    s1Consent: "Ved å fortsette godtar du at innhold lages med AI (OpenAI). Du eier alt som lages.",
    // 2
    s2Title: "Vi gjør jobben",
    s2Support: "Len deg tilbake — dette tar under ett minutt.",
    s2Lines: [
      "Leser nettsiden din …",
      "Fanger tonen din …",
      "Finner temaer å skrive om …",
      "Blir kjent med målgruppen …",
      "Lager innholdsplan …",
    ],
    s2Retry: "Prøv igjen",
    s2SkipManual: "Fyll inn selv i stedet",
    // 3
    s3Title: "Stemmer dette?",
    s3Support: "Dette fant vi på nettsiden din. Du kan endre alt.",
    s3SupportManual: "Vi har foreslått noe å starte med. Du kan endre alt.",
    s3Industry: "Bransje",
    s3Tone: "Tonefall",
    s3Audience: "Målgruppe",
    s3Edit: "Rediger",
    s3Cta: "Ja, fortsett",
    s3Save: "Lagre",
    s3EditIndustry: "Hva driver bedriften med?",
    s3EditTone: "Hvordan skal innleggene høres ut?",
    s3EditAudience: "Hvem vil du nå?",
    s3IndustryFallback: "Lokal tjenestebedrift",
    s3AudienceFallback: "Kunder i nærområdet",
    // 4
    s4Title: "Koble til én kanal",
    s4Support: "Én kanal holder for å komme i gang.",
    s4Cta: "Koble til LinkedIn",
    s4CtaConnected: "Fortsett",
    s4Skip: "Hopp over — jeg gjør det senere",
    s4More: "Du kan legge til flere senere.",
    s4Soon: "Kommer snart",
    s4Connected: (name: string) => (name ? `Koblet til som ${name}` : "Koblet til"),
    s4Error: "Tilkoblingen ble avbrutt. Trykk på LinkedIn for å prøve igjen.",
    // 5
    s5Title: "Godkjenn innleggene dine",
    s5Support: "Sveip høyre for å godkjenne — eller bruk knappene under.",
    s5Queue: (n: number) => `${n} i køen`,
    s5Writing: (i: number, n: number) => `Skriver utkast ${i} av ${n} …`,
    s5Refine: "Finjuster",
    s5RefinePlaceholder: "Beskriv endringen med egne ord, f.eks. «kortere og nevn sommertilbudet»",
    s5RefineCta: "Oppdater innlegget",
    s5Approve: "Godkjenn",
    s5SkipPost: "Hopp over",
    s5SkipAll: "Hopp over — jeg godkjenner senere",
    s5Approved: "Godkjent ✓",
    s5Skipped: "Hoppet over",
    s5QuotaEmpty:
      "Gratiskvoten er brukt opp, så vi kunne ikke lage utkast nå. Innlegg kan lages når som helst senere.",
    s5Continue: "Fortsett",
    s5Verify:
      "Bekreft e-postadressen din først — vi har sendt deg en lenke. Kom tilbake hit etterpå.",
    s5VerifyCta: "Jeg har bekreftet — prøv igjen",
    // 6
    s6Title: "Autopiloten er på",
    s6SupportConnected: "Ferdig. Godkjente innlegg publiseres automatisk.",
    s6SupportNotConnected: "Ferdig. Innleggene dine ligger klare under Mine innlegg.",
    s6Cta: "Gå til innleggene mine",
    // errors
    genericError: "Noe gikk galt. Prøv igjen om et lite øyeblikk.",
  },
  en: {
    stepOf: (n: number) => `Step ${n} of 6`,
    back: "Back",
    close: "Close",
    exitWizard: "Exit and continue later",
    introTagline: "From idea to finished post — in seconds.",
    chooseTitle: "How do you want to start?",
    chooseSupport: "You can switch at any time.",
    chooseWizard: "Use the setup wizard",
    chooseWizardDesc: "We set up your brand, channel and first posts. Under 3 minutes.",
    chooseWizardBadge: "Recommended",
    chooseClassic: "Explore on my own",
    chooseClassicDesc: "Go straight to the dashboard. The wizard waits for you there.",
    s1Title: "Add your website",
    s1Support: "We'll learn about your business from your website.",
    s1Placeholder: "yourcompany.com",
    s1Cta: "Start",
    s1Skip: "Skip — I don't have a website",
    s1Invalid: "That doesn't look like a web address. Try e.g. yourcompany.com",
    s1Consent: "By continuing you agree that content is created with AI (OpenAI). You own everything that's made.",
    s2Title: "We're doing the work",
    s2Support: "Sit back — this takes under a minute.",
    s2Lines: [
      "Reading your site …",
      "Capturing your tone …",
      "Finding topics to write about …",
      "Getting to know your audience …",
      "Drafting your content plan …",
    ],
    s2Retry: "Try again",
    s2SkipManual: "Fill it in myself instead",
    s3Title: "Does this look right?",
    s3Support: "This is what we found on your website. You can change anything.",
    s3SupportManual: "We suggested something to start with. You can change anything.",
    s3Industry: "Industry",
    s3Tone: "Tone of voice",
    s3Audience: "Audience",
    s3Edit: "Edit",
    s3Cta: "Yes, continue",
    s3Save: "Save",
    s3EditIndustry: "What does your business do?",
    s3EditTone: "How should your posts sound?",
    s3EditAudience: "Who do you want to reach?",
    s3IndustryFallback: "Local service business",
    s3AudienceFallback: "Customers nearby",
    s4Title: "Connect one channel",
    s4Support: "One channel is enough to get started.",
    s4Cta: "Connect LinkedIn",
    s4CtaConnected: "Continue",
    s4Skip: "Skip — I'll do this later",
    s4More: "You can add more later.",
    s4Soon: "Coming soon",
    s4Connected: (name: string) => (name ? `Connected as ${name}` : "Connected"),
    s4Error: "The connection was interrupted. Tap LinkedIn to try again.",
    s5Title: "Approve your posts",
    s5Support: "Swipe right to approve — or use the buttons below.",
    s5Queue: (n: number) => `${n} in queue`,
    s5Writing: (i: number, n: number) => `Writing draft ${i} of ${n} …`,
    s5Refine: "Refine",
    s5RefinePlaceholder: "Describe the change in your own words, e.g. “shorter, mention the summer offer”",
    s5RefineCta: "Update the post",
    s5Approve: "Approve",
    s5SkipPost: "Skip",
    s5SkipAll: "Skip — I'll approve later",
    s5Approved: "Approved ✓",
    s5Skipped: "Skipped",
    s5QuotaEmpty:
      "Your free quota is used up, so we couldn't draft posts now. You can create posts any time later.",
    s5Continue: "Continue",
    s5Verify: "Confirm your email first — we've sent you a link. Come back here after.",
    s5VerifyCta: "I've confirmed — try again",
    s6Title: "Autopilot is on",
    s6SupportConnected: "Done. Approved posts publish automatically.",
    s6SupportNotConnected: "Done. Your posts are ready under My posts.",
    s6Cta: "Go to my posts",
    genericError: "Something went wrong. Try again in a moment.",
  },
} as const;

type Copy = (typeof COPY)["no"] | (typeof COPY)["en"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPlausibleUrl(input: string): boolean {
  const raw = input.trim();
  if (!raw) return false;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return /^[a-z0-9åæø-]+(\.[a-z0-9åæø-]+)+$/i.test(u.hostname);
  } catch {
    return false;
  }
}

/** Map any thrown error to a what-to-do-next sentence (never a code). */
function friendlyError(e: unknown, c: Copy): string {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (msg.includes("EMAIL_NOT_VERIFIED")) return c.s5Verify;
  // Server-side wizard/quota errors are already written as Norwegian
  // what-to-do sentences — pass them through when they look human.
  if (msg && msg.length < 220 && !/internal|unexpected|error:|failed to fetch/i.test(msg)) {
    return msg;
  }
  return c.genericError;
}

function loadState(userId: number): WizardState | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WizardState;
    if (typeof parsed.step !== "number" || parsed.step < 1 || parsed.step > 6) return null;
    return { ...INITIAL_STATE, ...parsed };
  } catch {
    return null;
  }
}

function saveState(userId: number, state: WizardState): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(state));
  } catch {
    /* storage unavailable — wizard still works in memory */
  }
}

const EASE = [0.22, 1, 0.36, 1] as const;

/** Types text in like the pen is writing it (the "magic" reveal on step 5).
 *  Re-types when the content changes (e.g. after a refine), instant under
 *  prefers-reduced-motion. */
function TypeText({ text }: { text: string }) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(() => (reduceMotion ? text.length : 0));
  useEffect(() => {
    if (reduceMotion) {
      setShown(text.length);
      return;
    }
    setShown(0);
    const step = Math.max(2, Math.round(text.length / 70)); // ~1.1s total
    const id = setInterval(() => {
      setShown((n) => {
        if (n + step >= text.length) {
          clearInterval(id);
          return text.length;
        }
        return n + step;
      });
    }, 16);
    return () => clearInterval(id);
  }, [text, reduceMotion]);
  return (
    <>
      {text.slice(0, shown)}
      {shown < text.length && (
        <span aria-hidden className="text-primary/70">
          ▍
        </span>
      )}
    </>
  );
}

/** Minimal modal keyboard behavior for the bottom sheets: Escape closes,
 *  Tab cycles inside (the sheets are small — one field + one button). */
function trapSheetKeys(e: React.KeyboardEvent<HTMLDivElement>, onClose: () => void) {
  if (e.key === "Escape") {
    e.stopPropagation();
    onClose();
    return;
  }
  if (e.key !== "Tab") return;
  const focusables = e.currentTarget.querySelectorAll<HTMLElement>(
    'button, input, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

// ---------------------------------------------------------------------------
// Shared UI primitives (same button, same position, every screen)
// ---------------------------------------------------------------------------

function PrimaryButton({
  children,
  onClick,
  disabled,
  busy,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(
        "flex h-14 w-full items-center justify-center gap-2 rounded-xl",
        "bg-gradient-to-r from-indigo-600 to-purple-600 text-base font-semibold text-white",
        "shadow-lg shadow-indigo-600/20 transition-all duration-200",
        "hover:opacity-95 active:scale-[0.99]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
        (disabled || busy) && "opacity-60"
      )}
    >
      {busy ? (
        <span
          aria-hidden
          className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
      ) : (
        children
      )}
    </button>
  );
}

function SkipLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 w-full items-center justify-center text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
    >
      {children}
    </button>
  );
}

/** Fixed bottom action area — the primary button lives here on every screen.
 *  pointer-events-none on the wrapper so the transparent fade strip never
 *  swallows taps meant for content scrolled behind it. */
function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
      <div className="bg-gradient-to-t from-background via-background/95 to-transparent pt-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto mx-auto w-full max-w-md space-y-1 px-6 md:max-w-xl">{children}</div>
      </div>
    </div>
  );
}

function ScreenHeading({
  title,
  support,
  headingRef,
}: {
  title: string;
  support: string;
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <header className="space-y-2">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-[1.75rem] leading-tight font-bold tracking-tight outline-none md:text-4xl"
        style={{ textWrap: "balance" } as React.CSSProperties}
      >
        {title}
      </h1>
      <p className="text-base text-muted-foreground md:text-lg">{support}</p>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Step 5: swipeable post card
// ---------------------------------------------------------------------------

function SwipeCard({
  item,
  companyInitial,
  companyName,
  onApprove,
  onSkip,
  approveLabel,
  skipLabel,
}: {
  item: QueueItem;
  companyInitial: string;
  companyName: string;
  onApprove: () => void;
  onSkip: () => void;
  approveLabel: string;
  skipLabel: string;
}) {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-7, 7]);
  const approveOpacity = useTransform(x, [32, 110], [0, 1]);
  const skipOpacity = useTransform(x, [-110, -32], [1, 0]);

  return (
    <motion.div
      drag={reduceMotion ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      style={{ x, rotate }}
      onDragEnd={(_e, info) => {
        if (info.offset.x > 90) onApprove();
        else if (info.offset.x < -90) onSkip();
      }}
      className="relative touch-pan-y cursor-grab active:cursor-grabbing rounded-xl border bg-card shadow-sm"
    >
      {/* swipe verdict hints */}
      <motion.div
        aria-hidden
        style={{ opacity: approveOpacity }}
        className="pointer-events-none absolute left-4 top-4 z-10 rounded-md bg-[var(--success)] px-3 py-1 text-sm font-semibold text-white"
      >
        {approveLabel}
      </motion.div>
      <motion.div
        aria-hidden
        style={{ opacity: skipOpacity }}
        className="pointer-events-none absolute right-4 top-4 z-10 rounded-md bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground"
      >
        {skipLabel}
      </motion.div>

      {/* platform chrome */}
      <div className="flex items-center gap-3 px-5 pt-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-display text-base font-bold text-primary">
          {companyInitial}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{companyName}</p>
          <p className="text-xs text-muted-foreground">LinkedIn</p>
        </div>
        <span className="ml-auto flex h-7 w-7 items-center justify-center rounded bg-[#0A66C2] text-xs font-bold text-white">
          in
        </span>
      </div>

      {item.imageUrl && (
        <img
          src={item.imageUrl}
          alt=""
          className="mt-4 max-h-56 w-full object-cover"
          loading="lazy"
        />
      )}

      <p className="max-h-[38vh] overflow-y-auto whitespace-pre-wrap break-words px-5 py-4 text-[0.9375rem] leading-relaxed">
        <TypeText text={item.content} />
      </p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// The wizard
// ---------------------------------------------------------------------------

export default function Onboarding() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const c = COPY[language];
  const [, setLocation] = useLocation();
  const [path] = useLocation();
  const reduceMotion = useReducedMotion();

  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [restored, setRestored] = useState(false);
  // Full-screen brand opening: once per browser session (skippable).
  const [introDone, setIntroDone] = useState(() => {
    try {
      return sessionStorage.getItem("penna_intro_v1") === "1";
    } catch {
      return true;
    }
  });
  const patch = useCallback(
    (p: Partial<WizardState>) => setState((s) => ({ ...s, ...p })),
    []
  );

  // transient UI state
  const [urlError, setUrlError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [doneLines, setDoneLines] = useState(0);
  const [editing, setEditing] = useState<null | "industry" | "tone" | "audience">(null);
  const [editValue, setEditValue] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectedName, setConnectedName] = useState("");
  const [genError, setGenError] = useState<string | null>(null);
  const [genProgress, setGenProgress] = useState<{ current: number; total: number } | null>(null);
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineText, setRefineText] = useState("");
  // Focus returns to the element that opened a sheet when it closes.
  const sheetReturnFocusRef = useRef<HTMLElement | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [exitDirection, setExitDirection] = useState<1 | -1>(1);

  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const stepRef = useRef(state.step);
  stepRef.current = state.step;

  // --- tRPC -----------------------------------------------------------------
  const utils = trpc.useUtils();
  const analyzeWebsite = trpc.onboarding.analyzeWebsite.useMutation();
  const confirmProfile = trpc.onboarding.confirmProfile.useMutation();
  const refinePost = trpc.onboarding.refinePost.useMutation();
  const generate = trpc.content.generate.useMutation();
  const generateImage = trpc.content.generateImageNanoBanana.useMutation();
  const attachImage = trpc.content.attachImage.useMutation();
  const smartSchedule = trpc.scheduling.smartSchedulePost.useMutation();
  const completeOnboarding = trpc.user.completeOnboarding.useMutation();
  const updateConsent = trpc.user.updateOpenAIConsent.useMutation();
  const { data: subscription } = trpc.user.getSubscription.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: liStatus, refetch: refetchLiStatus } = trpc.linkedin.getConnectionStatus.useQuery(
    undefined,
    { enabled: isAuthenticated && state.step === 4 }
  );

  // --- restore / persist ------------------------------------------------------
  useEffect(() => {
    if (!user?.id || restored) return;
    const saved = loadState(user.id);
    if (saved) setState(saved);
    setRestored(true);
  }, [user?.id, restored]);

  useEffect(() => {
    if (user?.id && restored) saveState(user.id, state);
  }, [user?.id, restored, state]);

  // Focus the headline on step change (screen readers announce the new task).
  useEffect(() => {
    const t = setTimeout(() => headingRef.current?.focus({ preventScroll: true }), 380);
    return () => clearTimeout(t);
  }, [state.step]);

  const goTo = useCallback(
    (step: WizardState["step"], dir: 1 | -1 = 1) => {
      setExitDirection(dir);
      patch({ step });
    },
    [patch]
  );

  // --- step 1: start (also captures the OpenAI-use consent the step-1
  // microcopy discloses — the global consent banner is suppressed on this route)
  const startFromUrl = useCallback(() => {
    if (!isPlausibleUrl(state.url)) {
      setUrlError(c.s1Invalid);
      return;
    }
    updateConsent.mutate({ consent: 1 });
    if (state.analysis && state.url.trim() !== state.analyzedUrl) {
      // URL changed since the last run — the old profile is stale.
      patch({ analysis: null, manual: false });
    } else {
      patch({ manual: false });
    }
    goTo(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.url, state.analysis, state.analyzedUrl, c]);

  // --- step 2: run the analysis ----------------------------------------------
  const runAnalysis = useCallback(() => {
    setAnalysisError(null);
    setDoneLines(0);
    patch({ analyzedUrl: state.url.trim() });
    analyzeWebsite.mutate(
      { url: state.url },
      {
        onSuccess: (data) => patch({ analysis: data }),
        onError: (e) => setAnalysisError(friendlyError(e, c)),
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.url]);

  const analysisStartedRef = useRef(false);
  useEffect(() => {
    if (state.step !== 2) {
      analysisStartedRef.current = false;
      return;
    }
    if (analysisStartedRef.current || state.analysis || state.manual) return;
    analysisStartedRef.current = true;
    runAnalysis();
  }, [state.step, state.analysis, state.manual, runAnalysis]);

  // Theatrical status lines: advance every ~1.1s while pending; when the result
  // is in, sweep the rest quickly, then auto-advance.
  useEffect(() => {
    if (state.step !== 2 || analysisError) return;
    const total = c.s2Lines.length;
    if (state.analysis) {
      if (doneLines < total) {
        const t = setTimeout(() => setDoneLines((n) => n + 1), reduceMotion ? 0 : 220);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => {
        if (stepRef.current === 2) goTo(3);
      }, 600);
      return () => clearTimeout(t);
    }
    if (doneLines < total - 1) {
      const t = setTimeout(() => setDoneLines((n) => n + 1), 1100);
      return () => clearTimeout(t);
    }
  }, [state.step, state.analysis, analysisError, doneLines, c.s2Lines.length, goTo, reduceMotion]);

  // --- step 4: OAuth round-trip -----------------------------------------------
  useEffect(() => {
    if (state.step !== 4) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("linkedin_success") === "true") {
      window.history.replaceState({}, "", window.location.pathname);
      void refetchLiStatus();
    } else if (params.get("linkedin_error")) {
      window.history.replaceState({}, "", window.location.pathname);
      setConnectError(c.s4Error);
    }
  }, [state.step, refetchLiStatus, c.s4Error]);

  useEffect(() => {
    if (state.step !== 4 || !liStatus?.connected) return;
    setConnectedName("profileName" in liStatus ? (liStatus.profileName ?? "") : "");
    if (!state.connected) {
      patch({ connected: true, skippedConnect: false });
      const t = setTimeout(() => {
        if (stepRef.current === 4) goTo(5);
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [state.step, liStatus, state.connected, patch, goTo]);

  const startLinkedInConnect = useCallback(async () => {
    setConnectError(null);
    try {
      document.cookie = `li_return_to=${encodeURIComponent(path)}; path=/; max-age=600; SameSite=Lax`;
      const { url } = await utils.linkedin.getAuthUrl.fetch();
      window.location.href = url;
    } catch (e) {
      setConnectError(friendlyError(e, c));
    }
  }, [utils, path, c]);

  // --- step 5: generate the starter queue --------------------------------------
  // Deliberately NOT reset when leaving step 5: a Back-and-return while drafts
  // are still being written must not start a second run (duplicate posts +
  // double quota burn). The explicit retry path below resets it.
  const generationStartedRef = useRef(false);
  useEffect(() => {
    if (state.step !== 5) return;
    if (generationStartedRef.current || state.generated || !subscription) return;
    generationStartedRef.current = true;

    const profile = state.analysis;
    const platform: Platform = "linkedin";
    const topics =
      profile && profile.topics.length > 0
        ? profile.topics
        : [
            language === "no"
              ? `Tre tips fra en ${profile?.industry || c.s3IndustryFallback}`
              : `Three tips from a ${profile?.industry || c.s3IndustryFallback}`,
            language === "no"
              ? "Presenter bedriften og hva dere hjelper kunder med"
              : "Introduce the business and how you help customers",
            language === "no"
              ? "En vanlig misforståelse i bransjen — og hva som faktisk stemmer"
              : "A common misconception in the industry — and what's actually true",
          ];

    const remaining =
      typeof subscription.postsRemaining === "number" ? subscription.postsRemaining : 3;
    const target = Math.min(3, Math.max(0, remaining));

    // Mark generated BEFORE the run and let auto-save persist it: a reload or
    // OAuth round-trip mid-run must never restart generation (duplicate drafts
    // + double quota burn). Worst case after an interrupt: fewer drafts.
    patch({ generated: true });

    const run = async () => {
      setGenError(null);
      if (target === 0) {
        setGenError(c.s5QuotaEmpty);
        return;
      }
      const isTrial = subscription.status === "trial";
      let firstPostId: number | null = null;
      let produced = 0;
      for (let i = 0; i < target; i++) {
        setGenProgress({ current: i + 1, total: target });
        try {
          const res = await generate.mutateAsync({
            topic: topics[i % topics.length],
            platform,
            tone: profile?.toneKey ?? "friendly",
            length: "medium",
            targetAudience: profile?.audience || undefined,
            goal: "engagement",
            language: profile?.language ?? (language as "no" | "en"),
            hashtagCount: 3,
            emojiUsage: "minimal",
            closingQuestion: true,
          });
          if (firstPostId === null) firstPostId = res.postId;
          produced++;
          setState((s) => ({
            ...s,
            queue: [
              ...s.queue,
              { postId: res.postId, content: res.content, imageUrl: null, platform },
            ],
          }));
          if (res.postsRemaining !== null && res.postsRemaining <= 0) break;
        } catch (e) {
          const msg = friendlyError(e, c);
          if (produced === 0) setGenError(msg);
          else toast.error(msg); // some drafts exist — surface without blocking
          break;
        }
      }
      setGenProgress(null);

      // Best-effort image for the first draft (skipped on trial, mirroring
      // Generate.tsx). Fills in while the user reads — never blocks the flow.
      if (firstPostId !== null && !isTrial && profile) {
        try {
          const img = await generateImage.mutateAsync({
            topic: topics[0],
            platform,
            tone: profile.toneKey,
            keywords: [],
          });
          const att = await attachImage.mutateAsync({ postId: firstPostId, imageUrl: img.url });
          if (att.applied) {
            setState((s) => ({
              ...s,
              queue: s.queue.map((q) =>
                q.postId === firstPostId ? { ...q, imageUrl: img.url } : q
              ),
            }));
          }
        } catch {
          /* caption-only is fine */
        }
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, state.generated, subscription]);

  const pending = state.queue.filter((q) => !q.decided);
  const activeItem = pending[0] ?? null;

  // Guards the ~350ms exit animation window: a double-tap (or a swipe on the
  // exiting card) must not decide the NEXT card sight-unseen or schedule twice.
  const lastDecideAtRef = useRef(0);
  const lastDecisionRef = useRef<"approved" | "skipped">("approved");

  const decideActive = useCallback(
    (decision: "approved" | "skipped") => {
      const now = Date.now();
      if (now - lastDecideAtRef.current < 420) return;
      lastDecideAtRef.current = now;
      lastDecisionRef.current = decision;
      const item = pending[0];
      if (!item) return;
      if (decision === "approved" && state.connected) {
        smartSchedule.mutate(
          { postId: item.postId, platform: item.platform, daysAhead: state.approvedCount + 1 },
          {
            onError: (e) => toast.error(friendlyError(e, c)),
          }
        );
      }
      setState((s) => ({
        ...s,
        approvedCount: decision === "approved" ? s.approvedCount + 1 : s.approvedCount,
        queue: s.queue.map((q) => (q.postId === item.postId ? { ...q, decided: decision } : q)),
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pending, state.connected, state.approvedCount, c]
  );

  // Queue exhausted → autopilot screen.
  useEffect(() => {
    if (state.step !== 5 || !state.generated) return;
    if (state.queue.length > 0 && pending.length === 0 && !genProgress) {
      const t = setTimeout(() => {
        if (stepRef.current === 5) goTo(6);
      }, 550);
      return () => clearTimeout(t);
    }
  }, [state.step, state.generated, state.queue.length, pending.length, genProgress, goTo]);

  // --- step 6: mark complete ----------------------------------------------------
  const completedRef = useRef(false);
  useEffect(() => {
    if (state.step !== 6 || completedRef.current) return;
    completedRef.current = true;
    completeOnboarding.mutate();
    try {
      localStorage.setItem(TOUR_DONE_KEY, "1");
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  const closeEditSheet = useCallback(() => {
    setEditing(null);
    sheetReturnFocusRef.current?.focus();
  }, []);
  const closeRefineSheet = useCallback(() => {
    setRefineOpen(false);
    sheetReturnFocusRef.current?.focus();
  }, []);

  const finish = useCallback(() => {
    if (user?.id) {
      try {
        localStorage.removeItem(STORAGE_PREFIX + user.id);
      } catch {
        /* ignore */
      }
    }
    setLocation("/innlegg");
  }, [user?.id, setLocation]);

  // --- auth guard ----------------------------------------------------------------
  if (!authLoading && !isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }
  if (authLoading || !restored) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
        />
      </div>
    );
  }

  // --- first-open chooser ------------------------------------------------------
  // One decision, native.no style: wizard or classic. Choosing classic leaves
  // the wizard resumable (Dashboard shows a "fortsett" card until completed).
  if (!state.choiceMade) {
    return (
      <div className="penna-wash relative min-h-dvh overflow-hidden bg-background">
        {/* ambient: the giant signature as a watermark + slow ink motes */}
        <svg
          viewBox="0 -60 180 66"
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-10 -right-24 w-[560px] -rotate-6 md:w-[680px]"
        >
          <path d={SIG_WORD} className="fill-foreground/[0.025]" />
        </svg>
        <span aria-hidden className="ink-mote left-[12%] top-[68%] h-3 w-3" style={{ "--mote-dur": "34s", "--mote-x": "70px", "--mote-y": "-160px" } as React.CSSProperties} />
        <span aria-hidden className="ink-mote left-[78%] top-[30%] h-2 w-2" style={{ "--mote-dur": "28s", "--mote-delay": "6s", "--mote-x": "-50px", "--mote-y": "-120px" } as React.CSSProperties} />
        <span aria-hidden className="ink-mote left-[45%] top-[85%] h-2.5 w-2.5" style={{ "--mote-dur": "40s", "--mote-delay": "13s", "--mote-x": "40px", "--mote-y": "-180px" } as React.CSSProperties} />
        {/* Full-screen opening: the pen writes the brand, then hands over */}
        <AnimatePresence>
          {!introDone && (
            <PennaIntro
              tagline={c.introTagline}
              onDone={() => {
                try {
                  sessionStorage.setItem("penna_intro_v1", "1");
                } catch {
                  /* ignore */
                }
                setIntroDone(true);
              }}
            />
          )}
        </AnimatePresence>
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-16 md:max-w-2xl">
          <PennaWordmark still className="h-12 self-start md:h-14" />
          <ScreenHeading title={c.chooseTitle} support={c.chooseSupport} headingRef={headingRef} />
          <div className="space-y-3 md:grid md:grid-cols-2 md:items-stretch md:gap-4 md:space-y-0">
            <button
              type="button"
              onClick={() => patch({ choiceMade: true })}
              className="w-full rounded-xl border-2 border-primary bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.995]"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" aria-hidden />
                <span className="text-base font-semibold">{c.chooseWizard}</span>
                <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {c.chooseWizardBadge}
                </span>
              </span>
              <span className="mt-1.5 block text-sm text-muted-foreground">{c.chooseWizardDesc}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                patch({ choiceMade: true });
                setLocation("/dashboard");
              }}
              className="w-full rounded-xl border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm active:scale-[0.995]"
            >
              <span className="text-base font-semibold">{c.chooseClassic}</span>
              <span className="mt-1.5 block text-sm text-muted-foreground">{c.chooseClassicDesc}</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  // --- derived ---------------------------------------------------------------------
  const profile = state.analysis;
  const companyName = profile?.companyName || (language === "no" ? "Bedriften din" : "Your business");
  const companyInitial = (companyName[0] || "B").toUpperCase();
  const canGoBack = state.step >= 2 && state.step <= 5;
  // Back from step 3 goes to step 1 (the URL), not the transient working
  // screen: step 2 with a finished analysis would bounce forward again within
  // a second, and in manual mode it would spin forever.
  const backTarget: WizardState["step"] =
    state.step <= 3 ? 1 : ((state.step - 1) as WizardState["step"]);

  const stepVariants = {
    enter: (dir: 1 | -1) =>
      reduceMotion ? { opacity: 0 } : { opacity: 0, x: 28 * dir },
    center: { opacity: 1, x: 0 },
    exit: (dir: 1 | -1) => (reduceMotion ? { opacity: 0 } : { opacity: 0, x: -28 * dir }),
  };

  // ---------------------------------------------------------------------------------
  return (
    <div className="penna-wash min-h-dvh bg-background">
      {/* Progress: thin bar + step label */}
      <div className="fixed inset-x-0 top-0 z-30 bg-background/90 backdrop-blur-sm">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={6}
          aria-valuenow={state.step}
          aria-label={c.stepOf(state.step)}
          className="h-[3px] w-full bg-secondary"
        >
          <div
            className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 transition-[width] duration-700"
            style={{ width: `${(state.step / 6) * 100}%`, transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
          />
        </div>
        <div className="mx-auto flex h-12 w-full max-w-md items-center justify-between px-4 md:max-w-xl">
          {canGoBack ? (
            <button
              type="button"
              onClick={() => goTo(backTarget, -1)}
              className="flex h-11 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              {c.back}
            </button>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-0.5">
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {c.stepOf(state.step)}
            </span>
            {state.step < 6 && (
              <button
                type="button"
                onClick={() => setLocation("/dashboard")}
                aria-label={c.exitWizard}
                title={c.exitWizard}
                className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </span>
        </div>
      </div>

      {/* Screen content */}
      <main className="mx-auto w-full max-w-md px-6 pt-24 pb-44 md:max-w-xl md:pt-28">
        <AnimatePresence mode="wait" custom={exitDirection}>
          <motion.div
            key={state.step}
            custom={exitDirection}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduceMotion ? 0.15 : 0.35, ease: EASE }}
          >
            {/* ---------------------------------------------------------- 1 */}
            {state.step === 1 && (
              <div className="space-y-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Globe className="h-6 w-6 text-primary" aria-hidden />
                </div>
                <ScreenHeading title={c.s1Title} support={c.s1Support} headingRef={headingRef} />
                <div className="space-y-2">
                  <input
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-label={c.s1Title}
                    aria-invalid={Boolean(urlError)}
                    placeholder={c.s1Placeholder}
                    value={state.url}
                    onChange={(e) => {
                      patch({ url: e.target.value });
                      if (urlError) setUrlError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") startFromUrl();
                    }}
                    className={cn(
                      "h-14 w-full rounded-xl border bg-card px-4 text-center text-lg",
                      "placeholder:text-muted-foreground",
                      "transition-shadow focus:outline-none focus:ring-[3px] focus:ring-ring/40 focus:border-ring",
                      urlError && "border-destructive focus:ring-destructive/30"
                    )}
                  />
                  {urlError && (
                    <p role="alert" className="text-sm text-destructive">
                      {urlError}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ---------------------------------------------------------- 2 */}
            {state.step === 2 && (
              <div className="space-y-8">
                <PenLoader className="h-9 w-[4.5rem]" />
                <ScreenHeading title={c.s2Title} support={c.s2Support} headingRef={headingRef} />
                {!analysisError ? (
                  <ul aria-live="polite" className="space-y-4">
                    {c.s2Lines.slice(0, doneLines + 1).map((line, i) => {
                      const done = i < doneLines || Boolean(state.analysis && doneLines >= c.s2Lines.length);
                      return (
                        <motion.li
                          key={line}
                          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, ease: EASE }}
                          className="flex items-center gap-3"
                        >
                          <span
                            className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                              done
                                ? "border-transparent bg-[var(--success)] text-white"
                                : "border-border text-transparent"
                            )}
                          >
                            {done ? (
                              <Check className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                              <span
                                aria-hidden
                                className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-primary/30 border-t-primary"
                              />
                            )}
                          </span>
                          <span
                            className={cn(
                              "text-[0.9375rem]",
                              done ? "text-foreground" : "text-muted-foreground"
                            )}
                          >
                            {line}
                          </span>
                        </motion.li>
                      );
                    })}
                  </ul>
                ) : (
                  <div role="alert" className="rounded-xl border bg-card p-5">
                    <p className="text-[0.9375rem] leading-relaxed">{analysisError}</p>
                  </div>
                )}
              </div>
            )}

            {/* ---------------------------------------------------------- 3 */}
            {state.step === 3 && (
              <div className="space-y-8">
                <ScreenHeading
                  title={c.s3Title}
                  support={state.manual ? c.s3SupportManual : c.s3Support}
                  headingRef={headingRef}
                />
                <div className="space-y-3">
                  {(
                    [
                      { key: "industry" as const, label: c.s3Industry, value: profile?.industry || c.s3IndustryFallback },
                      { key: "tone" as const, label: c.s3Tone, value: profile?.toneLabel || TONE_LABELS[language].friendly },
                      { key: "audience" as const, label: c.s3Audience, value: profile?.audience || c.s3AudienceFallback },
                    ]
                  ).map((card, i) => (
                    <motion.div
                      key={card.key}
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, ease: EASE, delay: reduceMotion ? 0 : i * 0.07 }}
                      className="flex items-start justify-between gap-3 rounded-xl border bg-card p-5"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                        <p className="text-[0.9375rem] font-medium leading-snug">{card.value}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          sheetReturnFocusRef.current = e.currentTarget;
                          setEditing(card.key);
                          setEditValue(
                            card.key === "tone" ? profile?.toneKey ?? "friendly" : card.value
                          );
                        }}
                        className="flex h-11 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm text-primary transition-colors hover:bg-primary/5"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        {c.s3Edit}
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* ---------------------------------------------------------- 4 */}
            {state.step === 4 && (
              <div className="space-y-8">
                <ScreenHeading title={c.s4Title} support={c.s4Support} headingRef={headingRef} />
                <div className="space-y-3">
                  {/* LinkedIn — the real, wired channel */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!state.connected) void startLinkedInConnect();
                    }}
                    className={cn(
                      "flex h-16 w-full items-center gap-4 rounded-xl border bg-card px-5 text-left transition-all",
                      state.connected
                        ? "border-[var(--success)]/40"
                        : "hover:border-primary/50 hover:shadow-sm active:scale-[0.995]"
                    )}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0A66C2] text-base font-bold text-white">
                      in
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.9375rem] font-semibold">LinkedIn</span>
                      {state.connected && (
                        <span className="block truncate text-sm text-[var(--success)]">
                          {c.s4Connected(connectedName)}
                        </span>
                      )}
                    </span>
                    {state.connected ? (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--success)] text-white success-pulse">
                        <Check className="h-4 w-4" aria-hidden />
                      </span>
                    ) : (
                      <ArrowRight className="h-5 w-5 text-muted-foreground" aria-hidden />
                    )}
                  </button>

                  {/* Not wired yet — honest, not clickable */}
                  {[
                    { name: "Facebook", chip: "f", bg: "#1877F2" },
                    { name: "Instagram", chip: "ig", bg: "linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)" },
                  ].map((p) => (
                    <div
                      key={p.name}
                      aria-disabled="true"
                      className="flex h-16 w-full items-center gap-4 rounded-xl border border-dashed bg-card/60 px-5"
                    >
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-base font-bold text-white"
                        style={{ background: p.bg }}
                      >
                        {p.chip}
                      </span>
                      <span className="flex-1 text-[0.9375rem] font-semibold text-muted-foreground">
                        {p.name}
                      </span>
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                        {c.s4Soon}
                      </span>
                    </div>
                  ))}
                </div>
                {connectError && (
                  <p role="alert" className="text-sm text-destructive">
                    {connectError}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">{c.s4More}</p>
              </div>
            )}

            {/* ---------------------------------------------------------- 5 */}
            {state.step === 5 && (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-3">
                  <ScreenHeading title={c.s5Title} support={c.s5Support} headingRef={headingRef} />
                  {pending.length > 0 && (
                    <span
                      aria-live="polite"
                      className="mt-1 shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-semibold tabular-nums text-secondary-foreground"
                    >
                      {c.s5Queue(pending.length)}
                    </span>
                  )}
                </div>

                {activeItem ? (
                  <>
                    <AnimatePresence mode="popLayout" custom={lastDecisionRef.current}>
                      <motion.div
                        key={activeItem.postId}
                        custom={lastDecisionRef.current}
                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        variants={{
                          // Exit follows the decision: approve slides right, skip left —
                          // matching the swipe affordance the copy promises.
                          exit: (decision: "approved" | "skipped") =>
                            reduceMotion
                              ? { opacity: 0 }
                              : {
                                  opacity: 0,
                                  x: decision === "skipped" ? -120 : 120,
                                  transition: { duration: 0.25 },
                                },
                        }}
                        exit="exit"
                        transition={{ duration: 0.35, ease: EASE }}
                      >
                        <SwipeCard
                          item={activeItem}
                          companyInitial={companyInitial}
                          companyName={companyName}
                          onApprove={() => decideActive("approved")}
                          onSkip={() => decideActive("skipped")}
                          approveLabel={c.s5Approved}
                          skipLabel={c.s5Skipped}
                        />
                      </motion.div>
                    </AnimatePresence>

                    {/* ✓ / ✗ + refine (sizes clear 320px viewports: 2×56 + pill + gaps ≤ 272px) */}
                    <div className="flex items-center justify-center gap-4 sm:gap-6">
                      <button
                        type="button"
                        onClick={() => decideActive("skipped")}
                        aria-label={c.s5SkipPost}
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card text-muted-foreground shadow-sm transition-all hover:border-destructive/50 hover:text-destructive active:scale-95 sm:h-16 sm:w-16"
                      >
                        <X className="h-7 w-7" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          sheetReturnFocusRef.current = e.currentTarget;
                          setRefineOpen(true);
                        }}
                        className="flex h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/5 sm:px-4"
                      >
                        <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
                        {c.s5Refine}
                      </button>
                      <button
                        type="button"
                        onClick={() => decideActive("approved")}
                        aria-label={c.s5Approve}
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--success)] text-white shadow-lg shadow-emerald-600/25 transition-all hover:opacity-95 active:scale-95 sm:h-16 sm:w-16"
                      >
                        <Check className="h-8 w-8" aria-hidden />
                      </button>
                    </div>
                  </>
                ) : genProgress ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border bg-card p-5">
                      <div className="skeleton mb-3 h-4 w-2/5 rounded" />
                      <div className="skeleton mb-2 h-3 w-full rounded" />
                      <div className="skeleton mb-2 h-3 w-full rounded" />
                      <div className="skeleton h-3 w-3/4 rounded" />
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <PenLoader />
                      <p aria-live="polite" className="text-sm text-muted-foreground">
                        {c.s5Writing(genProgress.current, genProgress.total)}
                      </p>
                    </div>
                  </div>
                ) : genError ? (
                  <div role="alert" className="rounded-xl border bg-card p-5">
                    <p className="text-[0.9375rem] leading-relaxed">{genError}</p>
                  </div>
                ) : null}
              </div>
            )}

            {/* ---------------------------------------------------------- 6 */}
            {state.step === 6 && (
              <div className="flex flex-col items-center space-y-8 pt-10 text-center">
                <motion.div
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="success-pulse flex h-20 w-20 items-center justify-center rounded-full bg-[var(--success)] text-white"
                >
                  <Check className="h-10 w-10" aria-hidden strokeWidth={2.5} />
                </motion.div>
                <ScreenHeading
                  title={c.s6Title}
                  support={state.connected ? c.s6SupportConnected : c.s6SupportNotConnected}
                  headingRef={headingRef}
                />
                {state.approvedCount > 0 && state.connected && (
                  <p className="text-sm text-muted-foreground">
                    {language === "no"
                      ? `${state.approvedCount} innlegg er lagt i kalenderen.`
                      : `${state.approvedCount} ${state.approvedCount === 1 ? "post is" : "posts are"} on the calendar.`}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ------------------------------------------------ fixed action bar */}
      <ActionBar>
        {state.step === 1 && (
          <>
            <p className="pb-2 text-center text-xs leading-relaxed text-muted-foreground">
              {c.s1Consent}
            </p>
            <PrimaryButton onClick={startFromUrl}>
              {c.s1Cta}
              <ArrowRight className="h-5 w-5" aria-hidden />
            </PrimaryButton>
            <SkipLink
              onClick={() => {
                updateConsent.mutate({ consent: 1 });
                patch({ step: 3, manual: true });
              }}
            >
              {c.s1Skip}
            </SkipLink>
          </>
        )}

        {state.step === 2 && analysisError && (
          <>
            <PrimaryButton onClick={runAnalysis} busy={analyzeWebsite.isPending}>
              {c.s2Retry}
            </PrimaryButton>
            <SkipLink onClick={() => patch({ step: 3, manual: true })}>{c.s2SkipManual}</SkipLink>
          </>
        )}

        {state.step === 3 && (
          <PrimaryButton
            busy={confirmBusy}
            onClick={() => {
              const p = profile;
              setConfirmBusy(true);
              confirmProfile.mutate(
                {
                  companyName: p?.companyName || undefined,
                  industry: p?.industry || c.s3IndustryFallback,
                  toneKey: p?.toneKey ?? "friendly",
                  toneLabel: p?.toneLabel || TONE_LABELS[language].friendly,
                  audience: p?.audience || c.s3AudienceFallback,
                  topics: p?.topics ?? [],
                  language: p?.language ?? (language as "no" | "en"),
                },
                {
                  onSuccess: () => {
                    setConfirmBusy(false);
                    goTo(4);
                  },
                  onError: (e) => {
                    setConfirmBusy(false);
                    toast.error(friendlyError(e, c));
                  },
                }
              );
            }}
          >
            {c.s3Cta}
            <ArrowRight className="h-5 w-5" aria-hidden />
          </PrimaryButton>
        )}

        {state.step === 4 && (
          <>
            <PrimaryButton
              onClick={() => {
                if (state.connected) goTo(5);
                else void startLinkedInConnect();
              }}
            >
              {state.connected ? c.s4CtaConnected : c.s4Cta}
              <ArrowRight className="h-5 w-5" aria-hidden />
            </PrimaryButton>
            {!state.connected && (
              <SkipLink onClick={() => patch({ step: 5, skippedConnect: true })}>
                {c.s4Skip}
              </SkipLink>
            )}
          </>
        )}

        {state.step === 5 &&
          (genError && pending.length === 0 ? (
            <PrimaryButton
              onClick={() => {
                if (genError === c.s5Verify || /bekreft|confirm/i.test(genError)) {
                  generationStartedRef.current = false;
                  patch({ generated: false });
                  setGenError(null);
                } else {
                  goTo(6);
                }
              }}
            >
              {genError === c.s5Verify || /bekreft|confirm/i.test(genError)
                ? c.s5VerifyCta
                : c.s5Continue}
            </PrimaryButton>
          ) : (
            (pending.length > 0 || genProgress !== null) && (
              <SkipLink onClick={() => goTo(6)}>{c.s5SkipAll}</SkipLink>
            )
          ))}

        {state.step === 6 && (
          <PrimaryButton onClick={finish}>
            {c.s6Cta}
            <ArrowRight className="h-5 w-5" aria-hidden />
          </PrimaryButton>
        )}
      </ActionBar>

      {/* ------------------------------------------- edit sheet (ONE field) */}
      <AnimatePresence>
        {editing && (
          <>
            <motion.button
              type="button"
              aria-label={c.close}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeEditSheet}
              className="fixed inset-0 z-40 bg-black/30"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={
                editing === "industry"
                  ? c.s3EditIndustry
                  : editing === "tone"
                    ? c.s3EditTone
                    : c.s3EditAudience
              }
              onKeyDown={(e) => trapSheetKeys(e, closeEditSheet)}
              initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
              animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
              transition={{ duration: 0.35, ease: EASE }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:bottom-8 md:mx-auto md:w-full md:max-w-xl md:rounded-2xl md:border md:pb-6 md:shadow-xl"
            >
              <div className="mx-auto w-full max-w-md space-y-5">
                <p className="text-base font-semibold">
                  {editing === "industry"
                    ? c.s3EditIndustry
                    : editing === "tone"
                      ? c.s3EditTone
                      : c.s3EditAudience}
                </p>

                {editing === "tone" ? (
                  <div className="flex flex-wrap gap-2" role="group" aria-label={c.s3Tone}>
                    {(Object.keys(TONE_LABELS[language]) as ToneKey[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={editValue === key}
                        onClick={() => setEditValue(key)}
                        className={cn(
                          "h-11 rounded-full border px-4 text-sm font-medium transition-colors",
                          editValue === key
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-card hover:border-primary/50"
                        )}
                      >
                        {TONE_LABELS[language][key]}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    autoFocus
                    type="text"
                    value={editValue}
                    maxLength={editing === "industry" ? 100 : 280}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-13 w-full rounded-xl border bg-background px-4 py-3 text-base focus:outline-none focus:ring-[3px] focus:ring-ring/40 focus:border-ring"
                  />
                )}

                <PrimaryButton
                  onClick={() => {
                    const base: Analysis =
                      profile ?? {
                        companyName: companyName,
                        industry: c.s3IndustryFallback,
                        toneKey: "friendly",
                        toneLabel: TONE_LABELS[language].friendly,
                        audience: c.s3AudienceFallback,
                        topics: [],
                        language: language as "no" | "en",
                        sourceUrl: "",
                      };
                    const next: Analysis =
                      editing === "industry"
                        ? { ...base, industry: editValue.trim() || base.industry }
                        : editing === "tone"
                          ? {
                              ...base,
                              toneKey: editValue as ToneKey,
                              toneLabel: TONE_LABELS[language][editValue as ToneKey],
                            }
                          : { ...base, audience: editValue.trim() || base.audience };
                    patch({ analysis: next });
                    closeEditSheet();
                  }}
                >
                  {c.s3Save}
                </PrimaryButton>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------ refine sheet */}
      <AnimatePresence>
        {refineOpen && activeItem && (
          <>
            <motion.button
              type="button"
              aria-label={c.close}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeRefineSheet}
              className="fixed inset-0 z-40 bg-black/30"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={c.s5Refine}
              onKeyDown={(e) => trapSheetKeys(e, closeRefineSheet)}
              initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
              animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
              transition={{ duration: 0.35, ease: EASE }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:bottom-8 md:mx-auto md:w-full md:max-w-xl md:rounded-2xl md:border md:pb-6 md:shadow-xl"
            >
              <div className="mx-auto w-full max-w-md space-y-5">
                <p className="text-base font-semibold">{c.s5Refine}</p>
                <textarea
                  autoFocus
                  rows={3}
                  value={refineText}
                  maxLength={500}
                  onChange={(e) => setRefineText(e.target.value)}
                  placeholder={c.s5RefinePlaceholder}
                  className="w-full resize-none rounded-xl border bg-background px-4 py-3 text-base placeholder:text-muted-foreground/70 focus:outline-none focus:ring-[3px] focus:ring-ring/40 focus:border-ring"
                />
                <PrimaryButton
                  busy={refinePost.isPending}
                  disabled={refineText.trim().length < 2}
                  onClick={() => {
                    refinePost.mutate(
                      { postId: activeItem.postId, instruction: refineText.trim() },
                      {
                        onSuccess: (res) => {
                          setState((s) => ({
                            ...s,
                            queue: s.queue.map((q) =>
                              q.postId === activeItem.postId ? { ...q, content: res.content } : q
                            ),
                          }));
                          setRefineText("");
                          closeRefineSheet();
                        },
                        onError: (e) => toast.error(friendlyError(e, c)),
                      }
                    );
                  }}
                >
                  {c.s5RefineCta}
                </PrimaryButton>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
