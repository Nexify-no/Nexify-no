/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Calendar, Clock, User } from "lucide-react";
import SocialShareButtons from "@/components/SocialShareButtons";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import DOMPurify from "dompurify";

export default function BlogPost() {
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug || "";

  const { data: post, isLoading } = trpc.blog.getBySlug.useQuery({ slug }, {
    enabled: !!slug,
  });

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

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("no-NO", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex flex-col items-center gap-4"><div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div><p className="text-sm text-muted-foreground animate-pulse">Laster...</p></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Innlegg ikke funnet</h1>
          <Link href="/blog">
            <Button variant="outline">Tilbake til blog</Button>
          </Link>
        </div>
      </div>
    );
  }

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.excerpt,
    "image": post.coverImage,
    "datePublished": new Date(post.createdAt).toISOString(),
    "dateModified": new Date(post.updatedAt).toISOString(),
    "author": {
      "@type": "Person",
      "name": post.authorName,
      "jobTitle": post.authorRole || "Content Writer"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Nexify AI",
      "logo": {
        "@type": "ImageObject",
        "url": "https://innlegg.no/logo.png"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://innlegg.no/blog/${post.slug}`
    }
  };

  return (
    <>
      <Helmet>
        <title>{post.title} - Nexify AI Blog</title>
        <meta name="description" content={post.excerpt} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.excerpt} />
        <meta property="og:type" content="article" />
        <meta property="og:image" content={post.coverImage || ''} />
        <meta property="og:url" content={`https://innlegg.no/blog/${post.slug}`} />
        <meta property="article:published_time" content={new Date(post.createdAt).toISOString()} />
        <meta property="article:modified_time" content={new Date(post.updatedAt).toISOString()} />
        <meta property="article:author" content={post.authorName} />
        <meta property="article:tag" content={post.category} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={post.excerpt} />
        <meta name="twitter:image" content={post.coverImage || ''} />
        <meta name="keywords" content={post.tags ? (() => { try { return JSON.parse(post.tags!).join(", "); } catch { return post.tags || ""; } })() : ""} />
        <meta name="author" content={post.authorName} />
        <link rel="canonical" href={`https://innlegg.no/blog/${post.slug}`} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }} />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        {/* Header */}
        <header className="border-b">
          <div className="container py-6">
            <Link href="/blog">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tilbake til blog
              </Button>
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="container py-12">
          <article className="max-w-3xl mx-auto">
            {/* Meta Info */}
            <div className="mb-8">
              <div className="flex flex-wrap gap-2 mb-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(post.category)}`}>
                  {getCategoryLabel(post.category)}
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl font-bold mb-4">{post.title}</h1>

              <p className="text-xl text-muted-foreground mb-6">{post.excerpt}</p>

              <div className="flex flex-wrap gap-6 text-sm text-muted-foreground border-b pb-6">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{post.authorName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(post.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{post.readingTime || 5} min read</span>
                </div>
              </div>
            </div>

            {/* Featured Image */}
            {post.coverImage && (
              <div className="mb-8 rounded-lg overflow-hidden">
                <img
                  src={post.coverImage}
                  alt={post.title}
                  className="w-full h-96 object-cover"
                />
              </div>
            )}

            {/* Content */}
            <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none mb-12">
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }} />
            </div>

            {/* Tags */}
            {post.tags && (
              <div className="mb-12 pb-12 border-b">
                <h3 className="text-sm font-semibold mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {(() => { try { return JSON.parse(post.tags!); } catch { return []; } })().map((tag: string) => (
                    <Link key={tag} href={`/blog?tag=${tag}`}>
                      <Button variant="outline" size="sm">
                        #{tag}
                      </Button>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Social Share */}
            <div className="mb-12">
              <h3 className="text-sm font-semibold mb-4">Del denne artikkelen</h3>
              <SocialShareButtons
                title={post.title}
                description={post.excerpt}
                url={`https://innlegg.no/blog/${post.slug}`}
                hashtags={post.tags ? (() => { try { return JSON.parse(post.tags!); } catch { return []; } })() : []}
              />
            </div>

            {/* Author Bio */}
            <Card className="p-6 bg-muted/50">
              <div className="flex gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">Om forfatteren</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {post.authorName} er {post.authorRole || "content creator"} hos Nexify AI.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Liker å skrive om AI, markedsføring og sosiale medier.
                  </p>
                </div>
              </div>
            </Card>
          </article>
        </main>
      </div>
    </>
  );
}