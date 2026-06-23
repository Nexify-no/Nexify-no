/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState, useEffect, useRef } from "react";
import { Target, PenTool, Sparkles, CheckCircle2, Linkedin, Twitter, Instagram } from "lucide-react";

export default function HowItWorksDemo() {
  const [activeStep, setActiveStep] = useState(0);
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
      setActiveStep(prev => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(interval);
  }, [isVisible]);

  const steps = [
    {
      icon: Target,
      gradient: "from-blue-500 to-blue-600",
      title: "Velg plattform & tone",
      mockup: (
        <div className="space-y-3">
          <div className="flex gap-2">
            {[
              { name: "LinkedIn", active: true, icon: <Linkedin className="h-3.5 w-3.5" /> },
              { name: "Twitter", active: false, icon: <Twitter className="h-3.5 w-3.5" /> },
              { name: "Instagram", active: false, icon: <Instagram className="h-3.5 w-3.5" /> },
            ].map((p, i) => (
              <div key={i} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-500 ${
                p.active ? "bg-blue-100 text-blue-700 border-2 border-blue-300 shadow-sm scale-105" : "border border-gray-200 text-gray-400"
              }`}>
                {p.icon}
                {p.name}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            {["Profesjonell", "Uformell", "Vennlig"].map((tone, i) => (
              <span key={i} className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                i === 0 ? "bg-primary/10 text-primary border border-primary/20" : "border border-gray-200 text-gray-400"
              }`}>{tone}</span>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-green-600 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            LinkedIn + Profesjonell valgt
          </div>
        </div>
      )
    },
    {
      icon: PenTool,
      gradient: "from-purple-500 to-purple-600",
      title: "Skriv emne eller idé",
      mockup: (
        <div className="space-y-3">
          <div className="p-3 border border-purple-200 bg-purple-50/50 rounded-xl">
            <p className="text-sm text-gray-700 font-medium">
              Hvordan AI endrer markedsføring i 2026
              <span className="inline-block w-0.5 h-4 bg-purple-500 ml-0.5 animate-pulse align-middle"></span>
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["AI", "Markedsføring", "2026", "Trender"].map((tag, i) => (
              <span key={i} className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-600 font-medium">
                #{tag}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-purple-600 font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            AI analyserer emnet ditt...
          </div>
        </div>
      )
    },
    {
      icon: Sparkles,
      gradient: "from-green-500 to-green-600",
      title: "Få innlegg + bilde",
      mockup: (
        <div className="space-y-3">
          <div className="p-3 border border-green-200 bg-green-50/50 rounded-xl text-xs text-gray-600 leading-relaxed">
            <p className="font-medium text-gray-800 mb-1">🚀 AI revolusjonerer markedsføring!</p>
            <p>I 2026 ser vi en dramatisk endring i hvordan bedrifter kommuniserer...</p>
          </div>
          <div className="h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg flex items-center justify-center border border-green-200">
            <span className="text-xs text-green-600 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              AI-bilde generert
            </span>
          </div>
          <div className="flex gap-2">
            <span className="flex-1 text-center text-xs py-1.5 rounded-lg bg-green-500 text-white font-medium">Kopier</span>
            <span className="flex-1 text-center text-xs py-1.5 rounded-lg border border-gray-200 text-gray-500 font-medium">Regenerer</span>
          </div>
        </div>
      )
    }
  ];

  return (
    <div ref={containerRef} className="mt-12 max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
        <div className="grid md:grid-cols-2">
          {/* Left: Steps */}
          <div className="p-6 md:p-8 border-r border-gray-100">
            <div className="space-y-4">
              {steps.map((step, i) => (
                <button
                  key={i}
                  onClick={() => setActiveStep(i)}
                  className={`w-full text-left p-4 rounded-xl transition-all duration-500 ${
                    activeStep === i
                      ? "bg-gray-50 border border-gray-200 shadow-sm"
                      : "hover:bg-gray-50/50"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 flex-shrink-0 bg-gradient-to-br ${step.gradient} rounded-xl flex items-center justify-center shadow-md transition-all duration-500 ${
                      activeStep === i ? "scale-110" : "opacity-60"
                    }`}>
                      <step.icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400">0{i + 1}</span>
                        <h4 className={`font-bold transition-colors duration-300 ${
                          activeStep === i ? "text-gray-900" : "text-gray-500"
                        }`}>{step.title}</h4>
                      </div>
                      {activeStep === i && (
                        <div className="mt-1 h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-primary to-purple-600 rounded-full animate-progress-bar"></div>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Live Preview */}
          <div className="p-6 md:p-8 bg-gray-50/50">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Live forhåndsvisning</span>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 min-h-[200px] shadow-sm">
              {steps[activeStep].mockup}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}