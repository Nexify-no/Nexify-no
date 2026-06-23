/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Vipps Payment Integration
 * Handles Vipps eCommerce payments for Norwegian market
 */

import axios, { AxiosInstance } from "axios";
import crypto from "crypto";

interface VippsConfig {
  clientId: string;
  clientSecret: string;
  subscriptionKey: string;
  merchantSerialNumber: string;
  environment: "production" | "test";
}

interface VippsPaymentRequest {
  orderId: string;
  amount: number;
  orderDescription: string;
  fallBack: string;
  callbackPrefix?: string;
}

interface VippsPaymentResponse {
  orderId: string;
  url: string;
  deepLinkUrl: string;
}

interface VippsCallbackPayload {
  orderId: string;
  transactionInfo: {
    status: string;
    amount: number;
    transactionId: string;
    timeStamp: string;
  };
}

class VippsPaymentService {
  private client: AxiosInstance;
  private config: VippsConfig;
  private baseUrl: string;
  private accessToken: string = "";
  private tokenExpiry: number = 0;

  constructor(config: VippsConfig) {
    this.config = config;
    this.baseUrl =
      config.environment === "production"
        ? "https://api.vipps.no"
        : "https://apitest.vipps.no";

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Get access token from Vipps
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.accessToken.length > 0 && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/accesstoken/get`,
        {},
        {
          headers: {
            "client_id": this.config.clientId,
            "client_secret": this.config.clientSecret,
            "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Token expires in 3600 seconds, refresh after 3500 seconds
      this.tokenExpiry = Date.now() + 3500 * 1000;

      return this.accessToken;
    } catch (error) {
      console.error("Failed to get Vipps access token:", error);
      throw new Error("Failed to authenticate with Vipps");
    }
  }

  /**
   * Initiate a payment
   */
  async initiatePayment(
    payment: VippsPaymentRequest
  ): Promise<VippsPaymentResponse> {
    const token = await this.getAccessToken();

    try {
      const response = await this.client.post(
        "/ecomm/v2/payments",
        {
          customerInfo: {
            mobileNumber: "", // Will be provided by user
          },
          merchantInfo: {
            merchantSerialNumber: this.config.merchantSerialNumber,
            callbackPrefix: payment.callbackPrefix || "",
            fallBack: payment.fallBack,
            isApp: false,
          },
          transaction: {
            orderId: payment.orderId,
            amount: payment.amount,
            transactionText: payment.orderDescription,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
            "Merchant-Serial-Number": this.config.merchantSerialNumber,
          },
        }
      );

      return {
        orderId: payment.orderId,
        url: response.data.url,
        deepLinkUrl: response.data.deepLinkUrl || "",
      };
    } catch (error) {
      console.error("Failed to initiate Vipps payment:", error);
      throw new Error("Failed to initiate payment");
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(orderId: string): Promise<any> {
    const token = await this.getAccessToken();

    try {
      const response = await this.client.get(
        `/ecomm/v2/payments/${orderId}/details`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
            "Merchant-Serial-Number": this.config.merchantSerialNumber,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Failed to get payment status:", error);
      throw new Error("Failed to get payment status");
    }
  }

  /**
   * Cancel a payment
   */
  async cancelPayment(orderId: string): Promise<any> {
    const token = await this.getAccessToken();

    try {
      const response = await this.client.put(
        `/ecomm/v2/payments/${orderId}/cancel`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
            "Merchant-Serial-Number": this.config.merchantSerialNumber,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Failed to cancel payment:", error);
      throw new Error("Failed to cancel payment");
    }
  }

  /**
   * Refund a payment
   */
  async refundPayment(orderId: string, amount: number): Promise<any> {
    const token = await this.getAccessToken();

    try {
      const response = await this.client.post(
        `/ecomm/v2/payments/${orderId}/refund`,
        {
          refundLine: {
            amount: amount,
            description: "Refund",
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
            "Merchant-Serial-Number": this.config.merchantSerialNumber,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Failed to refund payment:", error);
      throw new Error("Failed to refund payment");
    }
  }

  /**
   * Verify webhook signature (HMAC-SHA256, constant-time). Fails closed.
   * The live webhook route uses the implementation in routes/vippsWebhook.ts;
   * this method must never silently return true.
   */
  verifyWebhookSignature(
    body: string,
    signature: string,
    _timestamp: string
  ): boolean {
    const secret = process.env.VIPPS_SECRET_KEY || "";
    if (!secret || !signature) return false;
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
}

// Initialize Vipps service
export function initializeVippsService(): VippsPaymentService | null {
  const clientId = process.env.VIPPS_CLIENT_ID;
  const clientSecret = process.env.VIPPS_CLIENT_SECRET;
  const subscriptionKey = process.env.VIPPS_SUBSCRIPTION_KEY;
  const merchantSerialNumber = process.env.VIPPS_MERCHANT_SERIAL_NUMBER;
  const environment = (process.env.VIPPS_ENVIRONMENT || "test") as
    | "production"
    | "test";

  if (!clientId || !clientSecret || !subscriptionKey || !merchantSerialNumber) {
    console.warn("Vipps credentials not configured");
    return null;
  }

  return new VippsPaymentService({
    clientId,
    clientSecret,
    subscriptionKey,
    merchantSerialNumber,
    environment,
  });
}

export const vippsService = initializeVippsService();
export type { VippsPaymentRequest, VippsPaymentResponse, VippsCallbackPayload };