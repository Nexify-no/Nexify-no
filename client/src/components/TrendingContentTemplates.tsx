/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Copy, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface TrendingContentTemplatesProps {
  keyword: string;
  platform: string;
  onApplyTemplate?: (content: string) => void;
}

export function TrendingContentTemplates({
  keyword,
  platform,
  onApplyTemplate,
}: TrendingContentTemplatesProps) {
  const [templates, setTemplates] = useState<any[]>([]);
  useState<string | null>(null);

  useEffect(() => {
    // Generate templates based on keyword and platform
    const generatedTemplates = generateTemplates(keyword, platform);
    setTemplates(generatedTemplates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, platform]);

  const generateTemplates = (keyword: string, platform: string) => {
    const hashtags = generateHashtags(keyword);
    const cta = generateCTA(platform);

    return [
      {
        id: 'trending-insight',
        name: 'Trending Insight',
        description: 'Share industry insight on trending topic',
        content: `🔥 Breaking: ${keyword} is trending right now!\n\nHere's what you need to know:\n\n✅ Key insight about ${keyword}\n✅ Why it matters for your business\n✅ Action steps you can take\n\n${cta}\n\n${hashtags}`,
      },
      {
        id: 'trending-question',
        name: 'Trending Question',
        description: 'Engage audience with trending topic question',
        content: `❓ Quick question: What's your take on ${keyword}?\n\nWe're seeing a lot of buzz around this topic, and we'd love to hear your perspective.\n\nShare your thoughts in the comments below! 👇\n\n${cta}\n\n${hashtags}`,
      },
      {
        id: 'trending-tips',
        name: 'Trending Tips',
        description: 'Share actionable tips on trending topic',
        content: `💡 ${keyword} Tips:\n\n1️⃣ First tip about ${keyword}\n2️⃣ Second tip about ${keyword}\n3️⃣ Third tip about ${keyword}\n\nWhich one will you try first?\n\n${cta}\n\n${hashtags}`,
      },
      {
        id: 'trending-story',
        name: 'Trending Story',
        description: 'Tell a story related to trending topic',
        content: `📖 Story: How ${keyword} Changed Everything\n\nLet me share a quick story about ${keyword}...\n\n[Your story here]\n\nThe key takeaway? [Your insight]\n\n${cta}\n\n${hashtags}`,
      },
    ];
  };

  const generateHashtags = (keyword: string): string => {
    const words = keyword.split(' ').slice(0, 3);
    const hashtags = [
      `#${keyword.replace(/\s+/g, '')}`,
      ...words.map((w) => `#${w}`),
      '#trending',
      '#contentmarketing',
    ];
    return hashtags.join(' ');
  };

  const generateCTA = (platform: string): string => {
    const ctas: Record<string, string> = {
      linkedin: '👉 Share your thoughts in the comments!',
      twitter: '🔄 Retweet if you agree!',
      facebook: '👍 Like and share with your network!',
      instagram: '💬 Drop a comment below!',
    };
    return ctas[platform] || '👉 Let us know your thoughts!';
  };

  const handleApplyTemplate = (content: string) => {
    onApplyTemplate?.(content);
    toast.success('Template applied! ✨');
  };

  const handleCopyTemplate = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Template copied to clipboard!');
  };

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200 dark:border-purple-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-purple-900 dark:text-purple-100">
          <Sparkles className="w-5 h-5" />
          Content Templates for "{keyword}"
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-purple-100 dark:border-purple-800 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                    {template.name}
                  </h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {template.description}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-3 line-clamp-2">
                {template.content}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleApplyTemplate(template.content)}
                  className="flex-1"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Apply
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyTemplate(template.content)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}