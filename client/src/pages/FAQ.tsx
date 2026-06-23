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
  const filteredFAQs = useMemo(() => {
    const result = searchQuery.length > 0 ? searchResults : allFAQs;
    return result;
  }, [searchQuery, searchResults, allFAQs]);

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
            Finn svar på vanlige spørsmål om Innlegg
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
              Viser {filteredFAQs.length} av {allFAQs.length} spørsmål
            </p>
          </div>
        )}
      </div>
    </div>
  );
}