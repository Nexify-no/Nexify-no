/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { 
  Zap, 
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  Target,
  MessageSquare,
  Star,
  Shield,
  Image,
  Mic,
  Calendar,
  RefreshCw,
  Brain,
  Flame,
  Layers,
  ChevronRight,
  Quote,
  Play,
  Globe,
  Lightbulb,
  PenTool,
  Award,
  Rocket,
  Facebook, Instagram, Twitter, Linkedin,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import HeroDemo from "@/components/HeroDemo";
import { AuroraLayer } from "@/components/ui/aurora-background";
import PricingPlans from "@/components/PricingPlans";
import HowItWorksDemo from "@/components/HowItWorksDemo";
import FeaturesDemo from "@/components/FeaturesDemo";
import PricingDemo from "@/components/PricingDemo";
import { PennaMark } from "@/components/PennaMark";

// Animated counter hook
function useCountUp(end: number, duration: number = 2000, start: boolean = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [end, duration, start]);
  return count;
}

// Intersection observer hook
function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

export default function Home() {
  const { user } = useAuth();
  useLanguage();
  const statsSection = useInView(0.3);
  const featuresSection = useInView(0.1);
  const pricingSection = useInView(0.1);
  const howItWorksSection = useInView(0.1);
  const testimonialsSection = useInView(0.1);


  const features = [
    {
      icon: Flame,
      gradient: "from-orange-500 to-red-500",
      bgLight: "bg-orange-50",
      title: "Trend og Inspirasjon",
      desc: "Få daglige trending-emner fra Google Trends tilpasset ditt felt. Aldri mer \"hva skal jeg skrive om?\"",
      tags: ["Google Trends", "Daglig oppdatering", "Tilpasset"]
    },
    {
      icon: Mic,
      gradient: "from-purple-500 to-pink-500",
      bgLight: "bg-purple-50",
      title: "Lærer din stemme",
      desc: "AI analyserer dine tidligere innlegg og skriver i din unike stil. Ingen generisk AI-tekst.",
      tags: ["Din stil", "Dine ord", "Din tone"]
    },
    {
      icon: Image,
      gradient: "from-blue-500 to-cyan-500",
      bgLight: "bg-blue-50",
      title: "AI-genererte bilder",
      desc: "Hvert innlegg kommer med et profesjonelt AI-generert bilde. Perfekt for engagement.",
      tags: ["AI-bilder", "Automatisk"]
    },
    {
      icon: Calendar,
      gradient: "from-green-500 to-emerald-500",
      bgLight: "bg-green-50",
      title: "Innholdskalender",
      desc: "Norske og internasjonale merkedager. Aldri gå glipp av en relevant anledning.",
      tags: ["17. mai", "Jul", "Black Friday"]
    },
    {
      icon: RefreshCw,
      gradient: "from-amber-500 to-orange-500",
      bgLight: "bg-amber-50",
      title: "Gjenbruk-maskin",
      desc: "Gjør gamle suksessinnlegg om til nye formater: threads, carousels, video-scripts.",
      tags: ["Thread", "Carousel", "Video"]
    },
    {
      icon: Brain,
      gradient: "from-indigo-500 to-violet-500",
      bgLight: "bg-indigo-50",
      title: "AI Coach & Analyse",
      desc: "Få personlig coaching og detaljert analyse av innholdet ditt. Lær hva som fungerer.",
      tags: ["Scoring", "Tips", "Forbedring"]
    },
    {
      icon: Layers,
      gradient: "from-teal-500 to-cyan-500",
      bgLight: "bg-teal-50",
      title: "Alt på ett sted",
      desc: "Alle innlegg, statistikk, og historikk samlet. Filtrer, søk, og organiser enkelt.",
      tags: ["Statistikk", "Søk", "Filter"]
    },
    {
      icon: Globe,
      gradient: "from-rose-500 to-pink-500",
      bgLight: "bg-rose-50",
      title: "4 plattformer",
      desc: "LinkedIn, Twitter/X, Instagram og Facebook. Optimalisert innhold for hver plattform.",
      tags: ["LinkedIn", "Twitter", "Instagram"]
    },
    {
      icon: Lightbulb,
      gradient: "from-yellow-500 to-amber-500",
      bgLight: "bg-yellow-50",
      title: "Idé-Bank",
      desc: "Lagre og organiser dine beste ideer. Aldri mist en god idé igjen.",
      tags: ["Lagre", "Organiser", "Gjenbruk"]
    }
  ];


  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-100 bg-white/95 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PennaMark className="h-10 w-10" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Penna
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Hvordan det virker
            </a>
            <a href="#features" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Funksjoner
            </a>
            <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Priser
            </a>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900" asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
                <Link href="/profile">
                  <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                    {(user as any).avatarUrl ? (
                      <img
                        src={(user as any).avatarUrl}
                        alt={user.name || "User"}
                        className="h-8 w-8 rounded-full object-cover ring-2 ring-primary/20"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                        {user.name?.charAt(0).toUpperCase() || "U"}
                      </div>
                    )}
                  </div>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-red-600"
                  onClick={() => {
                    fetch("/api/trpc/auth.logout", { method: "POST" }).finally(() => {
                      window.location.href = "/login";
                    });
                  }}
                >
                  Logg ut
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900" asChild>
                  <a href={getLoginUrl()}>Logg inn</a>
                </Button>
                <Button size="sm" className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 shadow-md shadow-primary/20" asChild>
                  <a href={getLoginUrl()}>
                    Prøv gratis <ArrowRight className="ml-1 h-4 w-4" />
                  </a>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-16 pb-20 md:pt-24 md:pb-28 relative overflow-hidden">
        {/* Aurora background (Aceternity) */}
        <AuroraLayer />

        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 mb-6 bg-white border border-gray-200 px-4 py-2 rounded-full shadow-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-gray-700">Ny norsk AI-plattform for innhold</span>
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.1] tracking-tight text-gray-900">
              Fra idé til ferdig innlegg
              <span className="block bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent mt-1">
                på 30 sekunder
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
              Slutt å bruke timer — Penna gjør jobben på minutter.
              <span className="block mt-2 text-gray-700 font-medium">LinkedIn · Twitter · Instagram · Facebook</span>
            </p>

            {/* 3-Step Process */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-5 mb-10">
              {[
                { num: "1", label: "Velg plattform", color: "from-blue-500 to-blue-600" },
                { num: "2", label: "Skriv emne", color: "from-purple-500 to-purple-600" },
                { num: "3", label: "Få innlegg + bilde", color: "from-green-500 to-green-600" }
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex items-center gap-3 bg-white rounded-full px-5 py-2.5 border border-gray-200 shadow-sm">
                    <div className={`h-7 w-7 rounded-full bg-gradient-to-br ${step.color} text-white flex items-center justify-center text-xs font-bold`}>{step.num}</div>
                    <span className="text-sm font-medium text-gray-700">{step.label}</span>
                  </div>
                  {i < 2 && <ChevronRight className="h-4 w-4 text-gray-300 hidden md:block" />}
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 text-lg px-8 py-6 shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-0.5 group"
                asChild
              >
                <a href={getLoginUrl()}>
                  <Zap className="mr-2 h-5 w-5" />
                  Prøv 2 innlegg gratis
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </a>
              </Button>
            </div>

            <div className="flex items-center justify-center gap-6 text-sm text-gray-500 mb-16">
              {["Ingen kredittkort", "Klar på 30 sek", "Avbryt når som helst"].map((item, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Animated Demo Preview */}
          <HeroDemo />
        </div>
      </section>

      {/* Social Proof - Animated Counters */}
      <section className="py-16 bg-gray-50 border-y border-gray-100" ref={statsSection.ref}>
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-1">4</div>
              <div className="text-sm text-gray-500 font-medium">Plattformer</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-1">~30 sek</div>
              <div className="text-sm text-gray-500 font-medium">Per innlegg</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-1">100%</div>
              <div className="text-sm text-gray-500 font-medium">Ditt innhold</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-0.5 mb-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <div className="text-sm text-gray-500 font-medium">Ny plattform</div>
            </div>
          </div>
        </div>
      </section>

      {/* Honest early-stage note (no unverifiable "used by" claims / placeholder logos).
          Re-introduce real, named, written-consent logos/testimonials only when available. */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <p className="text-center text-base md:text-lg font-medium text-gray-500">
            Ny norsk AI-plattform — bli blant de første som tar den i bruk.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-white" ref={howItWorksSection.ref}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4 bg-primary/5 border border-primary/10 px-4 py-1.5 rounded-full">
              <Play className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-medium text-primary">Enkelt som 1-2-3</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">Hvordan det virker</h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">Ingen læringskurve. Bare resultater.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                icon: Target,
                gradient: "from-blue-500 to-blue-600",
                shadow: "shadow-blue-500/20",
                num: "01",
                title: "Velg plattform & tone",
                desc: "LinkedIn, Twitter, Instagram eller Facebook. Profesjonell, uformell eller vennlig tone."
              },
              {
                icon: PenTool,
                gradient: "from-purple-500 to-purple-600",
                shadow: "shadow-purple-500/20",
                num: "02",
                title: "Skriv emne eller idé",
                desc: "Bare noen ord er nok. AI forstår konteksten og utvider ideen din til et komplett innlegg."
              },
              {
                icon: Sparkles,
                gradient: "from-green-500 to-green-600",
                shadow: "shadow-green-500/20",
                num: "03",
                title: "Få innlegg + bilde",
                desc: "Profesjonelt innlegg med AI-generert bilde. Klar til å publisere på sekunder."
              }
            ].map((step, i) => (
              <div key={i} className="text-center group">
                <div className="relative mb-6">
                  <div className={`h-20 w-20 bg-gradient-to-br ${step.gradient} rounded-3xl flex items-center justify-center mx-auto shadow-lg ${step.shadow} group-hover:shadow-xl transition-all duration-300 group-hover:-translate-y-1`}>
                    <step.icon className="h-9 w-9 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 md:-right-4 h-8 w-8 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-400 shadow-sm">
                    {step.num}
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">{step.title}</h3>
                <p className="text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          {/* Interactive Demo */}
          <HowItWorksDemo />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-gray-50" ref={featuresSection.ref}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4 bg-gradient-to-r from-primary to-purple-600 px-4 py-1.5 rounded-full">
              <Sparkles className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-medium text-white">Unike funksjoner</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
              Mer enn bare en AI-generator
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Alt du trenger for å dominere sosiale medier - i én enkel app.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {features.map((feature, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-primary/30 transition-all duration-300 hover:shadow-lg group">
                <div className={`h-12 w-12 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2 text-gray-900">{feature.title}</h3>
                <p className="text-gray-500 text-sm mb-4 leading-relaxed">{feature.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {feature.tags.map((tag, j) => (
                    <span key={j} className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Interactive Features Demo */}
          <FeaturesDemo />

          {/* Coming Soon */}
          <div className="mt-10 max-w-3xl mx-auto">
            <div className="bg-white rounded-2xl border-2 border-dashed border-primary/20 p-6 text-center">
              <div className="inline-flex items-center gap-2 mb-3 bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 rounded-full text-xs font-semibold">
                <Rocket className="h-3 w-3" />
                Kommer snart
              </div>
              <div className="flex items-center justify-center gap-4 mb-3">
                <div className="h-10 w-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <h3 className="text-lg font-bold mb-2 text-gray-900">WhatsApp Bot</h3>
              <p className="text-gray-500 text-sm max-w-md mx-auto">
                Send en melding eller talemelding → Få ferdig innlegg tilbake. Skap innhold mens du er på farten.
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* Pricing */}
      <section id="pricing" className="py-20 bg-gray-50" ref={pricingSection.ref}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4 bg-primary/5 border border-primary/10 px-4 py-1.5 rounded-full">
              <Award className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-medium text-primary">Enkel prising</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
              Start gratis, oppgrader når du er klar
            </h2>
            <p className="text-lg text-gray-500">
              Mindre enn en kaffe per dag. Spar 5+ timer hver uke.
            </p>
          </div>

          <PricingPlans />

          {/* Guarantee */}
          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-3 bg-green-50 border border-green-200 rounded-full px-6 py-3">
              <Shield className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-800">Ingen bindingstid — avbryt når som helst</span>
            </div>
          </div>

          {/* Time Savings Calculator */}
          <PricingDemo />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ofte stilte spørsmål</h2>
            <p className="text-lg text-gray-500">Alt du lurer på før du kommer i gang.</p>
          </div>
          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="w-full">
              {[
                {
                  q: "Hva koster Penna?",
                  a: "Du starter gratis med 2 innlegg – ingen kredittkort. Vil du ha mer, gir Pro 15 innlegg/måned og Premium 30 innlegg/måned, med AI-bilder og planlegging til en fast månedspris.",
                },
                {
                  q: "Trenger jeg kredittkort for å prøve?",
                  a: "Nei. Den gratis prøveperioden krever ingen betalingsinformasjon – du kan teste alt og avbryte når som helst.",
                },
                {
                  q: "Hvilke plattformer støttes?",
                  a: "Penna lager innhold tilpasset LinkedIn, X (Twitter), Instagram og Facebook – med riktig tone og format for hver plattform.",
                },
                {
                  q: "Er innholdet på norsk?",
                  a: "Ja. Penna er bygget spesielt for norsk språk og tone, så innleggene høres naturlige ut – ikke maskinoversatt.",
                },
                {
                  q: "Hvordan håndteres dataene mine?",
                  a: "Tekstforespørslene sendes til OpenAI for AI-behandling og lagres ikke permanent. Du eier 100 % av innholdet som genereres.",
                },
                {
                  q: "Kan jeg si opp når som helst?",
                  a: "Ja. Du kan oppgradere, nedgradere eller avslutte abonnementet når du vil – uten bindingstid.",
                },
              ].map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-b border-gray-200">
                  <AccordionTrigger className="text-left text-base md:text-lg font-semibold hover:no-underline py-5">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600 leading-relaxed pb-5">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-r from-primary to-purple-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 left-10 w-40 h-40 bg-white/5 rounded-full blur-2xl"></div>
          <div className="absolute bottom-10 right-10 w-60 h-60 bg-white/5 rounded-full blur-2xl"></div>
        </div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <Sparkles className="h-10 w-10 mx-auto mb-6 opacity-80" />
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Klar til å spare 5+ timer hver uke?
          </h2>
          <p className="text-lg mb-8 max-w-xl mx-auto opacity-90 leading-relaxed">
            Prøv 2 innlegg gratis. Ingen kredittkort. Klar på 30 sekunder.
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            className="text-lg px-8 py-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5 group"
            asChild
          >
            <a href={getLoginUrl()}>
              <Zap className="mr-2 h-5 w-5" />
              Start gratis nå
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900 text-white">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <PennaMark className="h-9 w-9" />
                <span className="text-lg font-bold">Penna</span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                Din AI-assistent for profesjonelt innhold på sosiale medier.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-gray-300">Produkt</h4>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><a href="#how-it-works" className="hover:text-white transition-colors">Hvordan det virker</a></li>
                <li><a href="#features" className="hover:text-white transition-colors">Funksjoner</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Priser</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-gray-300">Juridisk</h4>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><a href="/privacy" className="hover:text-white transition-colors">Personvern</a></li>
                <li><a href="/terms" className="hover:text-white transition-colors">Vilkår</a></li>
                <li><a href="/salgsbetingelser" className="hover:text-white transition-colors">Salgsbetingelser</a></li>
                <li><a href="/cookie-policy" className="hover:text-white transition-colors">Informasjonskapsler</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-gray-300">Kontakt</h4>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><a href="mailto:support@penna.no" className="hover:text-white transition-colors">support@penna.no</a></li>
                <li><a href="tel:+4792146050" className="hover:text-white transition-colors">+47 921 46 050</a></li>
                <li className="pt-1 text-gray-500">Nexify CRM Systems AS</li>
                <li className="text-gray-500">Nedre Sølen 5, 3913 Porsgrunn</li>
                <li><a href="/about-us" className="hover:text-white transition-colors">Om oss</a></li>
                <li><a href="/faq" className="hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">&copy; {new Date().getFullYear()} Penna. Alle rettigheter reservert.</p>
            <div className="flex items-center gap-5">
              <a href="https://www.facebook.com/profile.php?id=61591542924941" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-gray-400 hover:text-white transition-colors"><Facebook className="h-5 w-5" /></a>
              <a href="https://www.instagram.com/penna.no/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-gray-400 hover:text-white transition-colors"><Instagram className="h-5 w-5" /></a>
              <a href="https://x.com/Penna0no" target="_blank" rel="noopener noreferrer" aria-label="X" className="text-gray-400 hover:text-white transition-colors"><Twitter className="h-5 w-5" /></a>
              <a href="https://www.linkedin.com/company/penna-no/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-gray-400 hover:text-white transition-colors"><Linkedin className="h-5 w-5" /></a>
            </div>
            <p className="text-xs text-gray-600">Nexify CRM Systems AS · Org.nr: 936 300 278</p>
            <p className="text-xs text-gray-600 max-w-3xl mx-auto text-center">
              Varemerker tilhører sine respektive eiere. Penna er ikke tilknyttet OpenAI, Google eller LinkedIn.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}