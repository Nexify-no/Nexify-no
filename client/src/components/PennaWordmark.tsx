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
 * Full-screen brand opening (v2, cinematic): the quill drops onto the page
 * (ink dot), the logotype is revealed pixel-synced behind the travelling
 * tip, the pen lifts, glides back and sweeps an ink underline sampled from
 * the same bézier the ink draws, and the promise line rises word by word.
 * Tap / Enter / Escape skips. Under prefers-reduced-motion it never shows
 * (onDone fires immediately).
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

      <svg viewBox="0 0 224 88" aria-hidden="true" className="relative w-[min(74vw,470px)]">
        <defs>
          <mask id="penna-reveal">
            <rect className="pintro-reveal" x="0" y="0" width="0" height="88" fill="#fff" />
          </mask>
        </defs>
        <circle className="pintro-inkdot" cx="9" cy="58" r="2.4" />
        <text x="6" y="50" mask="url(#penna-reveal)" className="pintro-word">
          Penna
        </text>
        <path className="pintro-underline" d="M10 62 Q112 74 214 56" />
        <g className="pintro-nib">
          <QuillNib scale={0.5} />
        </g>
      </svg>

      <p className="flex max-w-sm flex-wrap justify-center gap-x-[0.3em] text-center text-base text-muted-foreground md:text-lg">
        {words.map((w, i) => (
          <motion.span
            key={`${w}-${i}`}
            initial={{ opacity: 0, y: 9 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.55 + i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
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
