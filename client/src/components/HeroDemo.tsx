/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState, useEffect, useRef } from "react";
import { Sparkles, CheckCircle2, Image, Copy, ArrowRight } from "lucide-react";

const PLATFORMS = [
  { name: "LinkedIn", icon: "in", color: "bg-blue-600", selected: true },
  { name: "Twitter", icon: "𝕏", color: "bg-black", selected: false },
  { name: "Instagram", icon: "📷", color: "bg-gradient-to-br from-purple-500 to-pink-500", selected: false },
];

const TYPING_TEXT = "Hvordan AI endrer markedsføring i 2026";

const GENERATED_POST = `🚀 AI revolusjonerer markedsføring!

I 2026 ser vi en dramatisk endring i hvordan bedrifter kommuniserer med sine kunder.

AI-verktøy gjør det mulig å:
✅ Skape personlig innhold på sekunder
✅ Analysere engasjement i sanntid
✅ Optimalisere publiseringstidspunkt

Fremtiden tilhører de som omfavner teknologi.

#AI #Markedsføring #LinkedIn #Innovasjon`;

// Steps: 0=idle, 1=selecting platform, 2=typing topic, 3=generating, 4=showing result, 5=copied
type DemoStep = 0 | 1 | 2 | 3 | 4 | 5;

export default function HeroDemo() {
  const [step, setStep] = useState<DemoStep>(0);
  const [typedText, setTypedText] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState(-1);
  const [showPost, setShowPost] = useState(false);
  const [postReveal, setPostReveal] = useState(0);
  const [showImage, setShowImage] = useState(false);
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const hasStarted = useRef(false);

  // Intersection observer to start animation when visible
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Main animation sequence
  useEffect(() => {
    if (!isVisible || hasStarted.current) return;
    hasStarted.current = true;

    const runSequence = () => {
      // Reset
      setStep(0);
      setTypedText("");
      setSelectedPlatform(-1);
      setShowPost(false);
      setPostReveal(0);
      setShowImage(false);
      setCopied(false);
      setProgress(0);

      // Step 1: Select platform (after 800ms)
      timerRef.current = setTimeout(() => {
        setStep(1);
        setSelectedPlatform(0);

        // Step 2: Start typing (after 1200ms)
        timerRef.current = setTimeout(() => {
          setStep(2);
          let charIndex = 0;
          intervalRef.current = setInterval(() => {
            charIndex++;
            setTypedText(TYPING_TEXT.slice(0, charIndex));
            if (charIndex >= TYPING_TEXT.length) {
              if (intervalRef.current) clearInterval(intervalRef.current);

              // Step 3: Generate (after 600ms)
              timerRef.current = setTimeout(() => {
                setStep(3);
                let prog = 0;
                intervalRef.current = setInterval(() => {
                  prog += 2;
                  setProgress(prog);
                  if (prog >= 100) {
                    if (intervalRef.current) clearInterval(intervalRef.current);

                    // Step 4: Show result
                    timerRef.current = setTimeout(() => {
                      setStep(4);
                      setShowPost(true);

                      // Reveal post text line by line
                      let lines = 0;
                      const totalLines = GENERATED_POST.split("\n").length;
                      intervalRef.current = setInterval(() => {
                        lines++;
                        setPostReveal(lines);
                        if (lines >= totalLines) {
                          if (intervalRef.current) clearInterval(intervalRef.current);

                          // Show image after text
                          timerRef.current = setTimeout(() => {
                            setShowImage(true);

                            // Step 5: Copy
                            timerRef.current = setTimeout(() => {
                              setStep(5);
                              setCopied(true);

                              // Restart after 4s
                              timerRef.current = setTimeout(() => {
                                hasStarted.current = false;
                                setIsVisible(true);
                                runSequence();
                              }, 4000);
                            }, 1500);
                          }, 600);
                        }
                      }, 80);
                    }, 300);
                  }
                }, 30);
              }, 600);
            }
          }, 45);
        }, 1200);
      }, 800);
    };

    runSequence();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isVisible]);

  const visiblePostLines = GENERATED_POST.split("\n").slice(0, postReveal);

  return (
    <div ref={containerRef} className="max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl shadow-gray-200/50 overflow-hidden">
        {/* Browser chrome */}
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-400"></div>
            <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
            <div className="h-3 w-3 rounded-full bg-green-400"></div>
          </div>
          <div className="flex-1 flex justify-center">
            <div className="bg-white rounded-lg px-4 py-1.5 text-xs text-gray-400 border border-gray-200 min-w-[200px] text-center">
              nexify.ai/generate
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8">
          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[
              { label: "Velg plattform", active: step >= 1 },
              { label: "Skriv emne", active: step >= 2 },
              { label: "Generer", active: step >= 3 },
              { label: "Ferdig!", active: step >= 4 },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-500 ${
                  s.active 
                    ? "bg-primary/10 text-primary border border-primary/20" 
                    : "bg-gray-100 text-gray-400 border border-gray-200"
                }`}>
                  <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    s.active ? "bg-primary text-white" : "bg-gray-300 text-white"
                  }`}>{i + 1}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < 3 && <ArrowRight className={`h-3 w-3 transition-colors duration-500 ${s.active ? "text-primary/40" : "text-gray-300"}`} />}
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            {/* Left: Input Side */}
            <div className="space-y-4">
              {/* Platform Selection */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Velg plattform</p>
                <div className="flex gap-2">
                  {PLATFORMS.map((p, i) => (
                    <button
                      key={i}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                        selectedPlatform === i
                          ? "bg-blue-100 text-blue-700 border-2 border-blue-300 shadow-sm scale-105"
                          : "border border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      {i === 0 && (
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                      )}
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic Input */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Emne</p>
                <div className={`p-4 border rounded-xl transition-all duration-300 ${
                  step >= 2 ? "border-primary/30 bg-primary/5 shadow-sm" : "border-gray-200 bg-gray-50"
                }`}>
                  <p className={`text-sm font-medium min-h-[20px] ${typedText ? "text-gray-800" : "text-gray-300"}`}>
                    {typedText || "Skriv emnet ditt her..."}
                    {step === 2 && typedText.length < TYPING_TEXT.length && (
                      <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse align-middle"></span>
                    )}
                  </p>
                </div>
              </div>

              {/* Tone Selection */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tone</p>
                <div className="flex gap-2">
                  {["Profesjonell", "Uformell", "Vennlig"].map((tone, i) => (
                    <span key={i} className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-300 ${
                      i === 0 
                        ? "bg-primary/10 text-primary border border-primary/20" 
                        : "border border-gray-200 text-gray-500"
                    }`}>{tone}</span>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <button
                className={`w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all duration-500 ${
                  step === 3
                    ? "bg-gradient-to-r from-primary to-purple-600 text-white shadow-lg shadow-primary/25 scale-[1.02]"
                    : step >= 4
                    ? "bg-green-500 text-white shadow-md"
                    : "bg-gradient-to-r from-primary to-purple-600 text-white shadow-md"
                }`}
              >
                {step === 3 ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Genererer... {progress}%
                  </>
                ) : step >= 4 ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Generert!
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generer innlegg + bilde
                  </>
                )}
              </button>

              {/* Progress bar during generation */}
              {step === 3 && (
                <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-purple-600 rounded-full transition-all duration-100"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              )}
            </div>

            {/* Right: Output Side */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Resultat</p>
              
              {!showPost ? (
                <div className={`p-6 border border-dashed rounded-xl flex flex-col items-center justify-center min-h-[280px] transition-all duration-500 ${
                  step === 3 
                    ? "border-primary/30 bg-primary/5" 
                    : "border-gray-200 bg-gray-50"
                }`}>
                  {step === 3 ? (
                    <div className="text-center">
                      <div className="relative mx-auto mb-4">
                        <div className="h-12 w-12 rounded-full border-3 border-primary/20 border-t-primary animate-spin mx-auto"></div>
                      </div>
                      <p className="text-sm font-medium text-primary">AI skriver innlegget ditt...</p>
                      <p className="text-xs text-gray-400 mt-1">Analyserer emne og genererer innhold</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                        <Sparkles className="h-5 w-5 text-gray-300" />
                      </div>
                      <p className="text-sm text-gray-400">Ditt genererte innlegg vises her</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Generated Post */}
                  <div className="p-4 border border-gray-200 rounded-xl bg-gradient-to-br from-blue-50/80 to-purple-50/80 max-h-[200px] overflow-hidden">
                    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                      {visiblePostLines.join("\n")}
                    </div>
                  </div>

                  {/* Generated Image */}
                  {showImage && (
                    <div className="h-28 bg-gradient-to-br from-primary/10 via-purple-500/10 to-blue-400/10 rounded-xl flex items-center justify-center border border-primary/10 overflow-hidden relative">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(99,102,241,0.15),transparent_70%)]"></div>
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(168,85,247,0.12),transparent_70%)]"></div>
                      <div className="flex items-center gap-2 relative z-10">
                        <Image className="h-6 w-6 text-primary/40" />
                        <span className="text-xs text-primary/60 font-medium">AI-generert bilde</span>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button className="flex-1 py-2 px-3 rounded-lg border border-gray-200 text-sm text-gray-600 flex items-center justify-center gap-1.5 hover:bg-gray-50 transition-colors">
                      <Sparkles className="h-3.5 w-3.5" /> Regenerer
                    </button>
                    <button className={`flex-1 py-2 px-3 rounded-lg text-sm flex items-center justify-center gap-1.5 transition-all duration-500 ${
                      copied 
                        ? "bg-green-500 text-white shadow-md scale-105" 
                        : "bg-gray-900 text-white hover:bg-gray-800"
                    }`}>
                      {copied ? (
                        <><CheckCircle2 className="h-3.5 w-3.5" /> Kopiert!</>
                      ) : (
                        <><Copy className="h-3.5 w-3.5" /> Kopier</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Label under demo */}
      <div className="text-center mt-4">
        <p className="text-xs text-gray-400 flex items-center justify-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse"></span>
          Live demo — slik fungerer Nexify AI
        </p>
      </div>
    </div>
  );
}