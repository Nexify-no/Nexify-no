# Multi-brand (Merkevarer) — status og invarianter

> Én kundekonto kan forvalte flere merkevarer. Hver merkevare har sin egen
> Merkehjerne, sitt eget innhold, sin egen kalender og sine egne sosiale kanaler.

**Feature flag:** `FEATURE_MULTI_BRAND` (server-side, runtime).
Eksponert til klienten via `brands.flags` — samme mønster som `plan.flags`.
Er flagget av, oppfører appen seg presis som før: alt kjører som én implisitt
merkevare, og `brand_id` er `NULL`.

---

## 1. Datamodell

| Migrasjon | Innhold |
|---|---|
| `0089_multi_brand.sql` | `brands`-tabellen, `users.active_brand_id`, `brand_id` på 7 tabeller, `UNIQUE(user_id, brand_id)` på `brand_profiles` |
| `0090` | `brand_social_connections`, `publications` |
| `0091` | `image_alt_text`, `image_brand_id`, `image_visual_identity_version` |

`brand_id` finnes på: `brand_profiles`, `posts`, `scheduled_posts`,
`content_plans`, `planned_posts`, `content_schedule`, `linkedin_connections`.

### Kjente hull

- **`ideas` og `drafts` har ingen `brand_id`.** De deles fortsatt på tvers av
  merkevarer. Å lukke dette krever en ny migrasjon; det er en bevisst utsettelse,
  ikke en forglemmelse.
- **Historiske rader har `brand_id = NULL`** og vises derfor under *alle*
  merkevarer. Valgt med vilje: alternativet var å skjule innhold brukeren
  allerede har laget. En engangs-tilordning kan bygges hvis ønskelig.

---

## 2. Sikkerhetsinvarianter

Disse skal ikke svekkes for å få en test til å passere.

### 2.1 Konto og rettigheter kommer fra sesjonen

`account_id` leses **alltid** fra `ctx.user.id`. Ingen prosedyre tar imot en
konto- eller merkevare-id fra klienten uten å verifisere eierskap først
(`requireOwnBrand`).

### 2.2 Publisering krever at merkevaren eier kanalen

```
post.brand_id === social_connection.brand_id
```

Matcher de ikke, stanses publiseringen og hendelsen logges som security event.
Se `assertBrandOwnsConnection` i `server/services/socialDestinations.ts`.

Det finnes **ingen** generell publiseringsdestinasjon som gjelder alle merkevarer.

### 2.3 Ingen kryssvisning under bytte

Ved merkevarebytte invalideres hele query-cachen (`utils.invalidate()`), slik at
ingenting fra forrige merkevare vises et halvt sekund før nye data kommer.

### 2.4 Aldri auto-godkjenn usikret innhold

Et innlegg med `needs_review` eller `high_risk` godkjennes ikke automatisk.
Massegodkjenning tar kun `verified`. Se `contentVerification.ts` og `canBulkApprove`.

---

## 3. Isolasjon — hva som faktisk er scoped

Alt nedenfor ble funnet ved **live testing**, ikke av CI. Koden kompilerte og
alle tester var grønne mens lekkasjene var der.

| Flate | Status |
|---|---|
| `Mine innlegg` / dashbord (`getUserPosts`, begge implementasjoner) | scoped |
| Merkehjerne (`brandRouter`, alle lesninger og skrivinger) | scoped |
| Kalender (`content.getScheduledPosts`) | scoped |
| Innholdsplan (`content_plans` + `planned_posts`) | scoped, `brand_id` persisteres |
| Nye innlegg (alle skrivestier) | stemples, se §4 |
| `ideas`, `drafts` | **ikke scoped** — mangler kolonne |

---

## 4. Hvert nytt innlegg stemples med sin merkevare

`db.createPost()` stempler den aktive merkevaren. Men tre kodestier skrev
direkte til `posts` og gikk forbi den, slik at innlegget fikk `brand_id = NULL`
og dermed dukket opp under *alle* merkevarer:

- `postManagementService.createPost` → stempler nå forfatterens aktive merkevare
- `telegramWebhook` → stempler den koblede brukerens aktive merkevare
- `telegramRouter.duplicate` → arver **originalens** merkevare, ikke den som
  tilfeldigvis er valgt nå (duplisering fra merkevare A mens B er valgt skal
  ikke flytte kopien til B)

**Regresjonsvakt:** `server/services/brandStamping.test.ts` skanner kildekoden og
feiler hvis en ny `insert(posts)` mangler `brandId`. Den fanget en feil i vårt
eget leveranseskript før den nådde repoet.

All stempling er *best effort*: en feil lar innlegget stå uscopet framfor å
blokkere skrivingen, og er en no-op når flagget er av.

---

## 5. Adopsjon av gamle rader (og 500-feilen den forårsaket)

`ensureDefaultBrand` tilordner gamle rader til standardmerkevaren ved første
kall. Den opprinnelige implementasjonen gjorde det med én blank UPDATE:

```sql
UPDATE brand_profiles SET brand_id = ? WHERE user_id = ? AND brand_id IS NULL
```

Siden migrasjon 0089 har `brand_profiles` `UNIQUE(user_id, brand_id)`. Så snart
en konto hadde mer enn én profilrad — noe gjentatte «Analyser på nytt»-forsøk
lager — kolliderte setningen, `brands.list` svarte 500, og `BrandSelector`
returnerte `null`. **Merkevare-velgeren forsvant helt uten én feilmelding.**

Rettelsen, i tre lag:

1. `brands.ts` — adopter **maksimalt én** `brand_profiles`-rad, scoped på `id`,
   og bare når `(user, brand)`-plassen er ledig. Alle adopsjonsskrivinger går
   gjennom en `adopt()`-hjelper som logger og hopper videre ved feil. Adopsjon er
   en bekvemmelighet; den skal aldri kunne felle endepunktet.
2. `_core/index.ts` — la til `onError` på tRPC-middlewaren. `errorFormatter`
   redigerer korrekt bort interne feil mot klienten, men **ingenting logget
   årsaken**: en 500 i produksjon ga null diagnostikk. Vi logger driverens
   feilkode og SQL-state — ikke meldingen, som ekkoer kolonneverdier tilbake.
3. `BrandSelector.tsx` — skiller «funksjon av» fra «klarte ikke laste».
   Viser `Kunne ikke laste merkevarer` med en retry i stedet for å forsvinne.

**Lærdom:** et redigert feilsvar uten server-side logging er et blindpunkt.
Hver ny `INTERNAL_SERVER_ERROR`-sti skal være diagnostiserbar fra loggen alene.

---

## 6. Sesongriktighet

Et innlegg om nyttår skal ikke lages i august. `verifyPostContent` sammenligner
sesongmarkører i teksten mot foreslått publiseringsdato og flagger avvik som
`needs_review`.

## 7. Ikke antatt

Ballong-kontoen, Penna-siden og Nexify-LinkedIn tilhører **ikke** samme
merkevare. Ingen kobling adopteres automatisk med mindre kontoen har nøyaktig
én merkevare — da, og bare da, er tilordningen entydig.
