/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Helmet } from 'react-helmet-async';
import { BookOpen, Clock, Eye, Search, X } from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo } from "react";

export default function Blog() {
  const { data: posts, isLoading } = trpc.blog.list.useQuery();
  const [searchQuery, setSearchQuery] = useState("");

  // Filter posts based on search query
  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    if (!searchQuery.trim()) return posts;

    const query = searchQuery.toLowerCase();
    return posts.filter(
      (post) =>
        post.title.toLowerCase().includes(query) ||
        post.excerpt.toLowerCase().includes(query) ||
        post.content.toLowerCase().includes(query)
    );
  }, [posts, searchQuery]);

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      tips: "Tips & Tricks",
      guides: "Guider",
      news: "Nyheter",
      "case-studies": "Case Studies",
    };
    return labels[category] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      tips: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      guides: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      news: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      "case-studies": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    };
    return colors[category] || "bg-gray-100 text-gray-700";
  };

  return (
    <>
      <Helmet>
        <title>Nexify AI Blog - Tips og guider om innholdsproduksjon med AI</title>
        <meta name="description" content="Les våre artikler om hvordan du kan bruke AI til å lage profesjonelt innhold for LinkedIn, Twitter, Instagram og Facebook. Tips, guider og best practices." />
        <meta property="og:title" content="Nexify AI Blog - Tips og guider om innholdsproduksjon med AI" />
        <meta property="og:description" content="Les våre artikler om hvordan du kan bruke AI til å lage profesjonelt innhold for LinkedIn, Twitter, Instagram og Facebook." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Nexify AI Blog - Tips og guider om innholdsproduksjon med AI" />
        <meta name="twitter:description" content="Les våre artikler om hvordan du kan bruke AI til å lage profesjonelt innhold." />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container py-16">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="h-8 w-8" />
              <h1 className="text-4xl font-bold">Nexify AI Blog</h1>
            </div>
            <p className="text-xl text-blue-100">
              Tips, guider og innsikt om innholdsproduksjon med AI
            </p>
          </div>
        </div>
      </header>

      {/* Search Bar */}
      <div className="container py-8">
        <div className="max-w-2xl mx-auto relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Søk i artikler..."
            className="w-full pl-12 pr-12 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Results Count */}
        {searchQuery && (
          <p className="text-sm text-muted-foreground mt-4 text-center">
            {filteredPosts.length === 0
              ? "Ingen artikler funnet"
              : `${filteredPosts.length} ${filteredPosts.length === 1 ? "artikkel" : "artikler"} funnet`}
          </p>
        )}
      </div>

      <main className="container pb-12">
        {/* No Results Message */}
        {!isLoading && filteredPosts.length === 0 && searchQuery && (
          <div className="text-center py-12">
            <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Ingen artikler funnet</h3>
            <p className="text-muted-foreground mb-6">
              Prøv å søke med andre søkeord eller se alle artikler
            </p>
            <Button onClick={() => setSearchQuery("")} variant="outline">
              Vis alle artikler
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-muted rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredPosts.length > 0 ? (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {filteredPosts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <Card className="h-full cursor-pointer hover:shadow-xl transition-all hover:scale-105">
                  {post.coverImage && (
                    <div className="h-48 overflow-hidden rounded-t-lg">
                      <img
                        src={post.coverImage}
                        alt={post.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${getCategoryColor(post.category)}`}>
                        {getCategoryLabel(post.category)}
                      </span>
                    </div>
                    <CardTitle className="line-clamp-2">{post.title}</CardTitle>
                    <CardDescription className="line-clamp-3">{post.excerpt}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{post.readingTime} min</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        <span>{post.viewCount}</span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Button variant="outline" className="w-full">Les mer</Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Ingen artikler ennå</h3>
            <p className="text-muted-foreground">Kom tilbake snart for spennende innhold!</p>
          </div>
        )}
      </main>
    </div>
    </>
  );
}