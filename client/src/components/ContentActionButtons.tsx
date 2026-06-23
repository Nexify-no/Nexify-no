/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Share2, Edit2, Trash2, Check } from 'lucide-react';

interface ContentActionButtonsProps {
  content: string;
  contentId?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  platform?: string;
}

export const ContentActionButtons: React.FC<ContentActionButtonsProps> = ({
  content,
  onEdit,
  onDelete,
  onShare
}) => {

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Delt innlegg',
        text: content,
      }).catch(err => console.log('Error sharing:', err));
    } else if (onShare) {
      onShare();
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {/* Copy Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="gap-2 hover:bg-blue-50"
        title="Kopier innholdet"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-green-600">Kopiert</span>
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            <span>Kopier</span>
          </>
        )}
      </Button>

      {/* Share Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleShare}
        className="gap-2 hover:bg-green-50"
        title="Del innholdet"
      >
        <Share2 className="w-4 h-4" />
        <span>Del</span>
      </Button>

      {/* Edit Button */}
      {onEdit && (
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="gap-2 hover:bg-purple-50"
          title="Rediger innholdet"
        >
          <Edit2 className="w-4 h-4" />
          <span>Rediger</span>
        </Button>
      )}

      {/* Delete Button */}
      {onDelete && (
        <Button
          variant="outline"
          size="sm"
          onClick={onDelete}
          className="gap-2 hover:bg-red-50 text-red-600 hover:text-red-700"
          title="Slett innholdet"
        >
          <Trash2 className="w-4 h-4" />
          <span>Slett</span>
        </Button>
      )}
    </div>
  );
};

export default ContentActionButtons;