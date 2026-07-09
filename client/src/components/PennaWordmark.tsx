/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Brand motion, straight from the logo: the SAME quill that lives in
 * PennaMark travels the baseline while the "Penna" wordmark writes itself
 * (stroke draw → ink fill). Used as the wizard's opening moment.
 * `PenLoader` is the small looping companion shown whenever the AI is
 * writing. Pure CSS (keyframes in index.css), covered by
 * prefers-reduced-motion.
 */

import { useCallback, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { SIG_WORD, SIG_STROKE_P, SIG_STROKE_E } from "@/components/pennaSignature";

/**
 * The quill from PennaMark (same 128-viewBox geometry), tip normalized to
 * (0, 0) so animation keyframes position the exact writing point.
 */
function QuillNib({ scale }: { scale: number }) {
  return (
    <g transform={`scale(${scale}) translate(-65.5 -89)`}>
      <path d="M104 26 L70 76 l8.5 8.5 L116 38 Z" fill="currentColor" />
      <path d="M70 76 l8.5 8.5 l-13 4.5 Z" fill="currentColor" />
      <line
        x1="100.5"
        y1="33.5"
        x2="74.5"
        y2="80"
        stroke="var(--background)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </g>
  );
}

export function PennaWordmark({
  className,
  still = false,
}: {
  className?: string;
  /** Render the finished wordmark without replaying the writing animation. */
  still?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 224 64"
      role="img"
      aria-label="Penna"
      className={cn("h-14 w-auto", still && "penna-still", className)}
    >
      <text x="6" y="46" className="penna-word">
        Penna
      </text>
      <g className="penna-nib" aria-hidden="true">
        <QuillNib scale={0.4} />
      </g>
    </svg>
  );
}

/**
 * Full-screen brand opening (v3, signature): "Penna" set in a real cursive
 * (Sacramento) is written stroke by stroke — the quill follows the SAME
 * hand-authored centerlines that drive the ink-reveal mask (animateMotion +
 * mpath), so pen and ink are geometrically locked. Two strokes with a pen
 * lift between them (P, then enna), ink dot on touchdown, promise line
 * rising word by word, then the scene dissolves into the official Space
 * Grotesk wordmark on the chooser. Tap / Enter / Escape skips. Under
 * prefers-reduced-motion it never shows (onDone fires immediately).
 */
export function PennaIntro({ tagline, onDone }: { tagline: string; onDone: () => void }) {
  const reduceMotion = useReducedMotion();
  const doneRef = useRef(false);
  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }, [onDone]);

  useEffect(() => {
    const t = setTimeout(finish, reduceMotion ? 0 : 3600);
    return () => clearTimeout(t);
  }, [finish, reduceMotion]);

  if (reduceMotion) return null;

  const words = tagline.split(" ");

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={tagline}
      onClick={finish}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "Escape") finish();
      }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.985, transition: { duration: 0.5, ease: "easeOut" } }}
      className="fixed inset-0 z-[60] flex cursor-pointer flex-col items-center justify-center gap-7 bg-background px-8"
    >
      {/* quiet radial depth behind the word */}
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="pointer-events-none absolute left-1/2 top-1/2 h-[52vmin] w-[52vmin] -translate-x-1/2 -translate-y-[58%] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, oklch(0.54 0.22 262 / 0.09), transparent 72%)",
        }}
      />

      <svg viewBox="-2 -62 188 74" aria-hidden="true" className="relative w-[min(76vw,480px)]">
        <defs>
          <mask id="penna-sig-mask" maskUnits="userSpaceOnUse" x="-2" y="-62" width="188" height="74">
            <path id="penna-sig-p" className="sig-stroke sig-p" pathLength={100} d={SIG_STROKE_P} />
            <path id="penna-sig-e" className="sig-stroke sig-e" pathLength={100} d={SIG_STROKE_E} />
          </mask>
        </defs>
        {/* ink dot where the pen first touches the page */}
        <circle className="sig-inkdot" cx="14" cy="-3" r="2" />
        {/* the signature, revealed only where the pen has written */}
        <path d={SIG_WORD} className="sig-word" mask="url(#penna-sig-mask)" />
        {/* the quill rides the exact same centerlines (SMIL animateMotion).
            Raw markup: mpath is not in React's JSX types. */}
        <g
          className="sig-nib"
          dangerouslySetInnerHTML={{
            __html:
              '<g transform="scale(0.5) translate(-65.5 -89)">' +
              '<path d="M104 26 L70 76 l8.5 8.5 L116 38 Z" fill="currentColor"/>' +
              '<path d="M70 76 l8.5 8.5 l-13 4.5 Z" fill="currentColor"/>' +
              '<line x1="100.5" y1="33.5" x2="74.5" y2="80" stroke="var(--background)" stroke-width="2.2" stroke-linecap="round"/>' +
              "</g>" +
              '<animateMotion begin="0.35s" dur="0.85s" fill="freeze" calcMode="linear"><mpath href="#penna-sig-p"/></animateMotion>' +
              '<animateMotion begin="1.28s" dur="1.2s" fill="freeze" calcMode="linear"><mpath href="#penna-sig-e"/></animateMotion>',
          }}
        />
      </svg>

      <p className="flex max-w-sm flex-wrap justify-center gap-x-[0.3em] text-center text-base text-muted-foreground md:text-lg">
        {words.map((w, i) => (
          <motion.span
            key={`${w}-${i}`}
            initial={{ opacity: 0, y: 9 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.35 + i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {w}
          </motion.span>
        ))}
      </p>
    </motion.div>
  );
}

/** Small looping "pen writing" indicator for AI-working states. */
export function PenLoader({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 32"
      aria-hidden="true"
      className={cn("h-8 w-16 text-primary", className)}
    >
      <path
        className="pen-loader-path"
        d="M4 22 Q10 12 16 19 T28 18 T40 19 T52 17"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <g className="pen-loader-nib">
        <g transform="translate(4 22)">
          <QuillNib scale={0.24} />
        </g>
      </g>
    </svg>
  );
}
