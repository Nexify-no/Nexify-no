/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Search, X } from "lucide-react";

// Built-in fallback FAQs (shown when the FAQ database is empty, so the page is
// never blank). Norwegian, grouped by category.
const FALLBACK_FAQS = [
  { id: "f1", category: "Komme i gang", question: "Hva er Penna?", answer: "Penna er en norsk AI-tjeneste som hjelper deg å lage profesjonelt innhold til sosiale medier (LinkedIn, X, Instagram og Facebook) på sekunder – med riktig tone for hver plattform." },
  { id: "f2", category: "Komme i gang", question: "Trenger jeg kredittkort for å prøve?", answer: "Nei. Du får 2 gratis innlegg uten å oppgi betalingsinformasjon, og kan avbryte når som helst." },
  { id: "f3", category: "Komme i gang", question: "Hvilke plattformer støttes?", answer: "LinkedIn, X (Twitter), Instagram og Facebook. Automatisk publisering til LinkedIn er tilgjengelig nå; flere plattformer kommer." },
  { id: "f4", category: "Priser og abonnement", question: "Hva koster Penna?", answer: "Pro koster 199 kr/måned (15 innlegg) og Premium 399 kr/måned (30 innlegg) – begge med AI-bilder og planlegging. Alle priser er i NOK. Selskapet er foreløpig ikke registrert i Merverdiavgiftsregisteret, og prisene er derfor uten MVA." },
  { id: "f5", category: "Priser og abonnement", question: "Kan jeg si opp når som helst?", answer: "Ja. Det er ingen bindingstid. Du sier opp i Innstillinger og beholder tilgangen ut perioden du allerede har betalt for." },
  { id: "f6", category: "Priser og abonnement", question: "Hvilke betalingsmetoder kan jeg bruke?", answer: "Du kan betale med kort eller Vipps." },
  { id: "f7", category: "Funksjoner", question: "Lager Penna innhold på norsk?", answer: "Ja. Penna er bygget spesielt for norsk språk og tone, så innholdet høres naturlig ut – ikke maskinoversatt." },
  { id: "f8", category: "Funksjoner", question: "Kan jeg lære AI-en min egen stemme?", answer: "Ja. Med Stemmetrening (Pro) lærer AI-en din unike stil, slik at innholdet alltid høres ut som deg." },
  { id: "f9", category: "Funksjoner", question: "Eier jeg innholdet som genereres?", answer: "Ja, du eier 100 % av innholdet du lager med Penna og kan bruke det fritt, også kommersielt." },
  { id: "f10", category: "Personvern og sikkerhet", question: "Hvordan håndteres personopplysningene mine?", answer: "Vi følger GDPR. Personvernerklæringen vår viser hvilke databehandlere vi bruker og hvilke rettigheter du har. Du kan også klage til Datatilsynet." },
];

export default function FAQ() {
  const [searchQuery, setSearchQuery] = useState("");
  const [language] = useState("no");

  // Fetch all FAQs from database
  const { data: allFAQs = [], isLoading: isLoadingFAQs } = trpc.faq.getAll.useQuery(
    { language },
    { staleTime: 1000 * 60 * 5 }
  );

  // Fetch categories
  const { data: categories = [] } = trpc.faq.getCategories.useQuery(
    { language },
    { staleTime: 1000 * 60 * 5 }
  );

  // Search FAQs
  const { data: searchResults = [] } = trpc.faq.search.useQuery(
    { query: searchQuery, language },
    { enabled: searchQuery.length > 0, staleTime: 1000 * 60 * 5 }
  );

  // Legacy fallback categories (for backward compatibility) - kept for reference

  // Filter FAQs based on search and category
  // When the FAQ database is empty, fall back to the built-in list so the page is
  // never blank, and run search client-side over the fallback set.
  const usingFallback = !isLoadingFAQs && allFAQs.length === 0;
  const filteredFAQs = useMemo(() => {
    if (usingFallback) {
      if (searchQuery.length === 0) return FALLBACK_FAQS;
      const q = searchQuery.toLowerCase();
      return FALLBACK_FAQS.filter(
        (f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
      );
    }
    return searchQuery.length > 0 ? searchResults : allFAQs;
  }, [searchQuery, searchResults, allFAQs, usingFallback]);

  // Group FAQs by category
  const groupedFAQs = useMemo(() => {
    const groups: Record<string, typeof filteredFAQs> = {};
    filteredFAQs.forEach((faq: any) => {
      if (!groups[faq.category]) {
        groups[faq.category] = [];
      }
      groups[faq.category].push(faq);
    });
    return groups;
  }, [filteredFAQs]);


  const handleClearSearch = () => {
    setSearchQuery("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Ofte Stilte Spørsmål
          </h1>
          <p className="text-lg text-gray-600">
            Finn svar på vanlige spørsmål om Penna
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Søk etter spørsmål..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 py-3 text-base"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2">
            {categories.map((category: any) => (
              <Button
                key={category}
                variant="outline"
                className="rounded-full"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {isLoadingFAQs && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="text-gray-600 mt-4">Laster inn spørsmål...</p>
          </div>
        )}

        {/* No Results */}
        {!isLoadingFAQs && filteredFAQs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">
              {searchQuery
                ? "Ingen spørsmål funnet som matcher søket ditt"
                : "Ingen spørsmål tilgjengelig"}
            </p>
          </div>
        )}

        {/* FAQs by Category */}
        {!isLoadingFAQs && filteredFAQs.length > 0 && (
          <div className="space-y-8">
            {Object.entries(groupedFAQs).map(([category, faqs]) => (
              <div key={category} className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  {category}
                </h2>
                <Accordion type="single" collapsible className="w-full">
                  {faqs.map((faq: any, index: any) => (
                    <AccordionItem key={faq.id} value={`${category}-${index}`}>
                      <AccordionTrigger className="text-left hover:text-indigo-600">
                        <span className="text-base font-medium">
                          {faq.question}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="text-gray-600 pt-2">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        )}

        {/* Result Count */}
        {!isLoadingFAQs && filteredFAQs.length > 0 && (
          <div className="mt-8 text-center text-gray-600">
            <p>
              Viser {filteredFAQs.length} av {usingFallback ? FALLBACK_FAQS.length : allFAQs.length} spørsmål
            </p>
          </div>
        )}
      </div>
    </div>
  );
}