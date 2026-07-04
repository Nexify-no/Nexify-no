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
 * Full-screen brand opening: the quill writes "Penna" large in the centre,
 * glides back and sweeps an ink underline, the promise line fades in, then
 * the whole scene dissolves into the wizard. Tap / Enter / Escape skips.
 * Under prefers-reduced-motion it never shows (onDone fires immediately).
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
    const t = setTimeout(finish, reduceMotion ? 0 : 3150);
    return () => clearTimeout(t);
  }, [finish, reduceMotion]);

  if (reduceMotion) return null;

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
      exit={{ opacity: 0, transition: { duration: 0.45, ease: "easeOut" } }}
      className="fixed inset-0 z-[60] flex cursor-pointer flex-col items-center justify-center gap-7 bg-background px-8"
    >
      <svg viewBox="0 0 224 88" aria-hidden="true" className="w-[min(72vw,460px)]">
        <text x="6" y="50" className="penna-word penna-intro-word">
          Penna
        </text>
        <path className="penna-intro-underline" d="M10 62 Q112 74 214 56" />
        <g className="penna-intro-nib">
          <QuillNib scale={0.5} />
        </g>
      </svg>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-sm text-center text-base text-muted-foreground md:text-lg"
      >
        {tagline}
      </motion.p>
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
