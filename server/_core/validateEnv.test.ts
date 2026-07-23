import { describe, it, expect, afterEach } from "vitest";
import { validateEnv } from "./validateEnv";

const REQUIRED_PROD: Record<string, string> = {
  NODE_ENV: "production",
  JWT_SECRET: "x".repeat(32),
  DATABASE_URL: "mysql://u:p@h/db",
  OPENAI_API_KEY: "sk-test",
  STRIPE_SECRET_KEY: "sk_test",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  TOKEN_ENCRYPTION_KEY: "y".repeat(32),
  PUBLIC_SITE_URL: "https://penna.no",
  REDIS_URL: "redis://localhost:6379",
};

describe("validateEnv — Merkehjerne worker is optional at boot", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("boots in production without BRAND_INGESTION_* (feature disabled, not fatal)", () => {
    process.env = { ...REQUIRED_PROD };
    delete process.env.BRAND_INGESTION_URL;
    delete process.env.BRAND_INGESTION_SECRET;
    expect(() => validateEnv()).not.toThrow();
  });

  it("still fails closed when a truly-required prod var (REDIS_URL) is missing", () => {
    process.env = { ...REQUIRED_PROD };
    delete process.env.REDIS_URL;
    expect(() => validateEnv()).toThrow(/REDIS_URL/);
  });

  it("boots with a valid worker config", () => {
    process.env = {
      ...REQUIRED_PROD,
      BRAND_INGESTION_URL: "https://worker.internal",
      BRAND_INGESTION_SECRET: "z".repeat(32),
    };
    expect(() => validateEnv()).not.toThrow();
  });
});
