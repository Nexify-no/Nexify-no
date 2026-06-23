/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import * as cron from 'node-cron';
import { posts, scheduledPosts, linkedinConnections } from '../drizzle/schema';
import { eq, and, lte, lt } from 'drizzle-orm';
import { createLinkedInPost } from './linkedinService';
import { getDb as getDatabase, recordPostAnalytics } from './db';
import { notifyOwner } from './_core/notification';

/**
 * Scheduler Service for Auto-posting
 *
 * Source of truth is the `scheduled_posts` table — that is what the scheduling API
 * (schedulingRouter / schedulingService.schedulePost) actually writes. The job picks
 * up due entries, publishes them, and marks BOTH the scheduled_posts row and the
 * underlying posts row as published (or failed).
 */

let schedulerTask: cron.ScheduledTask | null = null;

// In-process overlap guard: a run that exceeds the 5-min interval must not be
// re-entered by the next tick on the same instance.
let isProcessing = false;

async function processScheduledPosts() {
  if (isProcessing) {
    console.log('[Scheduler] Previous run still in progress, skipping this tick');
    return;
  }
  isProcessing = true;
  try {
    await processScheduledPostsInner();
  } finally {
    isProcessing = false;
  }
}

async function processScheduledPostsInner() {
  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    try {
      const db = await getDatabase();
      if (!db) {
        console.warn('[Scheduler] Database not available');
        return;
      }

      const now = new Date();

      // Reaper: reclaim rows stuck in 'publishing' (a worker claimed them, then
      // crashed before marking the outcome). Mark them 'failed' rather than
      // re-queue — re-queuing risks double-posting a post that may have already
      // gone out before the crash. The owner is alerted via the failed state.
      const STALE_PUBLISHING_MS = 15 * 60 * 1000;
      const staleBefore = new Date(now.getTime() - STALE_PUBLISHING_MS);
      const reaped: any = await db
        .update(scheduledPosts)
        .set({ status: 'failed', failureReason: 'Stuck in publishing (worker crash) — reset by reaper' })
        .where(and(eq(scheduledPosts.status, 'publishing'), lt(scheduledPosts.updatedAt, staleBefore)));
      const reapedCount = reaped?.[0]?.affectedRows ?? reaped?.affectedRows ?? 0;
      if (reapedCount > 0) console.warn(`[Scheduler] Reaped ${reapedCount} stale 'publishing' row(s)`);

      // Due scheduled entries (LinkedIn auto-posting is the only supported channel).
      const due = await db
        .select()
        .from(scheduledPosts)
        .where(
          and(
            eq(scheduledPosts.status, 'scheduled'),
            eq(scheduledPosts.platform, 'linkedin'),
            lte(scheduledPosts.scheduledFor, now)
          )
        )
        .limit(10);

      if (due.length === 0) {
        return;
      }

      console.log(`[Scheduler] Found ${due.length} scheduled post(s) to publish`);

      for (const sched of due) {
        try {
          // Atomically CLAIM this row before doing any work. Only the worker whose
          // UPDATE flips 'scheduled' → 'publishing' (affectedRows === 1) proceeds;
          // any other instance/overlapping run that lost the race skips it. This is
          // what prevents the same post being published twice across instances.
          const claim: any = await db
            .update(scheduledPosts)
            .set({ status: 'publishing' })
            .where(and(eq(scheduledPosts.id, sched.id), eq(scheduledPosts.status, 'scheduled')));
          const claimed = claim?.[0]?.affectedRows ?? claim?.affectedRows ?? 0;
          if (claimed !== 1) {
            console.log(`[Scheduler] Scheduled post ${sched.id} already claimed elsewhere, skipping`);
            continue;
          }

          const [post] = await db.select().from(posts).where(eq(posts.id, sched.postId)).limit(1);
          if (!post) throw new Error(`Post ${sched.postId} not found for scheduled entry ${sched.id}`);

          const [connection] = await db
            .select()
            .from(linkedinConnections)
            .where(eq(linkedinConnections.userId, sched.userId))
            .limit(1);
          if (!connection) throw new Error('LinkedIn not connected');

          const { decryptSecret } = await import('./_core/tokenCrypto');
          await createLinkedInPost(
            decryptSecret(connection.accessToken) ?? '',
            connection.personUrn,
            post.generatedContent
          );

          // Mark published in BOTH tables so the schedule list and "Mine innlegg" agree.
          const publishedAt = new Date();
          await db.update(scheduledPosts).set({ status: 'published', publishedAt }).where(eq(scheduledPosts.id, sched.id));
          await db.update(posts).set({ status: 'published', publishedAt }).where(eq(posts.id, post.id));
          await recordPostAnalytics(post.userId, post.id, 'linkedin', publishedAt);

          console.log(`[Scheduler] Published scheduled post ${sched.id} (post ${post.id}) to LinkedIn`);
          await notifyOwner({
            title: 'Innlegg publisert',
            content: 'Et planlagt innlegg ble automatisk publisert til LinkedIn.',
          });
        } catch (error) {
          const reason = (error as Error)?.message || String(error);
          console.error(`[Scheduler] Failed to publish scheduled post ${sched.id}:`, reason);
          try {
            await db.update(scheduledPosts).set({ status: 'failed', failureReason: reason }).where(eq(scheduledPosts.id, sched.id));
            await db.update(posts).set({ status: 'failed' }).where(eq(posts.id, sched.postId));
          } catch (dbError) {
            console.error('[Scheduler] Failed to record failure status:', dbError);
          }
          try {
            await notifyOwner({
              title: 'Publisering feilet',
              content: `Kunne ikke publisere planlagt innlegg (${reason}). Sjekk LinkedIn-tilkoblingen.`,
            });
          } catch (notifyError) {
            console.error('[Scheduler] Failed to notify owner:', notifyError);
          }
        }
      }
      return;
    } catch (error) {
      retries++;
      if (retries < maxRetries) {
        const delay = 1000 * retries;
        console.warn(`[Scheduler] Connection error, retrying in ${delay}ms (${retries}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error('[Scheduler] Error processing scheduled posts after retries:', error);
        return;
      }
    }
  }
}

/**
 * Start the scheduler — runs every 5 minutes to check for due posts.
 */
export function startScheduler() {
  if (schedulerTask) {
    console.log('[Scheduler] Already running');
    return;
  }

  schedulerTask = cron.schedule('*/5 * * * *', async () => {
    await processScheduledPosts();
  });

  console.log('[Scheduler] Started - checking for scheduled posts every 5 minutes');
}

export function stopScheduler() {
  if (schedulerTask) {
    void schedulerTask.stop();
    schedulerTask = null;
    console.log('[Scheduler] Stopped');
  }
}

/** Manually trigger scheduled posts processing (for testing). */
export async function triggerScheduledPosts() {
  console.log('[Scheduler] Manually triggered');
  await processScheduledPosts();
}