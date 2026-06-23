/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState, useEffect, useRef } from "react";
import { 
  Flame, TrendingUp, Mic, Image, Brain,
  ArrowRight, CheckCircle2, Sparkles
} from "lucide-react";

const DEMO_SCENARIOS = [
  {
    feature: "Trend og Inspirasjon",
    icon: Flame,
    gradient: "from-orange-500 to-red-500",
    demo: (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-orange-500" />
          <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">Trending nå</span>
        </div>
        {[
          { topic: "AI i norsk næringsliv", trend: "+340%", hot: true },
          { topic: "Bærekraftig markedsføring", trend: "+180%", hot: false },
          { topic: "Remote work 2026", trend: "+95%", hot: false },
        ].map((item, i) => (
          <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg border transition-all duration-300 ${
            item.hot ? "bg-orange-50 border-orange-200" : "bg-white border-gray-100"
          }`}>
            <div className="flex items-center gap-2">
              {item.hot && <Flame className="h-3.5 w-3.5 text-orange-500" />}
              <span className="text-xs font-medium text-gray-700">{item.topic}</span>
            </div>
            <span className={`text-xs font-bold ${item.hot ? "text-orange-600" : "text-green-600"}`}>{item.trend}</span>
          </div>
        ))}
      </div>
    )
  },
  {
    feature: "Lærer din stemme",
    icon: Mic,
    gradient: "from-purple-500 to-pink-500",
    demo: (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Mic className="h-4 w-4 text-purple-500" />
          <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Stemmeanalyse</span>
        </div>
        <div className="space-y-2">
          {[
            { label: "Tone", value: "Profesjonell & vennlig", pct: 92 },
            { label: "Ordforråd", value: "Bransje-spesifikt", pct: 88 },
            { label: "Stil", value: "Historiefortelling", pct: 95 },
          ].map((item, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 font-medium">{item.label}: {item.value}</span>
                <span className="text-purple-600 font-bold">{item.pct}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" style={{ width: `${item.pct}%` }}></div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-green-600 font-medium mt-1">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Stemmen din er trent og klar!
        </div>
      </div>
    )
  },
  {
    feature: "AI-genererte bilder",
    icon: Image,
    gradient: "from-blue-500 to-cyan-500",
    demo: (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Image className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Bildegenerering</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { color: "from-blue-200 to-cyan-200", label: "Profesjonell" },
            { color: "from-purple-200 to-pink-200", label: "Kreativ" },
            { color: "from-green-200 to-emerald-200", label: "Minimalistisk" },
            { color: "from-amber-200 to-orange-200", label: "Fargerik" },
          ].map((style, i) => (
            <div key={i} className={`h-16 bg-gradient-to-br ${style.color} rounded-lg flex items-center justify-center border border-white/50 ${i === 0 ? "ring-2 ring-blue-400 ring-offset-1" : ""}`}>
              <span className="text-xs font-medium text-gray-600">{style.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-blue-600 font-medium">
          <Sparkles className="h-3.5 w-3.5" />
          4 stiler tilgjengelig per innlegg
        </div>
      </div>
    )
  },
  {
    feature: "AI Coach & Analyse",
    icon: Brain,
    gradient: "from-indigo-500 to-violet-500",
    demo: (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="h-4 w-4 text-indigo-500" />
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Innholdsanalyse</span>
        </div>
        <div className="flex items-center gap-3 p-2.5 bg-indigo-50 rounded-lg border border-indigo-100">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-white">92</span>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-800">Kvalitetsscore</p>
            <p className="text-xs text-gray-500">Topp 8% av alle innlegg</p>
          </div>
        </div>
        <div className="space-y-1.5">
          {[
            { label: "Engasjement", score: "Høy", color: "text-green-600" },
            { label: "Lesbarhet", score: "Utmerket", color: "text-green-600" },
            { label: "CTA", score: "Legg til CTA", color: "text-amber-600" },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded">
              <span className="text-gray-600">{item.label}</span>
              <span className={`font-bold ${item.color}`}>{item.score}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
];

export default function FeaturesDemo() {
  const [activeFeature, setActiveFeature] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      setActiveFeature(prev => (prev + 1) % DEMO_SCENARIOS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isVisible]);

  return (
    <div ref={containerRef} className="mt-12 max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
        <div className="grid md:grid-cols-5">
          {/* Left: Feature tabs */}
          <div className="md:col-span-2 p-5 border-r border-gray-100 bg-gray-50/30">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-2">Se det i aksjon</p>
            <div className="space-y-1.5">
              {DEMO_SCENARIOS.map((scenario, i) => {
                const Icon = scenario.icon;
                return (
                  <button
                    key={i}
                    onClick={() => setActiveFeature(i)}
                    className={`w-full text-left flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                      activeFeature === i
                        ? "bg-white border border-gray-200 shadow-sm"
                        : "hover:bg-white/50"
                    }`}
                  >
                    <div className={`h-9 w-9 flex-shrink-0 bg-gradient-to-br ${scenario.gradient} rounded-lg flex items-center justify-center transition-all duration-300 ${
                      activeFeature === i ? "scale-110 shadow-md" : "opacity-50"
                    }`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <span className={`text-sm font-medium transition-colors duration-300 ${
                      activeFeature === i ? "text-gray-900" : "text-gray-500"
                    }`}>{scenario.feature}</span>
                    {activeFeature === i && (
                      <ArrowRight className="h-3.5 w-3.5 text-primary ml-auto" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Demo preview */}
          <div className="md:col-span-3 p-6 md:p-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {DEMO_SCENARIOS[activeFeature].feature}
              </span>
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 min-h-[220px]">
              {DEMO_SCENARIOS[activeFeature].demo}
            </div>
            {/* Progress dots */}
            <div className="flex items-center justify-center gap-2 mt-4">
              {DEMO_SCENARIOS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveFeature(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    activeFeature === i ? "w-6 bg-primary" : "w-2 bg-gray-300"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}