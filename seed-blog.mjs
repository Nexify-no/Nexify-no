import { drizzle } from "drizzle-orm/mysql2";
import { blogPosts } from "./drizzle/schema.ts";

const db = drizzle(process.env.DATABASE_URL);

const initialPosts = [
  {
    title: "5 tips for å skrive engasjerende LinkedIn-innlegg",
    slug: "5-tips-engasjerende-linkedin-innlegg",
    excerpt: "Lær hvordan du kan øke engasjementet på LinkedIn med disse fem enkle, men effektive tipsene.",
    content: `LinkedIn er en kraftig plattform for profesjonell nettverksbygging, men å skrive innlegg som virkelig engasjerer kan være utfordrende. Her er fem tips som vil hjelpe deg å skape innhold som folk faktisk vil lese og dele.

**1. Start med en sterk åpning**

De første linjene er avgjørende. Still et spørsmål, del en overraskende statistikk, eller fortell en kort historie som fanger oppmerksomheten umiddelbart. Folk scroller raskt gjennom feeden sin, så du har bare noen få sekunder til å fange interessen deres.

**2. Bruk korte avsnitt og luftige formater**

Lange tekstblokker skremmer bort lesere. Del innholdet ditt opp i korte avsnitt på 2-3 linjer. Bruk linjeskift strategisk for å gjøre teksten lettere å lese på mobil. Dette øker sannsynligheten for at folk leser hele innlegget.

**3. Fortell personlige historier**

Folk elsker autentiske historier. Del dine egne erfaringer, utfordringer du har møtt, og lærdommer du har tatt med deg. Dette skaper en emosjonell forbindelse med publikummet ditt og gjør deg mer relaterbar.

**4. Inkluder en tydelig oppfordring til handling (CTA)**

Hva vil du at leserne skal gjøre etter å ha lest innlegget ditt? Kommenter, dele, besøke nettstedet ditt? Vær tydelig på hva du ønsker. En god CTA kan øke engasjementet betydelig.

**5. Publiser på riktig tidspunkt**

Timing er alt. Studier viser at de beste tidspunktene for å publisere på LinkedIn er tirsdag til torsdag mellom 08:00 og 10:00, samt 17:00 og 18:00. Test forskjellige tidspunkter for å finne hva som fungerer best for ditt publikum.

**Konklusjon**

Ved å følge disse fem tipsene vil du raskt se en økning i engasjement på LinkedIn-innleggene dine. Husk at konsistens er nøkkelen – publiser regelmessig og eksperimenter med forskjellige formater for å finne din unike stemme.`,
    coverImage: null,
    category: "tips",
    tags: JSON.stringify(["LinkedIn", "SocialMedia", "ContentMarketing", "Engagement"]),
    authorName: "Innlegg Team",
    authorRole: "Content Strategist",
    readingTime: 4,
    published: 1,
    viewCount: 0,
  },
  {
    title: "Hvordan AI kan transformere din innholdsstrategi",
    slug: "ai-transformere-innholdsstrategi",
    excerpt: "Oppdag hvordan kunstig intelligens kan hjelpe deg med å lage bedre innhold raskere og mer effektivt.",
    content: `Kunstig intelligens (AI) har revolusjonert måten vi lager og distribuerer innhold på. I denne artikkelen skal vi utforske hvordan du kan bruke AI til å forbedre din innholdsstrategi.

**Hva er AI-drevet innholdsproduksjon?**

AI-drevet innholdsproduksjon bruker maskinlæring og naturlig språkbehandling for å generere, optimalisere og personalisere innhold. Dette betyr ikke at AI erstatter menneskelig kreativitet, men heller forsterker den ved å håndtere repetitive oppgaver og gi datadrevne innsikter.

**Fordeler med AI i innholdsproduksjon**

1. **Tidsbesparing**: Generer utkast på sekunder i stedet for timer
2. **Konsistens**: Oppretthold en jevn publiseringsfrekvens
3. **Personalisering**: Tilpass innhold til forskjellige målgrupper
4. **Dataanalyse**: Få innsikt i hva som fungerer og hva som ikke gjør det

**Hvordan komme i gang**

Start med å identifisere de mest tidkrevende delene av innholdsprosessen din. Er det idégenerering? Skriving av utkast? Optimalisering for forskjellige plattformer? AI-verktøy kan hjelpe med alle disse aspektene.

**Best practices**

- Bruk AI som et verktøy, ikke en erstatning for menneskelig kreativitet
- Alltid gjennomgå og tilpass AI-generert innhold
- Kombiner AI-innsikt med din egen bransjeekspertise
- Test og iterer basert på resultater

**Fremtiden for AI og innhold**

AI-teknologien utvikler seg raskt, og vi ser bare begynnelsen på hva som er mulig. Fra automatisk oversettelse til prediktiv analyse av engasjement, vil AI fortsette å spille en stadig viktigere rolle i innholdsmarkedsføring.`,
    coverImage: null,
    category: "guides",
    tags: JSON.stringify(["AI", "ContentStrategy", "Marketing", "Automation"]),
    authorName: "Innlegg Team",
    authorRole: "AI Specialist",
    readingTime: 5,
    published: 1,
    viewCount: 0,
  },
  {
    title: "Fra idé til ferdig innlegg på 30 sekunder",
    slug: "ide-til-ferdig-innlegg-30-sekunder",
    excerpt: "En steg-for-steg guide til hvordan du bruker Innlegg for å lage profesjonelt innhold på rekordtid.",
    content: `Har du noen gang sittet fast og stirret på en tom skjerm, usikker på hvordan du skal formulere tanken din? Med Innlegg kan du gå fra en vag idé til et ferdig, profesjonelt innlegg på bare 30 sekunder. Her er hvordan.

**Steg 1: Skriv ned din råidé (5 sekunder)**

Du trenger ikke en perfekt formulering. Bare skriv ned kjernen i det du vil si. For eksempel: "Lanserte ny funksjon i dag, veldig stolt av teamet". Det er alt du trenger!

**Steg 2: Velg plattform og tone (5 sekunder)**

Skal innlegget publiseres på LinkedIn, Twitter, Instagram eller Facebook? Velg plattformen, og deretter tonen som passer best – profesjonell, vennlig, motiverende eller pedagogisk.

**Steg 3: La AI gjøre magien (15 sekunder)**

Klikk på "Generer", og se hvordan AI transformerer din enkle idé til et velformulert, engasjerende innlegg tilpasset plattformen og tonen du valgte.

**Steg 4: Gjennomgå og tilpass (5 sekunder)**

Innlegget er klart, men du kan alltid gjøre små justeringer om nødvendig. Legg til emojis, endre noen ord, eller bruk det som det er – valget er ditt!

**Bonustips: Lagre vellykkede maler**

Når du finner et innlegg som fungerer spesielt godt, lagre det som en mal. Neste gang du har en lignende idé, kan du gjenbruke strukturen og spare enda mer tid.

**Konklusjon**

Med Innlegg handler det ikke lenger om å bruke timer på å formulere det perfekte innlegget. Du kan fokusere på det som virkelig betyr noe – å dele verdifulle ideer og bygge relasjoner med publikummet ditt.`,
    coverImage: null,
    category: "guides",
    tags: JSON.stringify(["Tutorial", "Productivity", "ContentCreation", "QuickTips"]),
    authorName: "Innlegg Team",
    authorRole: "Product Manager",
    readingTime: 3,
    published: 1,
    viewCount: 0,
  },
];

async function seedBlog() {
  try {
    console.log("Seeding blog posts...");
    
    for (const post of initialPosts) {
      await db.insert(blogPosts).values(post);
      console.log(`✓ Created: ${post.title}`);
    }
    
    console.log("\n✅ Blog seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding blog:", error);
    process.exit(1);
  }
}

seedBlog();
