/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { ReactNode } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AnimatedFeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  color?: "blue" | "green" | "purple" | "orange" | "pink";
  animation?: "float" | "pulse" | "bounce";
}

export function AnimatedFeatureCard({
  icon,
  title,
  description,
  color = "blue",
  animation = "float",
}: AnimatedFeatureCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
    pink: "bg-pink-50 text-pink-600",
  };

  const animationClasses = {
    float: "animate-float",
    pulse: "animate-pulse-glow",
    bounce: "animate-bounce-smooth",
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 overflow-hidden">
      <CardHeader>
        <div className={`w-12 h-12 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-4 ${animationClasses[animation]}`}>
          <div className="text-2xl">{icon}</div>
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      
      {/* Animated background gradient on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none" />
    </Card>
  );
}