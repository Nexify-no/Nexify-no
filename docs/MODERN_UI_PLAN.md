# Penna Modern SaaS UI — plan og status

> Penna er ikke et tradisjonelt dashbord. Det er en assistent som fører en norsk
> småbedrift fra et forretningsmål til publiseringsklart innhold.
>
> **Mål → plan → innhold → uttrykk → forhåndsvisning → planlegging → resultater.**
> Én hovedbeslutning per skjerm.

**Feature flag:** `VITE_FEATURE_NEW_SHELL`

```ts
const newShellEnabled = import.meta.env.VITE_FEATURE_NEW_SHELL === "true";
```

Streng `=== "true"`-sammenligning. `Boolean(import.meta.env.X)` er feil her:
strengen `"false"` er truthy.

| Verdi | Oppførsel |
|---|---|
| `true` | `AppSidebar` + `.penna-app`-tema |
| `false` | `DashboardNav`, dagens oppførsel, ordrett |
| ikke satt | `DashboardNav`, dagens oppførsel, ordrett |

**Dette er et build-time-flagg.** Vite erstatter verdien ved kompilering, så en
endring på Render krever **Save, rebuild, and deploy** — et rent redeploy
gjenbruker forrige build og den nye verdien når aldri bundelen. Flagget er
derfor *ikke* en runtime kill switch; et øyeblikkelig av-brytere ville krevd et
server- eller DB-styrt flagg (ikke i scope).

Tilbakerulling: sett `false` og rebuild, eller **Deploys → Rollback**.

---

## Arkitektur — det finnes allerede et felles shell

```
App.tsx
  └── PageLayout            ← montert på App-nivå, gjelder alle ruter
        ├── DashboardNav    ← eller AppSidebar når flagget er på
        └── sideinnhold
```

`PageLayout` bestemmer sidebar-synlighet ut fra en **svarteliste**
(`noSidebarExact`), slik at nye app-sider får sidebar automatisk.

Konsekvenser:

- Ikke bygg et parallelt shell. Videreutvikle `PageLayout` bakoverkompatibelt.
- Ikke migrer 63 sider manuelt.
- `.penna-app` skal **ikke** nå Landing, Pricing, Blog eller Legal-sidene.

Det nye shellet vises kun når **begge** stemmer: ruten er en app-side som
`PageLayout` allerede gir sidebar, **og** flagget er på.

---

## Designstrategi — scoped tema, ikke `:root`

`:root` er blå i dag. Å bytte den ville endret alle 63 sider, inkludert
markedsføring og juridiske sider, i samme sekund.

I stedet: `client/src/styles/penna-theme.css` definerer alt under `.penna-app`.
Det virker fordi `index.css` mapper farger indirekte:

```css
@theme inline { --color-primary: var(--primary); }
```

Å redefinere `--primary` på et forfedreelement forplanter seg til alle
shadcn/ui-utilities inne i det — uten å endre en enkelt komponent.

| Token | Verdi |
|---|---|
| Primary green | `#0E5C3A` |
| Pale sage | `#E6F0EA` |
| Amber (insights) | `#F2B233` |
| App-bakgrunn | `#FAF9F6` |
| Kort | `#FFFFFF` |
| Hovedtekst | `#111827` |
| Dempet tekst | `#6B7280` |
| Kantlinjer | `#E5E7EB` |
| Radius | `15px` |

Skrift: `DM Sans` + `Space Grotesk` — prosjektets egne. Ingen Inter, ingen Geist.

Forbudt: dark sidebar, glassmorphism, neon, tunge gradienter, tunge skygger.

---

## Enkel og Avansert

Kilde: `users.view_mode`, lest via `trpc.user.getViewMode`. Ingen nytt API.
Navigasjonen for det nye shellet bor i én ren modul, `navItems.ts`.

**Enkel — nøyaktig seks:**

| Etikett | Rute |
|---|---|
| Oversikt | `/dashboard` |
| Nytt innhold | `/generer` |
| Innholdsplan | `/innholdsplan` |
| Publisert | `/innlegg` |
| Resultater | `/analytics` |
| Merkevare | `/merkehjerne` |

**Avansert:** hele dagens liste, 22 destinasjoner. Ingen avansert rute fjernes
eller skjules for en Avansert-bruker.

`navItems.test.ts` fester dette: Enkel har seks, Avansert mister ingen,
ingen duplikater, og ingen avansert-only rute lekker inn i Enkel.

`DashboardNav` beholdes som fallback og slettes først når flagget fjernes.

---

## Ruter

Norske aliaser og engelske originaler finnes side om side i `App.tsx`
(`/generer` og `/generate`, `/innlegg` og `/posts`). Shellet bruker de norske,
som er de `DashboardNav` allerede bruker, så aktiv-markeringen ikke flytter seg
under brukeren. Ingen rute fjernes eller får nytt navn.

`/kalender` fortsetter å virke selv om `/innholdsplan` er hovedlenken i Enkel.

---

## Puljer

| # | Pulje | Status |
|---|---|---|
| 1 | Scoped tokens + `AppSidebar` + `PageLayout`-flagg + tester | **skrevet og verifisert** |
| 2 | Delte komponenter + Loading/Empty/Error-tilstander | planlagt |
| 3 | `Oversikt` — målvalg, ukeplan, én reell anbefaling | planlagt |
| 4 | `Nytt innhold` — tre steg (`Generate.tsx`, ~1695 linjer) | **høyest risiko** |
| 5 | `Innholdsplan` + `Publisert` | planlagt |
| 6 | `Merkevare` | planlagt |
| 7 | `Resultater` | planlagt |

Én pulje = én branch = én PR. Grønn CI, Before/After-bilder, review, merge —
før neste starter. Ingen stacked PRs uten uttrykkelig godkjenning.

### Pulje 1 — filer

| Fil | | Linjer |
|---|---|---|
| `client/src/styles/penna-theme.css` | ny | 70 |
| `client/src/components/app-shell/navItems.ts` | ny | 135 |
| `client/src/components/app-shell/AppSidebar.tsx` | ny | 240 |
| `client/src/components/app-shell/navItems.test.ts` | ny | 108 |
| `client/src/index.css` | endret | +2 |
| `client/src/components/PageLayout.tsx` | endret | +29 |

Seks filer. Ingen endring i backend, API, database, ruter, auth, Stripe eller
forretningslogikk. `Dashboard.tsx` er urørt — den er pilot kun i den forstand at
den rendres *inne i* det nye shellet.

---

## Resultater — datapolitikk

Vi bygger **ingen** ny metrikk-synkronisering som del av redesignet. Full
Analytics-sync mot Meta og LinkedIn er en egen backend-leveranse senere.

| Måltall | Kilde i dag |
|---|---|
| `Publiserte innlegg` | reell |
| `Rekkevidde` | delvis, Meta |
| `Engasjement` | delvis |
| `Nye følgere` | **finnes ikke** |

Regler:

- Vis `Publiserte innlegg` fra reell kilde.
- Vis `Rekkevidde` og `Engasjement` **kun** når det finnes reelle, koblede data.
- Manglende data er ikke null. Vis `Ikke koblet ennå` / `Ingen data tilgjengelig`,
  med `Koble til konto` når koblingsfunksjonen faktisk finnes.
- Fjern `Nye følgere` til backend støtter det.
- Ingen fast `38 %`. Ingen ukalkulert anbefaling — beregn den, eller skjul kortet.

Hvert tall i mockupene er en visuell placeholder. Det kopieres ikke inn i koden
med mindre det kommer fra et reelt API eller er beregnet fra brukerens data.

---

## Responsivt og tilgjengelighet

- **Desktop:** fast sidebar, bredt arbeidsområde, forhåndsvisning ved siden av
  redigering.
- **Tablet:** sammenleggbar sidebar, tre kolonner blir to eller faner.
- **Mobil:** egen navigasjon, forhåndsvisning under redigering, primærhandlinger
  i full bredde. Ikke en nedskalert desktop.

Krav: tastaturnavigasjon, synlig fokus, semantiske labels, skjermleser,
WCAG AA-kontrast, reduced motion, annonserte feil, tydelig skjemavalidering.

---

## Distribusjon på Render

Prosjektet ligger på **Render**, ikke Vercel. `render.yaml` har **ingen**
`previews:`-blokk — det er ingen Preview Environments. I stedet finnes en fast
staging-tjeneste:

```
nexify-ai          → main      → penna.no          (produksjon)
nexify-ai-staging  → staging   → staging.penna.no
```

`previewValue` i `render.yaml` vil derfor bli ignorert. Riktig oppsett:

| Miljø | `VITE_FEATURE_NEW_SHELL` |
|---|---|
| Lokalt | `true` |
| `nexify-ai-staging` | `true` (Save, rebuild, and deploy) |
| `nexify-ai` (produksjon) | `false`, eller ikke satt |

Flagget skrus **ikke** på i produksjon før: gjennomgang på desktop, tablet og
mobil; Enkel og Avansert testet; admin og offentlige ruter upåvirket; grønn CI i
begge modi; og godkjente Before/After-bilder.

Testkommandoer:

```bash
VITE_FEATURE_NEW_SHELL=false pnpm build && pnpm check && pnpm lint && pnpm test
VITE_FEATURE_NEW_SHELL=true  pnpm build && pnpm check && pnpm lint && pnpm test
```

---

## Utenfor scope

- **Landing page-redesign.** Bryter regelen om at markedsføringssidene ikke
  endres i denne fasen, og krever at temaet først utvides til `:root`.
- **Analytics-synkronisering** mot Meta og LinkedIn.
- **`ideas` / `drafts` merkevare-isolasjon** — krever ny migrasjon.
