/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { describe, expect, it } from "vitest";

describe("OpenAI API Key validation", () => {
  it.skipIf(!process.env.OPENAI_API_KEY)("should have OpenAI API key configured", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    
    // In test environment, the key might be a test value
    expect(apiKey).toBeDefined();
    
    // Only validate format if it's a real key (starts with sk-)
    if (apiKey && apiKey.startsWith("sk-")) {
      // Test with a simple API call
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    }
  }, 15000); // 15 second timeout for API call
});