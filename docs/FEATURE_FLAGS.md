# Feature flags

Penna ruller ut større endringer bak flagg. Dette er den fullstendige listen.
Legger du til et nytt flagg, dokumenter det her.

Det finnes **to slag**, og forskjellen bestemmer hvordan du skrur dem av igjen.

| | Runtime (server) | Build-time (klient) |
|---|---|---|
| Leses av | Node-prosessen, ved hvert kall | Vite, ved kompilering |
| Prefiks | ingen | `VITE_` |
| Skru om på Render | Save and deploy (restart holder) | **Save, rebuild, and deploy** |
| Øyeblikkelig av-bryter | ja, ved restart | **nei** |

Et build-time-flagg er bakt inn i bundelen. Et rent redeploy gjenbruker forrige
build, og den nye verdien når aldri klienten. Beskriv det aldri som en runtime
kill switch.

---

## Aktive flagg

### `FEATURE_MULTI_BRAND` — runtime

Flere merkevarer per konto: egen Merkehjerne, eget innhold, egen kalender, egne
sosiale kanaler per merkevare.

- Eksponert til klienten via `brands.flags`
- Av: appen kjører som én implisitt merkevare, `brand_id` er `NULL`
- Detaljer og sikkerhetsinvarianter: [`MULTI_BRAND_PLAN.md`](./MULTI_BRAND_PLAN.md)

### `FEATURE_ENKEL_PLAN` — runtime

Enkel-modus innholdsplan: `Lag plan` og `Innholdsplan`.

- Eksponert til klienten via `plan.flags`
- Av: de to destinasjonene skjules i navigasjonen, resten er uberørt

### `VITE_FEATURE_NEW_SHELL` — build-time

Det nye app-shellet: `AppSidebar` og det scopede `.penna-app`-temaet.

Les alltid med streng sammenligning:

```ts
const newShellEnabled = import.meta.env.VITE_FEATURE_NEW_SHELL === "true";
```

`Boolean(import.meta.env.VITE_FEATURE_NEW_SHELL)` er feil: strengen `"false"` er
truthy, så flagget kan ikke skrus av.

| Verdi | Oppførsel |
|---|---|
| `true` | `AppSidebar` + `.penna-app` |
| `false` | `DashboardNav`, dagens oppførsel ordrett |
| ikke satt | `DashboardNav`, dagens oppførsel ordrett |

Detaljer: [`MODERN_UI_PLAN.md`](./MODERN_UI_PLAN.md)

---

## Miljøer

`render.yaml` har **ingen** `previews:`-blokk — prosjektet bruker ikke Render
Preview Environments. `previewValue` i `render.yaml` blir derfor ignorert. Det vi
har er en fast staging-tjeneste:

```
nexify-ai          → main      → penna.no
nexify-ai-staging  → staging   → staging.penna.no
```

| Flagg | Lokalt | staging | produksjon |
|---|---|---|---|
| `FEATURE_MULTI_BRAND` | `true` | `true` | `true` |
| `FEATURE_ENKEL_PLAN` | `true` | `true` | `true` |
| `VITE_FEATURE_NEW_SHELL` | `true` | `true` | `false` / ikke satt |

Promoteringsflyt: feature-branch → PR (grønn CI) → merge til `staging` →
røyktest → merge `staging` → `main`.

---

## Å skru på et flagg i produksjon

Sjekklisten før `VITE_FEATURE_NEW_SHELL` settes til `true` i produksjon:

- [ ] Gjennomgått på desktop, tablet og mobil
- [ ] Både Enkel og Avansert testet
- [ ] Admin-ruter og offentlige ruter upåvirket
- [ ] Grønn CI med flagget både `false` og `true`
- [ ] Before/After-bilder godkjent

Tilbakerulling: sett `false` og **rebuild**, eller **Deploys → Rollback** til
forrige vellykkede deploy. Begge krever et deploy.

Trenger vi en gang et flagg som kan slås av uten deploy, må det være
server- eller DB-styrt — ikke et `VITE_`-flagg.
