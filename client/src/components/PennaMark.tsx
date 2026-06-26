/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Penna brand mark (speech bubble + pen). Single source of truth for the logo icon.
 */

export function PennaMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Penna"
    >
      <defs>
        <linearGradient id="pennaMarkGrad" x1="20" y1="16" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2563EB" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <path
        d="M40 18 H92 a18 18 0 0 1 18 18 V70 a18 18 0 0 1 -18 18 H44 l-16 16 a2 2 0 0 1 -3.4 -1.4 V88 H40 a18 18 0 0 1 -18 -18 V36 a18 18 0 0 1 18 -18 Z"
        stroke="url(#pennaMarkGrad)"
        strokeWidth="9"
        strokeLinejoin="round"
      />
      <g stroke="url(#pennaMarkGrad)" strokeWidth="6.5" strokeLinecap="round">
        <line x1="40" y1="40" x2="84" y2="40" />
        <line x1="40" y1="54" x2="90" y2="54" />
        <line x1="40" y1="68" x2="68" y2="68" />
      </g>
      <path d="M104 26 L70 76 l8.5 8.5 L116 38 Z" fill="#0B132B" />
      <path d="M70 76 l8.5 8.5 l-13 4.5 Z" fill="#0B132B" />
      <line x1="100.5" y1="33.5" x2="74.5" y2="80" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="86" cy="58.5" r="3.2" fill="#FFFFFF" />
    </svg>
  );
}

export default PennaMark;
