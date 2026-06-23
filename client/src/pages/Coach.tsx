/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Send, Zap, Loader2, TrendingUp, Target, Award } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { PageHeader } from "@/components/PageHeader";
import { PAGE_DESCRIPTIONS } from "@/lib/pageDescriptions";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Coach() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  useLocation();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: language === "no"
        ? "Hei! Jeg er din personlige innholds-coach. Jeg kan hjelpe deg med å forbedre innleggene dine, gi deg tips, og svare på spørsmål om innholdsstrategi. Hva kan jeg hjelpe deg med i dag?"
        : "Hi! I'm your personal content coach. I can help you improve your posts, give you tips, and answer questions about content strategy. What can I help you with today?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.coach.chat.useMutation({
    onSuccess: (response: any) => {
      setMessages(prev => [...prev, { role: "assistant", content: response.message }]);
      setIsTyping(false);
    },
    onError: () => {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: language === "no" 
          ? "Beklager, noe gikk galt. Prøv igjen." 
          : "Sorry, something went wrong. Please try again."
      }]);
      setIsTyping(false);
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (authLoading || !isAuthenticated) {
    if (!authLoading && !isAuthenticated) {
      window.location.href = getLoginUrl();
      return null;
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
            <Send className="h-6 w-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Laster AI Coach...</p>
        </div>
      </div>
    );
  }

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setIsTyping(true);

    chatMutation.mutate({ message: userMessage });
  };

  const handleQuickAction = (action: string) => {
    let message = "";
    if (language === "no") {
      switch (action) {
        case "compare":
          message = "Sammenlign mine beste innlegg og fortell meg hva de har til felles.";
          break;
        case "tips":
          message = "Gi meg 3 konkrete tips for å forbedre LinkedIn-innleggene mine.";
          break;
        case "challenge":
          message = "Gi meg en utfordring for å forbedre innholdskvaliteten min denne uken.";
          break;
      }
    } else {
      switch (action) {
        case "compare":
          message = "Compare my best posts and tell me what they have in common.";
          break;
        case "tips":
          message = "Give me 3 concrete tips to improve my LinkedIn posts.";
          break;
        case "challenge":
          message = "Give me a challenge to improve my content quality this week.";
          break;
      }
    }

    setInput(message);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <main className="container py-8 max-w-4xl">
        <div className="mb-8">
          <PageHeader title="Personlig Coach" description={PAGE_DESCRIPTIONS.coach} />
          <p className="text-muted-foreground">
            {language === "no" 
              ? "Få personlig veiledning, tips og tilbakemeldinger på innholdsstrategien din."
              : "Get personalized guidance, tips, and feedback on your content strategy."}
          </p>
        </div>

        {/* Suggested Conversation Starters */}
        <Card className="mb-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-900">
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              {language === "no" ? "Kom i gang - Klikk på et spørsmål" : "Get Started - Click a Question"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="justify-start text-left h-auto py-3 px-4 hover:bg-primary/10"
                onClick={() => setInput(language === "no" 
                  ? "Hvordan kan jeg skrive mer engasjerende LinkedIn-innlegg?"
                  : "How can I write more engaging LinkedIn posts?")}
              >
                <span className="text-sm">
                  {language === "no" 
                    ? "💡 Hvordan kan jeg skrive mer engasjerende LinkedIn-innlegg?"
                    : "💡 How can I write more engaging LinkedIn posts?"}
                </span>
              </Button>
              
              <Button 
                variant="outline" 
                className="justify-start text-left h-auto py-3 px-4 hover:bg-primary/10"
                onClick={() => setInput(language === "no" 
                  ? "Hva er de beste tidspunktene å poste på sosiale medier?"
                  : "What are the best times to post on social media?")}
              >
                <span className="text-sm">
                  {language === "no" 
                    ? "⏰ Hva er de beste tidspunktene å poste på sosiale medier?"
                    : "⏰ What are the best times to post on social media?"}
                </span>
              </Button>
              
              <Button 
                variant="outline" 
                className="justify-start text-left h-auto py-3 px-4 hover:bg-primary/10"
                onClick={() => setInput(language === "no" 
                  ? "Gi meg ideer til innhold for neste uke"
                  : "Give me content ideas for next week")}
              >
                <span className="text-sm">
                  {language === "no" 
                    ? "✨ Gi meg ideer til innhold for neste uke"
                    : "✨ Give me content ideas for next week"}
                </span>
              </Button>
              
              <Button 
                variant="outline" 
                className="justify-start text-left h-auto py-3 px-4 hover:bg-primary/10"
                onClick={() => setInput(language === "no" 
                  ? "Hvordan kan jeg øke engasjementet på innleggene mine?"
                  : "How can I increase engagement on my posts?")}
              >
                <span className="text-sm">
                  {language === "no" 
                    ? "📈 Hvordan kan jeg øke engasjementet på innleggene mine?"
                    : "📈 How can I increase engagement on my posts?"}
                </span>
              </Button>
              
              <Button 
                variant="outline" 
                className="justify-start text-left h-auto py-3 px-4 hover:bg-primary/10"
                onClick={() => setInput(language === "no" 
                  ? "Hva gjør et innlegg viralt?"
                  : "What makes a post go viral?")}
              >
                <span className="text-sm">
                  {language === "no" 
                    ? "🚀 Hva gjør et innlegg viralt?"
                    : "🚀 What makes a post go viral?"}
                </span>
              </Button>
              
              <Button 
                variant="outline" 
                className="justify-start text-left h-auto py-3 px-4 hover:bg-primary/10"
                onClick={() => setInput(language === "no" 
                  ? "Analyser min innholdsstrategi og gi tilbakemeldinger"
                  : "Analyze my content strategy and give feedback")}
              >
                <span className="text-sm">
                  {language === "no" 
                    ? "🎯 Analyser min innholdsstrategi og gi tilbakemeldinger"
                    : "🎯 Analyze my content strategy and give feedback"}
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card 
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => handleQuickAction("compare")}
          >
            <CardContent className="pt-6">
              <TrendingUp className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-1">
                {language === "no" ? "Sammenlign" : "Compare"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {language === "no" 
                  ? "Analyser dine beste innlegg"
                  : "Analyze your best posts"}
              </p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => handleQuickAction("tips")}
          >
            <CardContent className="pt-6">
              <Target className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-1">
                {language === "no" ? "Tips" : "Tips"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {language === "no" 
                  ? "Få konkrete forbedringstips"
                  : "Get concrete improvement tips"}
              </p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => handleQuickAction("challenge")}
          >
            <CardContent className="pt-6">
              <Award className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-1">
                {language === "no" ? "Utfordring" : "Challenge"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {language === "no" 
                  ? "Ta en ukentlig utfordring"
                  : "Take a weekly challenge"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Chat Area */}
        <Card>
          <CardContent className="p-0">
            <div className="h-[500px] flex flex-col">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-4 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg p-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Input
                    placeholder={language === "no" ? "Skriv din melding..." : "Type your message..."}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={chatMutation.isPending}
                  />
                  <Button 
                    onClick={handleSend}
                    disabled={!input.trim() || chatMutation.isPending}
                  >
                    {chatMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}