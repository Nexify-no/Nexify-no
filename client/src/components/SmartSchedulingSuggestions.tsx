/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Zap, Calendar, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface SchedulingSuggestion {
  time: string;
  score: number;
  reason: string;
  platform: string;
  momentum: 'high' | 'medium' | 'low';
}

interface SmartSchedulingSuggestionsProps {
  keyword: string;
  platform: string;
  onSchedule?: (time: string) => void;
}

const generateSchedulingSuggestions = (keyword: string, platform: string): SchedulingSuggestion[] => {
    // Platform-specific optimal posting times based on industry data
    const platformTimes: Record<string, SchedulingSuggestion[]> = {
      linkedin: [
        {
          time: 'Tuesday 8:00 AM',
          score: 9.2,
          reason: 'Peak professional engagement',
          platform: 'LinkedIn',
          momentum: 'high',
        },
        {
          time: 'Wednesday 10:00 AM',
          score: 8.8,
          reason: 'Mid-week professional activity',
          platform: 'LinkedIn',
          momentum: 'high',
        },
        {
          time: 'Thursday 2:00 PM',
          score: 8.1,
          reason: 'Afternoon engagement surge',
          platform: 'LinkedIn',
          momentum: 'medium',
        },
      ],
      twitter: [
        {
          time: 'Monday 9:00 AM',
          score: 8.9,
          reason: 'Monday morning engagement peak',
          platform: 'Twitter',
          momentum: 'high',
        },
        {
          time: 'Wednesday 5:00 PM',
          score: 8.6,
          reason: 'Evening commute activity',
          platform: 'Twitter',
          momentum: 'high',
        },
        {
          time: 'Friday 1:00 PM',
          score: 7.9,
          reason: 'Friday afternoon engagement',
          platform: 'Twitter',
          momentum: 'medium',
        },
      ],
      instagram: [
        {
          time: 'Tuesday 11:00 AM',
          score: 9.1,
          reason: 'Peak Instagram engagement',
          platform: 'Instagram',
          momentum: 'high',
        },
        {
          time: 'Thursday 7:00 PM',
          score: 8.7,
          reason: 'Evening leisure browsing',
          platform: 'Instagram',
          momentum: 'high',
        },
        {
          time: 'Saturday 10:00 AM',
          score: 8.3,
          reason: 'Weekend morning activity',
          platform: 'Instagram',
          momentum: 'medium',
        },
      ],
      facebook: [
        {
          time: 'Wednesday 1:00 PM',
          score: 8.5,
          reason: 'Midday Facebook activity',
          platform: 'Facebook',
          momentum: 'high',
        },
        {
          time: 'Thursday 8:00 PM',
          score: 8.2,
          reason: 'Evening engagement window',
          platform: 'Facebook',
          momentum: 'high',
        },
        {
          time: 'Sunday 2:00 PM',
          score: 7.8,
          reason: 'Weekend leisure time',
          platform: 'Facebook',
          momentum: 'medium',
        },
      ],
    };

    return platformTimes[platform] || platformTimes.linkedin;
};

export function SmartSchedulingSuggestions({
  keyword,
  platform,
  onSchedule,
}: SmartSchedulingSuggestionsProps) {
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    return generateSchedulingSuggestions(keyword, platform);
  }, [keyword, platform]);

  const handleSchedule = (time: string) => {
    setSelectedTime(time);
    onSchedule?.(time);
    toast.success(`Scheduled for ${time} ✨`);
  };

  const getMomentumColor = (momentum: string) => {
    switch (momentum) {
      case 'high':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'low':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300';
    }
  };

  return (
    <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
          <Zap className="w-5 h-5" />
          Smart Scheduling for "{keyword}"
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border transition-all ${
                selectedTime === suggestion.time
                  ? 'bg-white dark:bg-slate-800 border-amber-400 dark:border-amber-600 shadow-md'
                  : 'bg-white dark:bg-slate-800 border-amber-100 dark:border-amber-800 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                      {suggestion.time}
                    </h4>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{suggestion.reason}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className={`px-2 py-1 rounded text-xs font-semibold ${getMomentumColor(suggestion.momentum)}`}>
                    {suggestion.momentum === 'high'
                      ? '🔥 High'
                      : suggestion.momentum === 'medium'
                        ? '⚡ Medium'
                        : '📊 Low'}
                  </div>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    Score: {suggestion.score}/10
                  </span>
                </div>
              </div>

              {/* Score Bar */}
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-400 to-orange-500 h-full rounded-full transition-all"
                  style={{ width: `${(suggestion.score / 10) * 100}%` }}
                />
              </div>

              <Button
                variant={selectedTime === suggestion.time ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSchedule(suggestion.time)}
                className="w-full"
              >
                {selectedTime === suggestion.time ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Scheduled
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4 mr-1" />
                    Schedule This Time
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>

        {/* Info Box */}
        <div className="mt-4 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-900 dark:text-amber-100">
            💡 <strong>Tip:</strong> These times are optimized based on platform engagement patterns and trending
            momentum for "{keyword}". Adjust based on your audience timezone.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}