/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Does this Merkehjerne actually describe the brand it is attached to?
 *
 * It is a fair question because for a while the answer could be no. Legacy
 * adoption stamped an unowned Merkehjerne onto whichever brand happened to be
 * active, so an account could end up with a brand named "Penna.no" whose
 * Merkehjerne described ballongforfest.no — and then every generated post came
 * out in a balloon company's voice, with a balloon company's services and
 * audience, on Penna's channels. The adoption bug is fixed in
 * services/brands.ts; this exists because the rows it already wrote are still
 * out there, and a wrong Merkehjerne is wrong silently.
 *
 * Deliberately conservative. It only reports a mismatch on evidence the row
 * carries about itself — the site it was built from and the company it names —
 * and only when that evidence CONTRADICTS the brand rather than merely
 * differing. A brand called "Min bedrift" contradicts nothing; neither does a
 * missing website. False alarms on this banner would teach the user to ignore it.
 */

/** Compare hosts, ignoring scheme, www., trailing slash, port and case. */
export function normalizeHost(url: string | null | undefined): string | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/**
 * Letters and digits only, lowercased — so "Ballong For Fest AS" ≠ "Penna.no".
 *
 * No company-form stripping ("AS", "Ltd", …). It was here, and it was dead
 * weight: the substring rule below already treats "Penna AS" and "Penna" as one
 * brand, so stripping changed no outcome — a mutation removing it failed no
 * test, which is the honest signal that it earned nothing.
 */
function normalizeName(name: string | null | undefined): string | null {
  return (name ?? "").toLowerCase().replace(/[^a-z0-9æøå]+/g, "") || null;
}

export interface MismatchInput {
  brandName: string | null | undefined;
  brandWebsiteUrl: string | null | undefined;
  profileCompanyName: string | null | undefined;
  profileWebsiteUrl: string | null | undefined;
}

export interface MismatchResult {
  mismatch: boolean;
  /** What the Merkehjerne says it describes — shown to the user, never guessed. */
  profileDescribes: string | null;
}

/**
 * True only when the profile positively contradicts the brand.
 *
 * Host beats name: the site is what the Merkehjerne was actually built from, and
 * a user may legitimately rename a brand without it becoming a different company.
 * A name difference alone is only a contradiction when neither side has a host to
 * settle it.
 */
export function detectBrandMismatch(input: MismatchInput): MismatchResult {
  const profileDescribes =
    input.profileCompanyName?.trim() || normalizeHost(input.profileWebsiteUrl) || null;

  const brandHost = normalizeHost(input.brandWebsiteUrl);
  const profileHost = normalizeHost(input.profileWebsiteUrl);

  if (brandHost && profileHost) {
    return { mismatch: brandHost !== profileHost, profileDescribes };
  }

  // No host on one side. Fall back to the names, but only when BOTH are known —
  // "Min bedrift" (the auto-created default) carries no claim to contradict.
  const brandName = normalizeName(input.brandName);
  const profileName = normalizeName(input.profileCompanyName);
  if (!brandName || !profileName) return { mismatch: false, profileDescribes };
  if (brandName === "minbedrift") return { mismatch: false, profileDescribes };

  // Substring either way counts as agreement: "Penna" vs "Penna.no", or a brand
  // named after a longer legal entity.
  const agrees = brandName.includes(profileName) || profileName.includes(brandName);
  return { mismatch: !agrees, profileDescribes };
}
