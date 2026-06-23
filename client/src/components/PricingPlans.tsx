/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { PLANS, yearlyNOK, yearlyPerMonthNOK, ANNUAL_DISCOUNT } from "@shared/pricing";

const SAVE_PCT = Math.round(ANNUAL_DISCOUNT * 100); // 10

/**
 * Landing-page pricing cards. Driven entirely by @shared/pricing so it always
 * mirrors the /pricing page and the backend.
 */
export default function PricingPlans() {
  const [yearly, setYearly] = useState(false);

  return (
    <div>
      {/* Monthly / yearly toggle */}
      <div className="flex items-center justify-center gap-2 mb-10">
        <button
          onClick={() => setYearly(false)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition ${
            !yearly ? "bg-primary text-white shadow" : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Månedlig
        </button>
        <button
          onClick={() => setYearly(true)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition inline-flex items-center gap-2 ${
            yearly ? "bg-primary text-white shadow" : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Årlig
          <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
            Spar {SAVE_PCT}%
          </span>
        </button>
      </div>

      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6 items-start">
        {PLANS.map((plan) => {
          const isYearly = yearly && plan.monthlyNOK > 0;
          const price = isYearly ? yearlyPerMonthNOK(plan.monthlyNOK) : plan.monthlyNOK;

          return (
            <div
              key={plan.key}
              className={`bg-white rounded-2xl p-8 transition-all duration-300 relative overflow-hidden ${
                plan.highlighted
                  ? "border-2 border-primary shadow-xl shadow-primary/10 hover:shadow-2xl hover:shadow-primary/15 md:scale-105"
                  : "border border-gray-200 hover:shadow-lg"
              }`}
            >
              {plan.highlighted && (
                <>
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-purple-600"></div>
                  <div className="absolute top-4 right-4">
                    <span className="bg-gradient-to-r from-primary to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                      ANBEFALT
                    </span>
                  </div>
                </>
              )}

              <h3 className="text-2xl font-bold mb-2 text-gray-900">{plan.name}</h3>
              <div className="text-5xl font-bold mb-1 text-gray-900">
                {plan.monthlyNOK === 0 ? (
                  "0 kr"
                ) : (
                  <>
                    {price} kr
                    <span className="text-lg font-normal text-gray-500"> / mnd</span>
                  </>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-6 min-h-[20px]">
                {plan.monthlyNOK === 0
                  ? plan.tagline
                  : isYearly
                    ? `${yearlyNOK(plan.monthlyNOK)} kr/år – spar ${SAVE_PCT}%`
                    : `= ${(plan.monthlyNOK / 30).toFixed(2)} kr/dag`}
              </p>

              <ul className="space-y-3 mb-8">
                {plan.features.map((text, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm">{text}</span>
                  </li>
                ))}
                {plan.notIncluded.map((text, i) => (
                  <li key={`x-${i}`} className="flex items-center gap-3 text-gray-400">
                    <span className="h-5 w-5 flex-shrink-0 text-center text-gray-300">—</span>
                    <span className="text-sm">{text}</span>
                  </li>
                ))}
              </ul>

              <Button
                size="lg"
                variant={plan.highlighted ? "default" : "outline"}
                className={`w-full rounded-xl ${
                  plan.highlighted
                    ? "bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 shadow-md"
                    : ""
                }`}
                asChild
              >
                <a href={getLoginUrl()}>
                  {plan.key === "FREE" ? "Start gratis" : `Velg ${plan.name}`}
                  {plan.highlighted && <ArrowRight className="ml-2 h-4 w-4" />}
                </a>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}