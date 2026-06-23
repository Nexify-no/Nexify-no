/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Copy, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface HashtagSuggestionsProps {
  contentTitle?: string;
  contentExcerpt?: string;
  platform?: "linkedin" | "twitter" | "instagram" | "facebook";
  onSelect?: (hashtags: string[]) => void;
}

export default function HashtagSuggestions({
  contentTitle = "",
  contentExcerpt = "",
  platform = "linkedin",
  onSelect,
}: HashtagSuggestionsProps) {
  const [title, setTitle] = useState(contentTitle);
  const [excerpt, setExcerpt] = useState(contentExcerpt);
  const [selectedPlatform, setSelectedPlatform] = useState(platform);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const generateMutation = trpc.hashtags.generateSuggestions.useMutation();
  const { data: trendingData } = trpc.hashtags.getTrending.useQuery({
    platform: selectedPlatform,
  });

  const handleGenerate = async () => {
    if (!title.trim() || !excerpt.trim()) {
      toast.error("Please enter both title and content");
      return;
    }

    try {
      await generateMutation.mutateAsync({
        contentTitle: title,
        contentExcerpt: excerpt,
        platform: selectedPlatform,
      });
      toast.success("Hashtags generated successfully!");
    } catch (error) {
      toast.error("Failed to generate hashtags");
    }
  };

  const handleCopyHashtag = (hashtag: string, index: number) => {
    navigator.clipboard.writeText(hashtag);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast.success("Copied to clipboard!");
  };

  const handleSelectAll = () => {
    if (generateMutation.data?.hashtags) {
      const hashtags = generateMutation.data.hashtags.map((h: any) => h.hashtag);
      onSelect?.(hashtags);
      toast.success("Hashtags selected!");
    }
  };

  const suggestions = generateMutation.data?.hashtags || [];

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          Generate Hashtag Suggestions
        </h3>

        <div className="space-y-4">
          {/* Title Input */}
          <div>
            <label className="text-sm font-medium mb-2 block">Content Title</label>
            <Input
              placeholder="e.g., 10 Tips for Better Social Media Marketing"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Excerpt Input */}
          <div>
            <label className="text-sm font-medium mb-2 block">Content Preview</label>
            <Textarea
              placeholder="Paste a preview of your content (2-3 sentences)"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={3}
            />
          </div>

          {/* Platform Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Platform</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {["linkedin", "twitter", "instagram", "facebook"].map((p) => (
                <Button
                  key={p}
                  variant={selectedPlatform === p ? "default" : "outline"}
                  onClick={() => setSelectedPlatform(p as any)}
                  className="capitalize"
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending || !title.trim() || !excerpt.trim()}
            className="w-full"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Hashtags
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Suggestions Section */}
      {suggestions.length > 0 && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Suggested Hashtags</h3>
            {onSelect && (
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                Select All
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {suggestions.map((hashtag: any, index: number) => (
              <div
                key={index}
                className="relative group"
              >
                <button
                  onClick={() => handleCopyHashtag(hashtag.hashtag, index)}
                  className="w-full p-3 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors text-sm font-medium text-left flex items-center justify-between"
                >
                  <span>{hashtag.hashtag}</span>
                  {copiedIndex === index ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
                {hashtag.trending && (
                  <span className="absolute top-1 right-1 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    Trending
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Relevance Score */}
          {generateMutation.data?.suggestion?.relevanceScore && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Relevance Score: <span className="font-semibold text-foreground">
                  {generateMutation.data.suggestion.relevanceScore}%
                </span>
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Trending Hashtags */}
      {trendingData && trendingData.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            Trending on {selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)}
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {trendingData.slice(0, 12).map((hashtag, index) => (
              <div
                key={index}
                className="p-3 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors cursor-pointer text-sm font-medium text-center"
                onClick={() => handleCopyHashtag(hashtag.hashtag, index + 100)}
              >
                <div>{hashtag.hashtag}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Score: {hashtag.trendScore}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}