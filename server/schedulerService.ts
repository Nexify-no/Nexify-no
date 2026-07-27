/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import * as cron from 'node-cron';
import { posts, scheduledPosts, linkedinConnections, users, subscriptions } from '../drizzle/schema';
import { eq, and, lte, lt, gte, or, isNull, isNotNull } from 'drizzle-orm';
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
let weeklyRitualTask: cron.ScheduledTask | null = null;
let linkedinExpiryTask: cron.ScheduledTask | null = null;
let lifecycleTask: cron.ScheduledTask | null = null;
let planTask: cron.ScheduledTask | null = null;
let subscriptionReminderTask: cron.ScheduledTask | null = null;

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

          // ── PR #82: the worker publishes where the BRAND says, not wherever
          // the account-wide connection points ──────────────────────────────
          //
          // This call passed no author override at all, so it ignored
          // publishTarget entirely: a brand whose destination is a Company Page
          // had its scheduled posts published to the user's personal feed. The
          // destination check at schedule time guaranteed nothing about where the
          // post actually landed, because this is the code that lands it.
          const { resolvePublishBrand, requireDestination, claimPublication, settlePublication, assertContentIsPublishable } =
            await import('./services/publishGuard');

          // PR #83: re-check at PUBLISH time, not just when it was scheduled. A
          // post can sit in the calendar for weeks; if the Merkehjerne changed, or
          // the rules tightened, the claim it makes may no longer be defensible —
          // and the worker publishes with nobody watching.
          const brandId = await resolvePublishBrand(post.userId, post.id);
          await assertContentIsPublishable({
            accountId: post.userId,
            postId: post.id,
            content: post.generatedContent,
            brandId,
          });
          const destination = await requireDestination(post.userId, brandId, 'linkedin', post.id);
          const toOrg = destination?.destinationType === 'organization';
          const authorOverride = toOrg
            ? (destination?.destinationId ?? (connection as { organizationUrn?: string | null }).organizationUrn ?? null)
            : null;

          // Same audit trail and duplicate protection as an interactive publish,
          // so a worker retry cannot double-post either.
          const publicationId = await claimPublication({
            accountId: post.userId,
            brandId,
            postId: post.id,
            platform: 'linkedin',
            destination,
            content: post.generatedContent,
          });

          const { decryptSecret } = await import('./_core/tokenCrypto');
          const orgToken = (connection as { orgAccessToken?: string | null }).orgAccessToken;
          // Publishing to a Company Page needs the SEPARATE org token from the
          // Community-Management app. This used to fall back to the member token
          // when the org token was missing, while still sending the organization
          // URN as the author — so LinkedIn 403'd, and the failure read like a
          // mysterious permissions problem rather than "reconnect the Company
          // Page". The interactive path already refuses this outright.
          if (toOrg && !orgToken) {
            throw new Error(
              'Company Page-tilkoblingen mangler. Koble til LinkedIn-siden på nytt for å publisere som bedrift.',
            );
          }
          const activeToken = toOrg && orgToken
            ? decryptSecret(orgToken) ?? ''
            : decryptSecret(connection.accessToken) ?? '';
          // The image. This call used to stop at `authorOverride` and omit
          // `createLinkedInPost`'s fifth argument entirely, so EVERY scheduled
          // post went out as text — even when its image was finished and stored.
          // The parameter is optional, so nothing failed and nothing warned; the
          // post simply appeared on LinkedIn without the picture, and the record
          // in "Mine innlegg" still showed the image next to it.
          //
          // Both other publish paths (linkedinRouter's interactive publish and
          // publishingService) pass it. This one was the odd one out.
          //
          // Pass `post.imageUrl` raw, deliberately. `createLinkedInPost` already
          // decides what is usable (`/^https?:\/\//`), and routing this through a
          // stricter local check would mean the SAME post keeps its picture when
          // published by hand and loses it when scheduled. One predicate, one
          // behaviour. Note it is NOT gated on `imageStatus`: `content.attachImage`
          // and `seriesRouter` both write `image_url` without touching that column,
          // so it sits at its 'none' default for images that plainly exist.
          const imageUrl = post.imageUrl ?? null;

          let published;
          try {
            published = await createLinkedInPost(
              activeToken,
              connection.personUrn,
              post.generatedContent,
              authorOverride,
              imageUrl,
            );
            if (imageUrl && !published.imageAttached) {
              // The reported symptom, from a different cause. Say it out loud
              // instead of reporting an unqualified success.
              console.warn(
                `[Scheduler] Post ${post.id} published WITHOUT its image — LinkedIn upload failed for ${imageUrl}`,
              );
            }
            await settlePublication(publicationId, {
              status: 'published',
              providerPostId: published?.id ?? null,
              providerResponse: published,
              postId: post.id,
            });
          } catch (error) {
            await settlePublication(publicationId, {
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : 'Ukjent feil',
            });
            throw error;
          }

          // Mark published in BOTH tables so the schedule list and "Mine innlegg" agree.
          const publishedAt = new Date();
          await db.update(scheduledPosts).set({ status: 'published', publishedAt }).where(eq(scheduledPosts.id, sched.id));
          await db.update(posts).set({ status: 'published', publishedAt }).where(eq(posts.id, post.id));
          // The 5th argument again. `engagementMetricsService` only collects for
          // rows with a non-null `platform_post_id`, so omitting it here quietly
          // excluded every scheduled post from engagement data — and therefore
          // from the personalised "best time to post" that is computed from it.
          // The interactive path has always passed it.
          await recordPostAnalytics(post.userId, post.id, 'linkedin', publishedAt, published?.id ?? null);

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

let abExperimentTask: cron.ScheduledTask | null = null;
let isProcessingAb = false;

/**
 * Auto-end due A/B experiments.
 *
 * Finds experiments with status 'running' whose ends_at has passed, recomputes
 * stats, runs the winner engine, and marks them 'completed' with the winning
 * variant. Follows the same in-process overlap-guard pattern as the post
 * scheduler so an over-running tick is not re-entered.
 */
async function processDueAbExperiments() {
  if (isProcessingAb) {
    console.log('[Scheduler:AB] Previous run still in progress, skipping this tick');
    return;
  }
  isProcessingAb = true;
  try {
    const db = await getDatabase();
    if (!db) {
      console.warn('[Scheduler:AB] Database not available');
      return;
    }

    const { abExperiments } = await import('../drizzle/schema');
    const now = new Date();

    const due = await db
      .select()
      .from(abExperiments)
      .where(and(eq(abExperiments.status, 'running'), lte(abExperiments.endsAt, now)))
      .limit(25);

    if (due.length === 0) return;

    console.log(`[Scheduler:AB] Found ${due.length} A/B experiment(s) to auto-end`);
    const { recomputeAndScore } = await import('./services/abService');

    for (const exp of due) {
      try {
        const winner = await recomputeAndScore(exp.id);
        await db
          .update(abExperiments)
          .set({ status: 'completed', winnerVariantId: winner.winnerVariantId ?? null })
          .where(eq(abExperiments.id, exp.id));
        console.log(
          `[Scheduler:AB] Auto-ended experiment ${exp.id} — ${winner.reason}`
        );
      } catch (error) {
        console.error(
          `[Scheduler:AB] Failed to auto-end experiment ${exp.id}:`,
          (error as Error)?.message || String(error)
        );
      }
    }
  } catch (error) {
    console.error('[Scheduler:AB] Error processing due A/B experiments:', error);
  } finally {
    isProcessingAb = false;
  }
}

let radarTask: cron.ScheduledTask | null = null;
let bestTimesTask: cron.ScheduledTask | null = null;
let isProcessingRadar = false;

/**
 * Competitor Radar refresh loop.
 *
 * Hourly: finds competitors whose sources are stale (oldest last_fetch older than
 * ~6h, or never fetched) and runs sync + analyze for each. Fail-soft per competitor
 * so one bad feed never blocks the rest. Uses the same in-process overlap guard as
 * the other scheduled tasks.
 */
async function processCompetitorRadar() {
  if (isProcessingRadar) {
    console.log('[Scheduler:Radar] Previous run still in progress, skipping this tick');
    return;
  }
  isProcessingRadar = true;
  try {
    const db = await getDatabase();
    if (!db) {
      console.warn('[Scheduler:Radar] Database not available');
      return;
    }

    const { competitors, competitorSources } = await import('../drizzle/schema');
    const { lt, or, isNull, eq, inArray } = await import('drizzle-orm');

    const staleBefore = new Date(Date.now() - 6 * 60 * 60 * 1000);

    // Sources that are stale (or never fetched) → derive the distinct competitor ids.
    const staleSources = await db
      .select({ competitorId: competitorSources.competitorId })
      .from(competitorSources)
      .where(or(isNull(competitorSources.lastFetch), lt(competitorSources.lastFetch, staleBefore)))
      .limit(500);

    const competitorIds = Array.from(new Set(staleSources.map((r) => r.competitorId)));
    if (competitorIds.length === 0) return;

    // Keep only competitors that still exist (defensive against orphan sources).
    const existing = await db
      .select({ id: competitors.id })
      .from(competitors)
      .where(inArray(competitors.id, competitorIds));
    const validIds = existing.map((c) => c.id).slice(0, 50);

    if (validIds.length === 0) return;

    console.log(`[Scheduler:Radar] Refreshing ${validIds.length} competitor(s)`);
    const { syncCompetitor, analyzeCompetitor } = await import('./services/radarService');

    for (const competitorId of validIds) {
      try {
        await syncCompetitor(competitorId);
        await analyzeCompetitor(competitorId);
        console.log(`[Scheduler:Radar] Refreshed competitor ${competitorId}`);
      } catch (error) {
        console.error(
          `[Scheduler:Radar] Failed to refresh competitor ${competitorId}:`,
          (error as Error)?.message || String(error)
        );
      }
    }
    void eq; // keep import tree-shake-stable (eq available for future filters)
  } catch (error) {
    console.error('[Scheduler:Radar] Error processing competitor radar:', error);
  } finally {
    isProcessingRadar = false;
  }
}

/**
 * Remind users whose LinkedIn access token is about to expire (LinkedIn member
 * tokens last ~60 days with no auto-refresh). Daily cron + a 1-day match window
 * (4-5 days before expiry) means each connection gets ~one reminder.
 */
async function remindExpiringLinkedInTokens() {
  const db = await getDatabase();
  if (!db) return;
  const now = Date.now();
  const lo = new Date(now + 4 * 24 * 60 * 60 * 1000);
  const hi = new Date(now + 5 * 24 * 60 * 60 * 1000);
  const conns = await db
    .select()
    .from(linkedinConnections)
    .where(and(gte(linkedinConnections.expiresAt, lo), lte(linkedinConnections.expiresAt, hi)));
  if (conns.length === 0) return;
  const { sendLinkedInExpiryReminderEmail } = await import('./_core/email');
  let sent = 0;
  for (const c of conns) {
    let email = c.profileEmail || '';
    let name = c.profileName || '';
    try {
      const [u] = await db.select().from(users).where(eq(users.id, c.userId)).limit(1);
      if (u?.email) email = u.email;
      if (u?.name) name = u.name;
    } catch { /* fall back to profile email/name */ }
    if (!email) continue;
    try {
      await sendLinkedInExpiryReminderEmail(email, name, c.expiresAt);
      sent++;
    } catch (e) {
      console.error('[Scheduler:LinkedInExpiry] send failed for', email, e);
    }
    await new Promise((res) => setTimeout(res, 200));
  }
  console.log(`[Scheduler:LinkedInExpiry] reminders sent: ${sent}/${conns.length}`);
}

/**
 * Periodic "your subscription is active" reminder — at least every 6 months, per
 * digitalytelsesloven / Forbrukertilsynet. Daily cron; each active subscription is
 * reminded when it has never been reminded or the last reminder is >6 months old.
 */
export async function remindActiveSubscriptions() {
  const db = await getDatabase();
  if (!db) return;
  const sixMonthsAgo = new Date(Date.now() - 182 * 24 * 60 * 60 * 1000);

  // One query, and bounded. This selected the whole due set with no limit and
  // then fetched each user row separately — an N+1 over an unbounded scan, in a
  // job that runs daily forever. The join is the shape every other recipient
  // query in this file already uses.
  const due = await db
    .select({
      subId: subscriptions.id,
      userId: subscriptions.userId,
      email: users.email,
      name: users.name,
    })
    .from(subscriptions)
    .innerJoin(users, eq(users.id, subscriptions.userId))
    .where(
      and(
        eq(subscriptions.status, 'active'),
        isNotNull(users.email),
        or(isNull(subscriptions.lastActiveReminderAt), lte(subscriptions.lastActiveReminderAt, sixMonthsAgo)),
      ),
    )
    .limit(500);
  if (due.length === 0) return;

  const { sendSubscriptionActiveReminderEmail } = await import('./_core/email');
  const { claimAutomationSend, releaseAutomationClaim } = await import('./services/emailAutomation');

  // Month key: the obligation is "at least every six months", and
  // lastActiveReminderAt already enforces the 182-day spacing. This claim exists
  // for a different reason — it is the only thing that stops TWO PROCESSES from
  // each sending a copy. `lastActiveReminderAt` is a read-then-write, so two
  // instances (or the overlap window of a zero-downtime deploy) both read "never
  // reminded" and both send. That is precisely how the weekly ritual reached
  // customers three times. The unique key on (user_id, email_key) is the lock.
  //
  // It also makes the send visible: /admin/epost derives "last sent" and "sent in
  // the last 30 days" from these rows, so without a claim the page would report
  // "no sends recorded" forever while the job was sending.
  const monthKey = (() => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  })();

  let sent = 0;
  let alreadyClaimed = 0;
  for (const row of due) {
    const emailKey = `subscription_reminder_${monthKey}`;
    if (!(await claimAutomationSend(row.userId, emailKey))) {
      alreadyClaimed++;
      continue;
    }
    try {
      await sendSubscriptionActiveReminderEmail(row.email as string, row.name || '');
      await db
        .update(subscriptions)
        .set({ lastActiveReminderAt: new Date() })
        .where(eq(subscriptions.id, row.subId));
      sent++;
    } catch (e) {
      // Release, or one transient SendGrid failure would record a statutory
      // notice as delivered and skip that customer for the whole month.
      await releaseAutomationClaim(row.userId, emailKey);
      console.error('[Scheduler:SubReminder] failed for user', row.userId, e);
    }
    await new Promise((res) => setTimeout(res, 200));
  }
  console.log(
    `[Scheduler:SubReminder] reminders sent: ${sent}/${due.length} (${alreadyClaimed} already claimed)`,
  );
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

  // A/B experiment auto-end loop (same 5-min cadence, separate task so a slow
  // publish run never delays winner computation and vice-versa).
  abExperimentTask = cron.schedule('*/5 * * * *', async () => {
    await processDueAbExperiments();
  });

  // Competitor Radar refresh loop — hourly, refreshes competitors with stale sources.
  radarTask = cron.schedule('0 * * * *', async () => {
    await processCompetitorRadar();
  });

  // Best-time-to-post refresh — daily at 03:30. Pulls each user's own published-post
  // engagement from the platform APIs and re-aggregates their personalized best times.
  bestTimesTask = cron.schedule('30 3 * * *', async () => {
    try {
      const { refreshAllUsers } = await import('./services/engagementMetricsService');
      await refreshAllUsers();
    } catch (e) {
      console.error('[scheduler] best-times refresh failed', e);
    }
  });

  // Weekly "Monday ritual" re-engagement email — Mondays 08:00 (Europe/Oslo).
  weeklyRitualTask = cron.schedule('0 8 * * 1', async () => {
    try {
      const { getWeeklyRitualRecipients } = await import('./db');
      const { sendWeeklyRitualEmail } = await import('./_core/email');
      const { isAutomationEnabled, claimAutomationSend, releaseAutomationClaim, isoWeekKey } =
        await import('./services/emailAutomation');

      if (!(await isAutomationEnabled('weekly_ritual'))) {
        console.log('[Scheduler:WeeklyRitual] disabled by admin — skipping');
        return;
      }

      const recipients = await getWeeklyRitualRecipients();
      const weekKey = `weekly_ritual_${isoWeekKey(new Date())}`;
      console.log(`[Scheduler:WeeklyRitual] ${recipients.length} candidate(s), key=${weekKey}`);

      let sent = 0;
      let alreadyClaimed = 0;
      for (const r of recipients) {
        // CLAIM BEFORE SENDING. This job used to send straight from the recipient
        // list with nothing recorded, which is only safe if exactly one process
        // ever runs the cron — and nothing guarantees that. startScheduler()'s
        // guard is a module-level variable, so it protects one Node process and
        // no more; a second instance, a staging service pointed at the same
        // database, or the overlap window of a zero-downtime deploy each sent a
        // complete second copy. Customers received three.
        //
        // The unique key on (user_id, email_key) makes this atomic: the losing
        // process's insert fails and it skips.
        if (!r.userId) continue;
        const claimed = await claimAutomationSend(r.userId, weekKey);
        if (!claimed) { alreadyClaimed++; continue; }

        try {
          const ok = await sendWeeklyRitualEmail(r.email, r.name);
          if (ok) { sent++; }
          else {
            // Give the claim back so next week's run — or a retry — is not
            // permanently blocked by a send that never happened.
            await releaseAutomationClaim(r.userId, weekKey);
          }
        } catch (e) {
          console.error('[Scheduler:WeeklyRitual] send failed for', r.email, e);
          await releaseAutomationClaim(r.userId, weekKey);
        }
        await new Promise((res) => setTimeout(res, 200));
      }
      console.log(
        `[Scheduler:WeeklyRitual] sent ${sent}, skipped ${alreadyClaimed} already claimed by another run/instance`
      );
    } catch (e) {
      console.error('[Scheduler:WeeklyRitual] job failed', e);
    }
  }, { timezone: 'Europe/Oslo' });

  // LinkedIn token-expiry reminder — daily 09:00 (Europe/Oslo). Tokens last ~60
  // days with no auto-refresh, so warn before auto-posting silently stops.
  linkedinExpiryTask = cron.schedule('0 9 * * *', async () => {
    try {
      const { isAutomationEnabled } = await import('./services/emailAutomation');
      if (!(await isAutomationEnabled('linkedin_expiry'))) {
        console.log('[Scheduler:LinkedInExpiry] disabled by admin — skipping');
        return;
      }
      await remindExpiringLinkedInTokens();
    } catch (e) { console.error('[Scheduler:LinkedInExpiry] job failed', e); }
  }, { timezone: 'Europe/Oslo' });

  // Automated customer-journey emails — daily 10:00 (Europe/Oslo). Sends at most
  // one behavior-aware onboarding/education/re-engagement step per user per day,
  // each step exactly once (see server/services/lifecycleService.ts).
  lifecycleTask = cron.schedule('0 10 * * *', async () => {
    try {
      const { isAutomationEnabled } = await import('./services/emailAutomation');
      if (!(await isAutomationEnabled('lifecycle_sequence'))) {
        console.log('[Scheduler:Lifecycle] disabled by admin — skipping');
        return;
      }
      const { runLifecycleEmails } = await import('./services/lifecycleService');
      const summary = await runLifecycleEmails();
      console.log(`[Scheduler:Lifecycle] scanned ${summary.scanned}, sent ${summary.sent}`);
    } catch (e) {
      console.error('[Scheduler:Lifecycle] job failed', e);
    }
  }, { timezone: 'Europe/Oslo' });

  // Enkel 4-ukers plan-arbeider - hvert minutt; no-op nar FEATURE_ENKEL_PLAN er av.
  // Lease-basert (planLease/planStore): trygg ved flere instanser og restarts.
  planTask = cron.schedule('* * * * *', async () => {
    try {
      const { ENV } = await import('./_core/env');
      if (!ENV.featureEnkelPlan) return;
      const { runPlanTick } = await import('./planWorker');
      const { buildPlanWorkerDeps } = await import('./planStore');
      const deps = await buildPlanWorkerDeps();
      await runPlanTick(deps, `web-${process.pid}`);
    } catch (e) {
      console.error('[Scheduler:Plan] tick failed', e);
    }
  });

  console.log('[Scheduler] Started - scheduled posts + A/B every 5 min, Competitor Radar hourly, best-times daily 03:30, weekly ritual Mon 08:00, lifecycle daily 10:00');
  // Subscription-active reminder — daily 10:00 (Europe/Oslo); each active sub
  // reminded at most every 6 months. It had no time zone (so it ran in whatever
  // the server's was, drifting an hour twice a year) and no admin switch, which
  // made it the one automated e-mail invisible on /admin/epost.
  subscriptionReminderTask = cron.schedule('0 10 * * *', async () => {
    try {
      const { isAutomationEnabled } = await import('./services/emailAutomation');
      if (!(await isAutomationEnabled('subscription_reminder'))) {
        console.log('[Scheduler:SubReminder] disabled by admin — skipping');
        return;
      }
      await remindActiveSubscriptions();
    } catch (e) { console.error('[Scheduler:SubReminder] error', e); }
  }, { timezone: 'Europe/Oslo' });
}

export function stopScheduler() {
  if (planTask) {
    void planTask.stop();
    planTask = null;
    console.log('[Scheduler:Plan] Stopped');
  }
  if (schedulerTask) {
    void schedulerTask.stop();
    schedulerTask = null;
    console.log('[Scheduler] Stopped');
  }
  if (abExperimentTask) {
    void abExperimentTask.stop();
    abExperimentTask = null;
    console.log('[Scheduler:AB] Stopped');
  }
  if (radarTask) {
    void radarTask.stop();
    radarTask = null;
    console.log('[Scheduler:Radar] Stopped');
  }
  if (bestTimesTask) {
    void bestTimesTask.stop();
    bestTimesTask = null;
    console.log('[Scheduler:BestTimes] Stopped');
  }
  if (weeklyRitualTask) {
    void weeklyRitualTask.stop();
    weeklyRitualTask = null;
    console.log('[Scheduler:WeeklyRitual] Stopped');
  }
  if (linkedinExpiryTask) {
    void linkedinExpiryTask.stop();
    linkedinExpiryTask = null;
  }
  if (subscriptionReminderTask) {
    void subscriptionReminderTask.stop();
    subscriptionReminderTask = null;
    console.log('[Scheduler:LinkedInExpiry] Stopped');
  }
  if (lifecycleTask) {
    void lifecycleTask.stop();
    lifecycleTask = null;
    console.log('[Scheduler:Lifecycle] Stopped');
  }
}

/** Manually trigger scheduled posts processing (for testing). */
export async function triggerScheduledPosts() {
  console.log('[Scheduler] Manually triggered');
  await processScheduledPosts();
}
