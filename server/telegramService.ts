/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Telegram Bot Service
 * Handles communication with Telegram API
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: {
    id: number;
    type: string;
  };
  text?: string;
  date: number;
}

/**
 * Send a message to a Telegram user
 */
export async function sendTelegramMessage(chatId: number, text: string, options?: {
  parse_mode?: "Markdown" | "HTML";
  reply_markup?: any;
}): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...options,
      }),
    });

    const data = await response.json();
    return data.ok;
  } catch (error) {
    console.error("[Telegram] Failed to send message:", error);
    return false;
  }
}

/**
 * Set webhook URL for receiving updates
 */
export async function setTelegramWebhook(webhookUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message"],
        // Telegram echoes this back as X-Telegram-Bot-Api-Secret-Token on every
        // call so our endpoint can reject forged requests.
        secret_token: process.env.TELEGRAM_WEBHOOK_SECRET || undefined,
      }),
    });

    const data = await response.json();
    console.log("[Telegram] Webhook set:", data.ok === true ? "ok" : data);
    return data.ok;
  } catch (error) {
    console.error("[Telegram] Failed to set webhook:", error);
    return false;
  }
}

/**
 * Get current webhook info
 */
export async function getTelegramWebhookInfo(): Promise<any> {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/getWebhookInfo`);
    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error("[Telegram] Failed to get webhook info:", error);
    return null;
  }
}

/**
 * Delete webhook (for testing)
 */
export async function deleteTelegramWebhook(): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/deleteWebhook`, {
      method: "POST",
    });
    const data = await response.json();
    return data.ok;
  } catch (error) {
    console.error("[Telegram] Failed to delete webhook:", error);
    return false;
  }
}