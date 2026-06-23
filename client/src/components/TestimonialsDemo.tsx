/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState, useEffect, useRef } from "react";
import { Star, TrendingUp, Clock, BarChart3, ArrowRight, Sparkles } from "lucide-react";

const RESULTS = [
  {
    name: "Erik J.",
    role: "Markedssjef",
    metric: "Engagement",
    before: "1.2%",
    after: "4.8%",
    change: "+300%",
    icon: TrendingUp,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200"
  },
  {
    name: "Sara L.",
    role: "Gründer",
    metric: "Tid per innlegg",
    before: "45 min",
    after: "2 min",
    change: "-96%",
    icon: Clock,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200"
  },
  {
    name: "Magnus O.",
    role: "Frilanser",
    metric: "Innlegg per uke",
    before: "2",
    after: "14",
    change: "+600%",
    icon: BarChart3,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200"
  }
];

export default function TestimonialsDemo() {
  const [activeResult, setActiveResult] = useState(0);
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
      setActiveResult(prev => (prev + 1) % RESULTS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [isVisible]);

  const result = RESULTS[activeResult];
  const Icon = result.icon;

  return (
    <div ref={containerRef} className="mt-12 max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-gray-800">Resultater fra ekte brukere</span>
            </div>
            <div className="flex gap-1.5">
              {RESULTS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveResult(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    activeResult === i ? "w-6 bg-primary" : "w-2 bg-gray-300"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Result Card */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* User info */}
            <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl">
              <div className={`h-12 w-12 rounded-full ${result.bgColor} flex items-center justify-center mb-2 border ${result.borderColor}`}>
                <span className={`text-lg font-bold ${result.color}`}>{result.name[0]}</span>
              </div>
              <p className="text-sm font-bold text-gray-800">{result.name}</p>
              <p className="text-xs text-gray-500">{result.role}</p>
              <div className="flex items-center gap-0.5 mt-2">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
            </div>

            {/* Before/After */}
            <div className="md:col-span-2 p-4 rounded-xl border border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`h-4 w-4 ${result.color}`} />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{result.metric}</span>
              </div>
              
              <div className="grid grid-cols-3 gap-3 items-center">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">Før</p>
                  <p className="text-lg font-bold text-gray-400 line-through">{result.before}</p>
                </div>
                
                <div className="flex items-center justify-center">
                  <ArrowRight className="h-5 w-5 text-primary" />
                </div>
                
                <div className={`text-center p-3 ${result.bgColor} rounded-lg border ${result.borderColor}`}>
                  <p className="text-xs text-gray-500 mb-1">Etter</p>
                  <p className={`text-lg font-bold ${result.color}`}>{result.after}</p>
                </div>
              </div>

              <div className={`mt-3 text-center py-2 ${result.bgColor} rounded-lg border ${result.borderColor}`}>
                <span className={`text-sm font-bold ${result.color}`}>{result.change}</span>
                <span className="text-xs text-gray-500 ml-1">forbedring</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}