/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useEffect, useState } from "react";

export interface AuthUser {
  id: number;
  email: string;
  name?: string;
  role?: string;
}

export interface AuthSession {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

/**
 * Hook to check authentication status
 */
export function useAuth(): AuthSession {
  const [session, setSession] = useState<AuthSession>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const data = await response.json();

        if (data.user) {
          setSession({
            user: data.user,
            isLoading: false,
            isAuthenticated: true,
          });
        } else {
          setSession({
            user: null,
            isLoading: false,
            isAuthenticated: false,
          });
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        setSession({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    };

    checkAuth();
  }, []);

  return session;
}

/**
 * Hook to get login URL
 */
export async function getLoginUrl(): Promise<string> {
  try {
    const response = await fetch("/api/auth/login");
    const data = await response.json();
    return data.url || "/login";
  } catch (error) {
    console.error("Failed to get login URL:", error);
    return "/login";
  }
}

/**
 * Hook to logout
 */
export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  } catch (error) {
    console.error("Logout failed:", error);
  }
}