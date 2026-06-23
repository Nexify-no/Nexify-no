/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Button } from "@/components/ui/button";
import {
  Linkedin,
  Twitter,
  Facebook,
  MessageCircle,
  Mail,
  Copy,
  Check,
  Share2,
  Send,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface SocialShareButtonsProps {
  title: string;
  description?: string;
  url?: string;
  hashtags?: string[];
  language?: "no" | "en";
}

export default function SocialShareButtons({
  title,
  description,
  url = typeof window !== "undefined" ? window.location.href : "",
  hashtags = [],
  language = "no",
}: SocialShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description || "");
  const encodedHashtags = hashtags.join(",");

  const shareLinks = {
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}&hashtags=${encodedHashtags}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    pinterest: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}`,
    reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedDescription}%0A%0A${encodedUrl}`,
  };

  const handleShare = (platform: string) => {
    const link = shareLinks[platform as keyof typeof shareLinks];
    if (link) {
      window.open(link, "_blank", "width=600,height=400");
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success(language === "no" ? "Lenke kopiert!" : "Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const labels = {
    no: {
      share: "Del",
      linkedin: "Del på LinkedIn",
      twitter: "Del på Twitter",
      facebook: "Del på Facebook",
      whatsapp: "Del på WhatsApp",
      pinterest: "Del på Pinterest",
      reddit: "Del på Reddit",
      telegram: "Del på Telegram",
      email: "Send via e-post",
      copy: "Kopier lenke",
    },
    en: {
      share: "Share",
      linkedin: "Share on LinkedIn",
      twitter: "Share on Twitter",
      facebook: "Share on Facebook",
      whatsapp: "Share on WhatsApp",
      pinterest: "Share on Pinterest",
      reddit: "Share on Reddit",
      telegram: "Share on Telegram",
      email: "Send via Email",
      copy: "Copy Link",
    },
  };

  const currentLabels = labels[language];

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-sm font-medium text-muted-foreground">
        {currentLabels.share}:
      </span>

      {/* LinkedIn */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare("linkedin")}
        title={currentLabels.linkedin}
        className="hover:bg-blue-50"
      >
        <Linkedin className="h-4 w-4" />
        <span className="hidden sm:inline ml-1">LinkedIn</span>
      </Button>

      {/* Twitter */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare("twitter")}
        title={currentLabels.twitter}
        className="hover:bg-sky-50"
      >
        <Twitter className="h-4 w-4" />
        <span className="hidden sm:inline ml-1">Twitter</span>
      </Button>

      {/* Facebook */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare("facebook")}
        title={currentLabels.facebook}
        className="hover:bg-blue-100"
      >
        <Facebook className="h-4 w-4" />
        <span className="hidden sm:inline ml-1">Facebook</span>
      </Button>

      {/* WhatsApp */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare("whatsapp")}
        title={currentLabels.whatsapp}
        className="hover:bg-green-50"
      >
        <MessageCircle className="h-4 w-4" />
        <span className="hidden sm:inline ml-1">WhatsApp</span>
      </Button>

      {/* Pinterest */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare("pinterest")}
        title={currentLabels.pinterest}
        className="hover:bg-red-50"
      >
        <Share2 className="h-4 w-4" />
        <span className="hidden sm:inline ml-1">Pinterest</span>
      </Button>

      {/* Reddit */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare("reddit")}
        title={currentLabels.reddit}
        className="hover:bg-orange-50"
      >
        <Share2 className="h-4 w-4" />
        <span className="hidden sm:inline ml-1">Reddit</span>
      </Button>

      {/* Telegram */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare("telegram")}
        title={currentLabels.telegram}
        className="hover:bg-sky-50"
      >
        <Send className="h-4 w-4" />
        <span className="hidden sm:inline ml-1">Telegram</span>
      </Button>

      {/* Email */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare("email")}
        title={currentLabels.email}
        className="hover:bg-gray-50"
      >
        <Mail className="h-4 w-4" />
        <span className="hidden sm:inline ml-1">E-post</span>
      </Button>

      {/* Copy Link */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopyLink}
        title={currentLabels.copy}
        className="hover:bg-gray-50"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-green-600" />
            <span className="hidden sm:inline ml-1 text-green-600">
              {language === "no" ? "Kopiert" : "Copied"}
            </span>
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">
              {language === "no" ? "Kopier" : "Copy"}
            </span>
          </>
        )}
      </Button>
    </div>
  );
}