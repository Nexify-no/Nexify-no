/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Instagram, Heart, MessageCircle, Share2, ThumbsUp, Repeat2, Bookmark, Send, MoreHorizontal } from "lucide-react";

interface LivePostPreviewProps {
  content: string;
  platform: "linkedin" | "twitter" | "facebook" | "instagram";
  imageUrl?: string;
  userName?: string;
}

export function LivePostPreview({ content, platform, imageUrl, userName = "Din Profil" }: LivePostPreviewProps) {
  const displayContent = content || "Innholdet ditt vises her...";
  const isPlaceholder = !content;

  if (platform === "linkedin") {
    return <LinkedInPreview content={displayContent} imageUrl={imageUrl} userName={userName} isPlaceholder={isPlaceholder} />;
  }
  if (platform === "twitter") {
    return <TwitterPreview content={displayContent} imageUrl={imageUrl} userName={userName} isPlaceholder={isPlaceholder} />;
  }
  if (platform === "instagram") {
    return <InstagramPreview content={displayContent} imageUrl={imageUrl} userName={userName} isPlaceholder={isPlaceholder} />;
  }
  if (platform === "facebook") {
    return <FacebookPreview content={displayContent} imageUrl={imageUrl} userName={userName} isPlaceholder={isPlaceholder} />;
  }
  return null;
}

function LinkedInPreview({ content, imageUrl, userName, isPlaceholder }: { content: string; imageUrl?: string; userName: string; isPlaceholder: boolean }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm max-w-md mx-auto">
      {/* Header */}
      <div className="p-3 flex items-start gap-2">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {userName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900 leading-tight">{userName}</p>
          <p className="text-xs text-gray-500">Innholdsskaper &middot; Nå</p>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z"/></svg>
            Offentlig
          </p>
        </div>
        <MoreHorizontal className="w-5 h-5 text-gray-400 shrink-0" />
      </div>

      {/* Content */}
      <div className={`px-3 pb-2 ${isPlaceholder ? "text-gray-400 italic" : "text-gray-800"}`}>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{content.length > 300 ? content.slice(0, 300) + "...se mer" : content}</p>
      </div>

      {/* Image */}
      {imageUrl && (
        <div className="w-full">
          <img src={imageUrl} alt="Post" className="w-full object-cover max-h-64" />
        </div>
      )}

      {/* Engagement stats */}
      <div className="px-3 py-1.5 flex items-center justify-between text-xs text-gray-500 border-b border-gray-100">
        <div className="flex items-center gap-1">
          <span className="flex -space-x-1">
            <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
              <ThumbsUp className="w-2.5 h-2.5 text-white" />
            </span>
            <span className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
              <Heart className="w-2.5 h-2.5 text-white" />
            </span>
          </span>
          <span>24</span>
        </div>
        <span>3 kommentarer &middot; 2 delinger</span>
      </div>

      {/* Actions */}
      <div className="px-2 py-1 flex items-center justify-between">
        {[
          { icon: ThumbsUp, label: "Liker" },
          { icon: MessageCircle, label: "Kommenter" },
          { icon: Repeat2, label: "Del" },
          { icon: Send, label: "Send" },
        ].map(({ icon: Icon, label }) => (
          <button key={label} className="flex items-center gap-1.5 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded text-xs font-medium">
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TwitterPreview({ content, imageUrl, userName, isPlaceholder }: { content: string; imageUrl?: string; userName: string; isPlaceholder: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-w-md mx-auto">
      <div className="p-3 flex gap-2">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {userName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          {/* Name row */}
          <div className="flex items-center gap-1">
            <span className="font-bold text-sm text-gray-900">{userName}</span>
            <svg className="w-4 h-4 text-sky-500" viewBox="0 0 24 24" fill="currentColor"><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z"/></svg>
            <span className="text-gray-500 text-sm">@{userName.toLowerCase().replace(/\s/g, '')} &middot; nå</span>
          </div>

          {/* Content */}
          <div className={`mt-1 ${isPlaceholder ? "text-gray-400 italic" : "text-gray-900"}`}>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{content.length > 280 ? content.slice(0, 277) + "..." : content}</p>
          </div>

          {/* Image */}
          {imageUrl && (
            <div className="mt-2 rounded-xl overflow-hidden border border-gray-200">
              <img src={imageUrl} alt="Post" className="w-full object-cover max-h-56" />
            </div>
          )}

          {/* Actions */}
          <div className="mt-2 flex items-center justify-between max-w-xs text-gray-500">
            {[
              { icon: MessageCircle, count: "3" },
              { icon: Repeat2, count: "12" },
              { icon: Heart, count: "48" },
              { icon: Bookmark, count: "" },
              { icon: Share2, count: "" },
            ].map(({ icon: Icon, count }, i) => (
              <button key={i} className="flex items-center gap-1 text-xs hover:text-sky-500 p-1">
                <Icon className="w-4 h-4" />
                {count && <span>{count}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InstagramPreview({ content, imageUrl, userName, isPlaceholder }: { content: string; imageUrl?: string; userName: string; isPlaceholder: boolean }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden max-w-md mx-auto">
      {/* Header */}
      <div className="p-3 flex items-center gap-2 border-b border-gray-100">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 p-0.5">
          <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
            <span className="text-xs font-bold text-gray-800">{userName.charAt(0).toUpperCase()}</span>
          </div>
        </div>
        <span className="font-semibold text-sm text-gray-900">{userName.toLowerCase().replace(/\s/g, '_')}</span>
        <MoreHorizontal className="w-5 h-5 text-gray-600 ml-auto" />
      </div>

      {/* Image placeholder */}
      {imageUrl ? (
        <img src={imageUrl} alt="Post" className="w-full object-cover aspect-square" />
      ) : (
        <div className="w-full aspect-square bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
          <Instagram className="w-16 h-16 text-pink-300" />
        </div>
      )}

      {/* Actions */}
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Heart className="w-6 h-6 text-gray-800" />
          <MessageCircle className="w-6 h-6 text-gray-800" />
          <Send className="w-6 h-6 text-gray-800" />
        </div>
        <Bookmark className="w-6 h-6 text-gray-800" />
      </div>

      {/* Likes */}
      <div className="px-3 pb-1">
        <p className="text-sm font-semibold text-gray-900">156 liker</p>
      </div>

      {/* Caption */}
      <div className={`px-3 pb-3 ${isPlaceholder ? "text-gray-400 italic" : "text-gray-900"}`}>
        <p className="text-sm">
          <span className="font-semibold">{userName.toLowerCase().replace(/\s/g, '_')}</span>{" "}
          <span className="whitespace-pre-wrap">{content.length > 200 ? content.slice(0, 200) + "...mer" : content}</span>
        </p>
      </div>
    </div>
  );
}

function FacebookPreview({ content, imageUrl, userName, isPlaceholder }: { content: string; imageUrl?: string; userName: string; isPlaceholder: boolean }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm max-w-md mx-auto">
      {/* Header */}
      <div className="p-3 flex items-start gap-2">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {userName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm text-gray-900">{userName}</p>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            Nå &middot;
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z"/></svg>
          </p>
        </div>
        <MoreHorizontal className="w-5 h-5 text-gray-400 shrink-0" />
      </div>

      {/* Content */}
      <div className={`px-3 pb-2 ${isPlaceholder ? "text-gray-400 italic" : "text-gray-800"}`}>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{content.length > 400 ? content.slice(0, 400) + "...Se mer" : content}</p>
      </div>

      {/* Image */}
      {imageUrl && (
        <div className="w-full">
          <img src={imageUrl} alt="Post" className="w-full object-cover max-h-72" />
        </div>
      )}

      {/* Engagement */}
      <div className="px-3 py-1.5 flex items-center justify-between text-xs text-gray-500 border-b border-gray-100">
        <div className="flex items-center gap-1">
          <span className="flex -space-x-1">
            <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
              <ThumbsUp className="w-2.5 h-2.5 text-white" />
            </span>
            <span className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
              <Heart className="w-2.5 h-2.5 text-white" />
            </span>
          </span>
          <span>35</span>
        </div>
        <span>8 kommentarer &middot; 5 delinger</span>
      </div>

      {/* Actions */}
      <div className="px-2 py-1 flex items-center justify-between border-t border-gray-100">
        {[
          { icon: ThumbsUp, label: "Liker" },
          { icon: MessageCircle, label: "Kommenter" },
          { icon: Share2, label: "Del" },
        ].map(({ icon: Icon, label }) => (
          <button key={label} className="flex items-center gap-1.5 px-4 py-2 text-gray-600 hover:bg-gray-50 rounded text-sm font-medium flex-1 justify-center">
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}