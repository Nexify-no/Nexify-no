/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Single source of truth for legal / contact identity.
 *
 * Why this file exists: the same phone number, address and org.nr were
 * hand-copied into the footer, Salgsbetingelser, JSON-LD and the Contact page.
 * They drifted — Contact.tsx shipped a placeholder number (+47 123 45 678) and
 * a literal "[Adresse]" to production, where Google indexed it. Norwegian
 * e-commerce law (angrerettloven / markedsføringsloven) requires accurate,
 * consistent seller identification on the public site, so this is a compliance
 * surface, not just a copy detail.
 *
 * Every place that renders contact or seller identity MUST import from here.
 * Client and server both consume it (the SSR layer in server/routes/*Ssr.ts and
 * the React pages), so it lives in shared/.
 */

export const COMPANY = {
  /** Legal entity behind the Penna product. */
  legalName: "Nexify CRM Systems AS",
  /** Product/brand name shown to users. */
  brand: "Penna",
  /** Norwegian organisation number, grouped for display. */
  orgNr: "936 300 278",
  /** Same number without spaces — for schema.org / machine consumers. */
  orgNrCompact: "936300278",

  email: "support@penna.no",

  /** Display form, e.g. in a footer or contact card. */
  phone: "+47 921 46 050",
  /** RFC 3966 form for tel: links. Must always match `phone`. */
  phoneHref: "tel:+4792146050",

  address: {
    street: "Nedre Sølen 5",
    postalCode: "3913",
    city: "Porsgrunn",
    country: "Norge",
    countryCode: "NO",
  },

  /** Support availability, shown next to the phone number. */
  supportHours: "Mandag – fredag: 09:00 – 17:00",
  /** Promise we make on the contact form. Keep in sync with reality. */
  emailResponseTime: "Vi svarer normalt innen 24 timer",

  social: {
    linkedin: "https://www.linkedin.com/company/penna-no/",
    instagram: "https://www.instagram.com/penna.no/",
    x: "https://x.com/Penna0no",
    facebook: "https://www.facebook.com/profile.php?id=61591542924941",
  },
} as const;

/** "Nedre Sølen 5, 3913 Porsgrunn" — one-line address without country. */
export function addressLine(): string {
  const a = COMPANY.address;
  return `${a.street}, ${a.postalCode} ${a.city}`;
}

/** "Nedre Sølen 5, 3913 Porsgrunn, Norge" — full postal address. */
export function addressFull(): string {
  return `${addressLine()}, ${COMPANY.address.country}`;
}

/** schema.org PostalAddress node, for JSON-LD blocks. */
export function postalAddressLd() {
  const a = COMPANY.address;
  return {
    "@type": "PostalAddress",
    streetAddress: a.street,
    postalCode: a.postalCode,
    addressLocality: a.city,
    addressCountry: a.countryCode,
  } as const;
}
