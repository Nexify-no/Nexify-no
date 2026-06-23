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
  Send,
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
  Rocket
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import HeroDemo from "@/components/HeroDemo";
import { AuroraLayer } from "@/components/ui/aurora-background";
import PricingPlans from "@/components/PricingPlans";
import HowItWorksDemo from "@/components/HowItWorksDemo";
import FeaturesDemo from "@/components/FeaturesDemo";
import PricingDemo from "@/components/PricingDemo";
import TestimonialsDemo from "@/components/TestimonialsDemo";

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

  const usersCount = useCountUp(2500, 2000, true);
  const postsCount = useCountUp(50000, 2500, true);
  const hoursCount = useCountUp(10, 1500, true);

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
      tags: ["DALL-E 3", "Nano Banana", "Automatisk"]
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

  const testimonials = [
    {
      name: "Erik Johansen",
      role: "Markedssjef, TechNorge AS",
      text: "Nexify AI har halvert tiden vi bruker på innholdsproduksjon. Kvaliteten er imponerende - kollegaene mine tror jeg skriver alt selv!",
      rating: 5,
      initial: "E",
      color: "from-blue-500 to-blue-600"
    },
    {
      name: "Sara Lindberg",
      role: "Gründer & Konsulent",
      text: "Endelig en AI-verktøy som faktisk forstår norsk kontekst. Stemmefunksjonen er genial - innleggene høres ut som meg.",
      rating: 5,
      initial: "S",
      color: "from-purple-500 to-purple-600"
    },
    {
      name: "Magnus Olsen",
      role: "Frilanser, Digital Markedsføring",
      text: "Fra 2 timer til 5 minutter per innlegg. Jeg kan nå ta på meg flere kunder uten å jobbe mer. Verdt hver krone.",
      rating: 5,
      initial: "M",
      color: "from-green-500 to-green-600"
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-100 bg-white/95 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-primary/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Nexify AI
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
            <a href="#testimonials" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Anmeldelser
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
              <span className="text-sm font-medium text-gray-700">Brukt av 2 500+ markedsførere i Norden</span>
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.1] tracking-tight text-gray-900">
              Skap innhold som
              <span className="block bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent mt-1">
                engasjerer og konverterer
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
              Profesjonelle innlegg med AI-genererte bilder. Ferdig på 30 sekunder.
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
                  Prøv 5 innlegg gratis
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
              <div className="text-3xl md:text-4xl font-bold text-primary mb-1">{usersCount.toLocaleString()}+</div>
              <div className="text-sm text-gray-500 font-medium">Fornøyde brukere</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-1">{postsCount.toLocaleString()}+</div>
              <div className="text-sm text-gray-500 font-medium">Innlegg generert</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-1">{hoursCount}+ timer</div>
              <div className="text-sm text-gray-500 font-medium">Spart per uke</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-0.5 mb-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <div className="text-sm text-gray-500 font-medium">4.9/5 vurdering</div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted-by logo strip — replace placeholder wordmarks with real customer logos */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm font-medium text-gray-400 uppercase tracking-wider mb-8">
            Brukt av markedsteam i hele Norden
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 md:gap-x-16">
            {["Nordisk Media", "VekstByrå", "StartupLab", "Helse Norge", "Handel AS", "Fjord Digital"].map((name) => (
              <span
                key={name}
                className="font-display text-lg md:text-xl font-bold text-gray-300 transition-colors duration-300 hover:text-gray-500"
              >
                {name}
              </span>
            ))}
          </div>
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
                  <Send className="h-5 w-5 text-green-600" />
                </div>
                <div className="h-10 w-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-blue-500" />
                </div>
              </div>
              <h3 className="text-lg font-bold mb-2 text-gray-900">WhatsApp & Telegram Bot</h3>
              <p className="text-gray-500 text-sm max-w-md mx-auto">
                Send en melding eller talemelding → Få ferdig innlegg tilbake. Skap innhold mens du er på farten.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 bg-white" ref={testimonialsSection.ref}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4 bg-primary/5 border border-primary/10 px-4 py-1.5 rounded-full">
              <Quote className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-medium text-primary">Hva brukerne sier</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">Elsket av markedsførere</h2>
            <p className="text-lg text-gray-500">Se hva andre sier om Nexify AI</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((testimonial, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                  "{testimonial.text}"
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${testimonial.color} flex items-center justify-center shadow-sm`}>
                    <span className="text-sm font-bold text-white">{testimonial.initial}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{testimonial.name}</p>
                    <p className="text-xs text-gray-500">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Results Demo */}
          <TestimonialsDemo />
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
              Mindre enn en kaffe per dag. Spar 10+ timer hver uke.
            </p>
          </div>

          <PricingPlans />

          {/* Guarantee */}
          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-3 bg-green-50 border border-green-200 rounded-full px-6 py-3">
              <Shield className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-800">30-dagers pengene-tilbake-garanti — Ingen spørsmål</span>
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
                  q: "Hva koster Nexify?",
                  a: "Du starter gratis med 5 innlegg – ingen kredittkort. Vil du ha mer, gir Pro-abonnementet ubegrenset generering, AI-bilder og planlegging til en fast månedspris.",
                },
                {
                  q: "Trenger jeg kredittkort for å prøve?",
                  a: "Nei. Den gratis prøveperioden krever ingen betalingsinformasjon – du kan teste alt og avbryte når som helst.",
                },
                {
                  q: "Hvilke plattformer støttes?",
                  a: "Nexify lager innhold tilpasset LinkedIn, X (Twitter), Instagram og Facebook – med riktig tone og format for hver plattform.",
                },
                {
                  q: "Er innholdet på norsk?",
                  a: "Ja. Nexify er bygget spesielt for norsk språk og tone, så innleggene høres naturlige ut – ikke maskinoversatt.",
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
            Klar til å spare 10+ timer hver uke?
          </h2>
          <p className="text-lg mb-8 max-w-xl mx-auto opacity-90 leading-relaxed">
            Prøv 5 innlegg gratis. Ingen kredittkort. Klar på 30 sekunder.
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
                <div className="h-8 w-8 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <span className="text-lg font-bold">Nexify AI</span>
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
                <li><a href="/cookie-policy" className="hover:text-white transition-colors">Informasjonskapsler</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-gray-300">Kontakt</h4>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><a href="mailto:support@nexify.ai" className="hover:text-white transition-colors">support@nexify.ai</a></li>
                <li><a href="/about-us" className="hover:text-white transition-colors">Om oss</a></li>
                <li><a href="/faq" className="hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">&copy; {new Date().getFullYear()} Nexify AI. Alle rettigheter reservert.</p>
            <p className="text-xs text-gray-600">Nexify CRM Systems AS · Org.nr: 933 660 027</p>
          </div>
        </div>
      </footer>
    </div>
  );
}