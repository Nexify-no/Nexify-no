/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Vipps Login Integration
 * Handles Vipps login and user identification for Norwegian market
 */

import axios from "axios";
import { jwtDecode } from "jwt-decode";

interface VippsLoginConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: "production" | "test";
}

interface VippsUserInfo {
  sub: string; // User ID
  phone_number: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  birthdate?: string;
}

class VippsAuthService {
  private config: VippsLoginConfig;
  private baseUrl: string;

  constructor(config: VippsLoginConfig) {
    this.config = config;
    this.baseUrl =
      config.environment === "production"
        ? "https://api.vipps.no"
        : "https://apitest.vipps.no";
  }

  /**
   * Get authorization URL for Vipps login
   */
  getAuthorizationUrl(state: string, scope: string = "openid"): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: "code",
      scope: scope,
      redirect_uri: this.config.redirectUri,
      state: state,
    });

    return `${this.baseUrl}/oauth2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForToken(code: string): Promise<{
    access_token: string;
    id_token: string;
    refresh_token?: string;
    expires_in: number;
  }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/oauth2/token`,
        {
          grant_type: "authorization_code",
          code: code,
          redirect_uri: this.config.redirectUri,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        },
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Failed to exchange code for token:", error);
      throw new Error("Failed to authenticate with Vipps");
    }
  }

  /**
   * Get user info from ID token
   */
  decodeIdToken(idToken: string): VippsUserInfo {
    try {
      const decoded = jwtDecode<VippsUserInfo>(idToken);
      return decoded;
    } catch (error) {
      console.error("Failed to decode ID token:", error);
      throw new Error("Invalid ID token");
    }
  }

  /**
   * Get user info from access token
   */
  async getUserInfo(accessToken: string): Promise<VippsUserInfo> {
    try {
      const response = await axios.get(`${this.baseUrl}/oauth2/userinfo`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error("Failed to get user info:", error);
      throw new Error("Failed to get user information");
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(
    refreshToken: string
  ): Promise<{ access_token: string; expires_in: number }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/oauth2/token`,
        {
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        },
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Failed to refresh access token:", error);
      throw new Error("Failed to refresh token");
    }
  }

  /**
   * Revoke token
   */
  async revokeToken(token: string): Promise<void> {
    try {
      await axios.post(
        `${this.baseUrl}/oauth2/revoke`,
        {
          token: token,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        },
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );
    } catch (error) {
      console.error("Failed to revoke token:", error);
      // Don't throw - revocation failure shouldn't break logout
    }
  }
}

// Initialize Vipps Auth service
export function initializeVippsAuthService(): VippsAuthService | null {
  const clientId = process.env.VIPPS_LOGIN_CLIENT_ID;
  const clientSecret = process.env.VIPPS_LOGIN_CLIENT_SECRET;
  const redirectUri = process.env.VIPPS_LOGIN_REDIRECT_URI;
  const environment = (process.env.VIPPS_ENVIRONMENT || "test") as
    | "production"
    | "test";

  if (!clientId || !clientSecret || !redirectUri) {
    console.warn("Vipps Login credentials not configured");
    return null;
  }

  return new VippsAuthService({
    clientId,
    clientSecret,
    redirectUri,
    environment,
  });
}

export const vippsAuthService = initializeVippsAuthService();
export type { VippsLoginConfig, VippsUserInfo };