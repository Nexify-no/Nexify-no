/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState, useEffect, useRef } from "react";
import { Clock, Zap, TrendingUp, CheckCircle2 } from "lucide-react";

export default function PricingDemo() {
  const [showSavings, setShowSavings] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setShowSavings(true); },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const comparisons = [
    { task: "Skrive 1 innlegg", without: "45 min", with: "30 sek", saved: "44.5 min" },
    { task: "Finne emne/idé", without: "20 min", with: "5 sek", saved: "19.9 min" },
    { task: "Lage bilde", without: "30 min", with: "10 sek", saved: "29.8 min" },
    { task: "20 innlegg/mnd", without: "31+ timer", with: "10 min", saved: "30+ timer" },
  ];

  return (
    <div ref={containerRef} className="mt-12 max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/5 to-purple-500/5 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-gray-800">Tidsbesparelse-kalkulator</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
              <TrendingUp className="h-3 w-3" />
              Spar 30+ timer/mnd
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="p-5">
          <div className="grid grid-cols-4 gap-3 mb-3 px-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Oppgave</span>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Uten AI</span>
            <span className="text-xs font-bold text-primary uppercase tracking-wider text-center">Med Nexify</span>
            <span className="text-xs font-bold text-green-600 uppercase tracking-wider text-center">Spart</span>
          </div>
          
          {comparisons.map((row, i) => (
            <div 
              key={i} 
              className={`grid grid-cols-4 gap-3 p-3 rounded-lg transition-all duration-500 ${
                showSavings ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
              } ${i % 2 === 0 ? "bg-gray-50" : ""}`}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              <span className="text-sm font-medium text-gray-700">{row.task}</span>
              <span className="text-sm text-gray-400 text-center line-through">{row.without}</span>
              <span className="text-sm font-bold text-primary text-center">{row.with}</span>
              <span className="text-sm font-bold text-green-600 text-center">{row.saved}</span>
            </div>
          ))}

          {/* Bottom summary */}
          <div className={`mt-4 p-4 bg-gradient-to-r from-primary/5 to-purple-500/5 rounded-xl border border-primary/10 flex items-center justify-between transition-all duration-700 ${
            showSavings ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`} style={{ transitionDelay: "600ms" }}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">199 kr/mnd = 6,60 kr/dag</p>
                <p className="text-xs text-gray-500">Billigere enn en kaffe - sparer 30+ timer</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              ROI: 150x
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}