/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { describe, it, expect } from 'vitest';

describe('Telegram Bot Token validation', () => {
  it.skipIf(!process.env.TELEGRAM_BOT_TOKEN)('should have a valid Telegram Bot Token', async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    expect(token).toBeDefined();
    expect(token).toMatch(/^\d+:[A-Za-z0-9_-]+$/);

    // Test the token by calling getMe API
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data.ok).toBe(true);
    expect(data.result).toBeDefined();
    expect(data.result.is_bot).toBe(true);
    expect(data.result.username).toBeDefined();
    
    console.log(`✅ Telegram Bot validated: @${data.result.username}`);
  }, 10000);
});