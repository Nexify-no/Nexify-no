/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Database Optimization Script
 * Adds indexes and optimizes tables for better performance
 */

import { getDb } from "../db";

export async function optimizeDatabase() {
  const db = await getDb();
  
  if (!db) {
    console.error("Database connection failed");
    return;
  }

  console.log("Starting database optimization...");

  try {
    // Add indexes for posts table
    console.log("Adding indexes for posts table...");
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
    `);
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform);
    `);
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
    `);
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
    `);

    // Add indexes for support_tickets table
    console.log("Adding indexes for support_tickets table...");
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
    `);
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
    `);
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at);
    `);

    // Add indexes for users table
    console.log("Adding indexes for users table...");
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_users_open_id ON users(openId);
    `);

    // Add indexes for subscriptions table
    console.log("Adding indexes for subscriptions table...");
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
    `);
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
    `);

    // Add indexes for voice_samples table
    console.log("Adding indexes for voice_samples table...");
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_voice_samples_user_id ON voice_samples(user_id);
    `);

    // Add composite indexes for common queries
    console.log("Adding composite indexes...");
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_posts_user_platform ON posts(user_id, platform);
    `);
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at);
    `);

    console.log("✅ Database optimization completed successfully!");
    console.log("Indexes created:");
    console.log("  - posts: user_id, platform, created_at, status, (user_id, platform), (user_id, created_at)");
    console.log("  - support_tickets: user_id, status, created_at");
    console.log("  - users: email, openId");
    console.log("  - subscriptions: user_id, status");
    console.log("  - voice_samples: user_id");

  } catch (error) {
    console.error("❌ Database optimization failed:", error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  optimizeDatabase().catch(console.error);
}