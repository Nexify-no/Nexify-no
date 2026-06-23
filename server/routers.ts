/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { voiceRouter } from "./voiceRouter";
import { langchainRouter } from "./langchainRouter";
import { analyticsRouter } from "./analyticsRouter";
import { schedulingRouter } from "./routers/schedulingRouter";
import { postManagementRouter } from "./routers/postManagementRouter";
import { contentEnhancementRouter } from "./routers/contentEnhancementRouter";
import { searchRouter } from "./routers/searchRouter";
import { settingsRouter } from "./routers/settingsRouter";
import { platformRouter } from "./routers/platformRouter";
import { faqRouter } from "./routers/faqRouter";
import { memberMonitoringRouter } from "./memberMonitoringRouter";
import { trendsRouter } from "./routers/trends";
import { hashtagRouter } from "./routers/hashtagRouter";
import { paymentRouter } from "./routers/paymentRouter";
import { adminRouter } from "./routers/adminRouter";
import { securityRouter } from "./routers/securityRouter";
import { supportRouter } from "./routers/supportRouter";
import { vippsRouter } from "./routers/vippsRouter";
import { authRouter } from "./routers/authRouter";
import { userRouter } from "./routers/userRouter";
import { contentRouter } from "./routers/contentRouter";
import { examplesRouter } from "./routers/examplesRouter";
import { coachRouter } from "./routers/coachRouter";
import { blogRouter } from "./routers/blogRouter";
import { stripeRouter } from "./routers/stripeRouter";
import { competitorsRouter } from "./routers/competitorsRouter";
import { seriesRouter } from "./routers/seriesRouter";
import { abtestRouter } from "./routers/abtestRouter";
import { calendarRouter } from "./routers/calendarRouter";
import { reportsRouter } from "./routers/reportsRouter";
import { engagementRouter } from "./routers/engagementRouter";
import { ideasRouter } from "./routers/ideasRouter";
import { draftsRouter } from "./routers/draftsRouter";
import { telegramRouter } from "./routers/telegramRouter";
import { linkedinRouter } from "./routers/linkedinRouter";
import { schedulerRouter } from "./routers/schedulerRouter";
import { templatesRouter } from "./routers/templatesRouter";
import { presetsRouter } from "./routers/presetsRouter";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  payment: paymentRouter,
  admin: adminRouter,
  security: securityRouter,
  support: supportRouter,
  vipps: vippsRouter,
  auth: authRouter,

  user: userRouter,
  
  content: contentRouter,
  
  // voice router moved to voiceRouter.ts
  
  examples: examplesRouter,
  
  coach: coachRouter,
  
  blog: blogRouter,

  // Stripe Payment Router
  stripe: stripeRouter,
  
  competitors: competitorsRouter,
  
  series: seriesRouter,
  
  abtest: abtestRouter,
  

  
  calendar: calendarRouter,
  
  reports: reportsRouter,
  
  engagement: engagementRouter,

  // Idé-Bank (Idea Bank) router
  ideas: ideasRouter,

  // Drafts - Auto-save user work in progress
  drafts: draftsRouter,

  // Telegram Bot Integration
  telegram: telegramRouter,

  // Google Trends Integration - using new trendsRouter
  trends: trendsRouter,

  linkedin: linkedinRouter,

  scheduler: schedulerRouter,



  voice: voiceRouter,
  langchain: langchainRouter,
  analytics: analyticsRouter,
  scheduling: schedulingRouter,
  postManagement: postManagementRouter,
  contentEnhancement: contentEnhancementRouter,
  search: searchRouter,
  settings: settingsRouter,
  platform: platformRouter,
  faq: faqRouter,
  memberMonitoring: memberMonitoringRouter,
  hashtags: hashtagRouter,

  templates: templatesRouter,
  presets: presetsRouter,
});

export type AppRouter = typeof appRouter;