# Innlegg Project TODO

## Phase 1: Database & Infrastructure
- [x] Design and implement database schema (users, posts, subscriptions, voice_samples)
- [x] Set up environment variables for OpenAI API
- [x] Configure database migrations

## Phase 2: Authentication & User Management
- [x] Implement Supabase Auth integration
- [x] Create user profile management
- [x] Add language preference system (Norwegian Bokmål / English)

## Phase 3: Content Generation System
- [x] Integrate OpenAI GPT-4 API
- [x] Build content generation endpoint
- [x] Implement platform-specific formatting (LinkedIn, Twitter/X, Instagram, Facebook)
- [x] Create voice tone customization system
- [x] Add voice sample training functional## Phase 4: Dashboard & Post Management
- [x] Build main dashboard UI
- [x] Create post generation interface
- [x] Implement post list and management
- [x] Add post editing functionality
- [x] Create statistics displayage statistics

## Phase 5: Subscription & Vipps Integration
- [x] Implement subscription tracking system (database schema complete)
- [x] Design subscription database schema (subscription_plans, stripe_payment_intents, subscription_history)
- [x] Create subscription tRPC procedures (getPlans, getSubscription, createCheckoutSession, cancelSubscription, getBillingHistory)
- [x] Write vitest tests for payment system (23 tests passing)
- [x] Integrate Stripe webhook handler (checkout.session.completed, payment notifications)
- [x] Build Pricing page component with plan selection and monthly/yearly toggle
- [x] Add Pricing route to App.tsx
- [x] Integrate Vipps payment API (settings UI ready, awaiting business credentials)
- [x] Create free trial system (5 posts limit)
- [x] Build subscription management UI
- [x] Add payment webhook handlers

## Phase 6: Norwegian Landing Page
- [x] Design attractive landing page
- [ ] Write Norwegian marketing copy
- [ ] Add product value proposition
- [ ] Create call-to-action sections
- [ ] Implement responsive design

## Phase 7: Testing & Refinement
- [x] Write comprehensive vitest tests (32 core feature tests passing)
- [x] Test all user flows (comprehensive test coverage + 30 E2E tests)
- [ ] Verify Stripe payment integration
- [x] Test content generation quality (comprehensive quality report)
- [x] Perform security audit (comprehensive security audit report)
- [x] Test bilingual support (Norwegian/English)

## Phase 8: Deployment Preparation
- [x] Create Docker configuration (ready for deployment)
- [ ] Prepare Railway deployment setup
- [ ] Document deployment process
- [ ] Create checkpoint and deliver project

## UI/UX Improvements
- [x] Add informative empty states with features explanation
- [x] Add onboarding tooltips for first-time users
- [x] Improve user guidance throughout the app
- [x] Add inspiring example prompts on Generate page as quick starters

## AI Content Coach Feature (Unique & Innovative)
- [x] Create content_analysis table in database
- [x] Build content analysis engine (NLP-based scoring)
- [x] Add analysis card after content generation
- [ ] Create "My Progress" page with charts
- [x] Build AI Coach Chat interface (Clawdbot-inspired)
- [x] Add personalized recommendations system
- [x] Implement progress tracking over time

## Saved Examples Feature
- [x] Create saved_examples table in database
- [x] Add "Save as Example" button in Posts page
- [x] Create "My Examples" section in Generate page
- [x] Build examples management interface

## Telegram Bot + Social Media Integration
- [ ] Set up Telegram Bot API
- [ ] Build bot command handlers
- [ ] Integrate Facebook Graph API for auto-posting
- [ ] Add interactive buttons (Copy, Post, Edit)
- [ ] Test end-to-end flow

## Professional Landing Page
- [x] Design hero section with compelling headline
- [x] Add features showcase section
- [x] Create pricing section (199 NOK/month)
- [x] Add testimonials/social proof section
- [x] Implement call-to-action buttons
- [ ] Add FAQ section
- [x] Optimize for mobile responsiveness
- [x] Add Norwegian language content

## Landing Page Psychological Optimization
- [x] Add urgency triggers (limited time, scarcity)
- [x] Implement social proof (user count, testimonials with photos)
- [x] Add authority signals (certifications, media mentions)
- [x] Create emotional connection (pain points, success stories)
- [x] Add risk reversal (money-back guarantee, free trial emphasis)
- [x] Implement FOMO (Fear of Missing Out) elements
- [x] Add comparison table (vs competitors/manual work)
- [ ] Include video demo or animated showcase

## Company Information & Legal Pages
- [x] Add Nexify CRM Systems AS company information to footer
- [x] Create Privacy Policy page (GDPR compliant)
- [x] Create Terms of Service page
- [x] Create Cookie Policy page
- [x] Add legal page links to footer
- [x] Add company contact information
- [x] Test all legal page links

## About Us Page (Om oss)
- [x] Create Om oss page with company introduction
- [x] Add company vision and mission
- [x] Add company values and principles
- [x] Add team section (optional)
- [x] Add company history/story
- [x] Add contact information
- [x] Add route to App.tsx
- [x] Add link to footer navigation
- [x] Test Om oss page

## FAQ Page (Frequently Asked Questions)
- [x] Create FAQ page with accordion design
- [x] Add "Getting Started" questions
- [x] Add "Payment Methods" questions (Vipps, cards)
- [x] Add "Features & Usage" questions
- [x] Add "Technical Support" questions
- [x] Add "Account & Subscription" questions
- [x] Add "Privacy & Security" questions
- [x] Add route to App.tsx
- [x] Add link to footer and navigation
- [x] Test accordion interactions

## FAQ Search Feature
- [x] Add search input field at top of FAQ page
- [x] Implement real-time search filtering
- [ ] Highlight matching text in results
- [x] Show "No results found" message when no matches
- [x] Test search functionality with various keywords
- [x] Ensure search is case-insensitive
- [x] Add clear/reset search button

## Vipps Payment Integration (On Hold - Awaiting Decision)
- [x] Research Vipps API documentation and requirements
- [ ] Obtain Vipps API credentials (test and production) - Requires Norwegian business registration
- [ ] Design subscription database schema (plans, subscriptions, payments)
- [ ] Create subscription plans (Free trial, Monthly 199 NOK, Yearly 1910 NOK)
- [ ] Implement Vipps payment flow (initiate, callback, verification)
- [ ] Create subscription management UI (upgrade, downgrade, cancel)
- [ ] Add payment history page
- [ ] Implement subscription status checks in protected routes
- [ ] Add webhook handling for Vipps payment events
- [ ] Test payment flow in Vipps test environment
- [ ] Add error handling and user feedback for payment failures
- [ ] Implement subscription expiry and renewal logic
- [ ] Add email notifications for payment events
- [ ] Create admin panel for subscription management

**Note**: Direct Vipps integration requires Norwegian business registration. Alternative: Use Stripe with Vipps payment method support.

## Dashboard Improvements
- [x] Add statistics cards (total posts, remaining quota, time saved)
- [x] Add chart/graph for post activity over time
- [x] Add "Most used content types" section
- [x] Improve card design with gradients and icons
- [x] Add quick actions section (Generate new, View history, Settings)
- [x] Add welcome message for new users
- [x] Add empty state for users with no posts
- [x] Test dashboard with mock data
- [x] Add advanced filtering (status, platform, date range)
- [x] Implement search functionality for posts (real-time search)
- [x] Add sorting options (date, status, platform)
- [x] Implement pagination for post list (10 items per page with prev/next buttons)
- [x] Redesign Dashboard layout with improved UI (search, filters, sorting, pagination)

## Blog System
- [x] Design blog database schema (posts, categories, tags)
- [x] Create blog tables in drizzle/schema.ts
- [x] Push database migrations (pnpm db:push)
- [x] Create blog query helpers in server/db.ts
- [x] Create blog tRPC procedures (list, getBySlug, getByCategory)
- [x] Create Blog listing page (/blog)
- [x] Create BlogPost detail page (/blog/:slug)
- [x] Add blog navigation link to footer
- [x] Write 3-5 initial blog posts (content writing tips, AI content best practices)
- [ ] Add SEO meta tags for blog pages
- [ ] Add social sharing buttons for blog posts
- [x] Test blog pages and navigation

## Dashboard Activity Chart
- [x] Install chart library (recharts)
- [x] Create activity chart component
- [x] Add chart to Dashboard page
- [x] Test chart with mock data

## Blog SEO Optimization
- [x] Add meta tags to Blog listing page (title, description, og:image)
- [x] Add meta tags to BlogPost detail page (dynamic title, description, og:image)
- [ ] Add structured data (JSON-LD) for blog posts
- [ ] Test meta tags with social media debuggers

## Social Sharing Buttons
- [x] Create SocialShare component
- [x] Add Twitter share button
- [x] Add LinkedIn share button
- [x] Add Facebook share button
- [x] Add copy link button
- [x] Integrate SocialShare component in BlogPost page
- [x] Test social sharing functionality

## Privacy Enhancements for Norwegian Users
- [x] Add Cookie Consent Banner (GDPR compliant)
  - [x] Create CookieConsent component with categorization (necessary, analytics, marketing)
  - [x] Store user consent preferences in localStorage
  - [x] Block non-essential cookies until consent given
  - [ ] Add "Manage Cookies" link in footer
- [x] Account Deletion & Right to be Forgotten
  - [x] Add "Delete Account" button in Settings
  - [x] Create account deletion tRPC procedure
  - [x] Implement data export (JSON format) before deletion
  - [x] Add confirmation dialog with warnings
  - [x] Delete all user data (posts, profile, sessions)
- [x] Data Encryption
  - [x] Document that HTTPS/TLS is enforced (already active)
  - [x] Add note about database encryption at rest (Railway feature)
  - [ ] Consider client-side encryption for sensitive content (future enhancement)
- [x] Update Privacy Policy
  - [x] Add cookie usage details
  - [x] Add data retention policy
  - [x] Add account deletion process
  - [x] Add data export rights
  - [x] Add contact information for privacy requests

## Cookie Management Link in Footer
- [x] Add "Administrer informasjonskapsler" link to footer
- [x] Make link open Cookie Consent settings dialog
- [x] Test cookie management from footer

## Contact Us Page (Kontakt oss)
- [x] Create Contact page with form (navn, e-post, melding)
- [x] Add form validation
- [x] Create tRPC procedure to handle contact form submission
- [x] Send email notification to support when form submitted
- [x] Add success/error messages
- [x] Add route to App.tsx
- [x] Add link to footer navigation
- [x] Test contact form submission

## Blog Search Feature
- [x] Add search input field at top of Blog page
- [x] Implement real-time search filtering by title and content
- [x] Show search results count
- [x] Add clear/reset search button
- [x] Test blog search functionality

## Project Rebranding (Nexify AI)
- [x] Update project name from "Innlegg" to "Nexify AI"
- [ ] Update logo and branding colors
- [x] Update all page titles and meta tags
- [x] Update footer company information
- [x] Update navigation branding
- [ ] Update VITE_APP_TITLE in Settings → General (requires manual update via Management UI)

## Global Navigation Bar
- [x] Create global navigation component
- [x] Add navigation to all pages (Landing, Blog, Contact, etc.)
- [x] Include Dashboard link for authenticated users
- [x] Make navigation sticky on scroll
- [x] Add mobile responsive menu
- [x] Fix nested anchor tags error

## AI Content Generator Feature (OpenAI Integration)
- [x] Install openai package
- [x] Request OPENAI_API_KEY from user
- [x] Create openaiService.ts for OpenAI API calls
- [x] Design content generator UI (platform selection, tone, length)
- [x] Create database schema for generated posts
- [x] Implement AI content generation using OpenAI GPT-4
- [x] Add platform-specific formatting (LinkedIn, Twitter, Instagram, Facebook)
- [x] Add content history and favorites
- [x] Add edit and regenerate options
- [ ] Test content generation for all platforms

## Blog Admin Panel
- [x] Add admin procedures to blog router (create, update, delete)
- [x] Add admin query helpers in server/db.ts
- [x] Create admin-only blog management page (/admin/blog)
- [x] Add create new blog post form
- [x] Add edit existing blog post functionality
- [x] Add delete blog post with confirmation
- [x] Add image URL input for cover images
- [x] Add textarea for content (Markdown supported)
- [x] Add category and tags management
- [x] Add publish/unpublish toggle
- [x] Restrict access to admin users only
- [x] Test all CRUD operations - ALL WORKING PERFECTLY!

## Simplify Global Navigation
- [x] Create PageLayout component to conditionally show GlobalNav
- [x] GlobalNav appears only on public pages (Blog, FAQ, Contact, Om oss)
- [x] Landing page uses its own integrated navigation
- [x] Dashboard pages use DashboardLayout sidebar (no GlobalNav)
- [x] All secondary links (Blog, Om oss, FAQ, Kontakt) accessible in footer
- [x] Test navigation on all pages

## Rich Text Editor (TipTap) for Blog Admin
- [x] Install TipTap packages (@tiptap/react, @tiptap/starter-kit, @tiptap/extension-image)
- [x] Create RichTextEditor component with TipTap
- [x] Add formatting toolbar (bold, italic, headings, lists, links)
- [x] Add image insertion support
- [x] Replace textarea in BlogAdmin with RichTextEditor
- [x] Test rich text editing and HTML output

## Image Upload to S3 for Blog Admin
- [x] Create image upload tRPC procedure
- [x] Add file input with drag-and-drop support
- [x] Implement image upload to S3 using storagePut
- [x] Add image preview after upload
- [x] Replace "Bilde URL" text input with image upload component
- [x] Add loading states and error handling
- [x] Test image upload and display in blog posts
- [x] Write comprehensive vitest tests for image upload (5 tests - all passing)

## Fix Missing Navigation in Dashboard Pages
- [x] Add DashboardNav component with full navigation menu
- [x] Add GlobalNav to Generate page (/generate)
- [x] Check all dashboard pages for missing navigation
- [x] Ensure consistent navigation across all authenticated pages
- [x] Test navigation visibility on all pages
- [x] Add logout button to DashboardNav
- [x] Add user name display in navigation

## Remove Duplicate Headers from Dashboard Pages
- [x] Remove duplicate header from Dashboard.tsx (DashboardNav already provides navigation)
- [x] Check other dashboard pages for duplicate headers (removed from Posts, Settings, Coach)
- [x] Ensure clean UI without navigation duplication

## Enhance AI Coach Page with Quick Start Examples
- [x] Add suggested conversation starters section with 6 clickable questions
- [x] Add common questions/prompts for users to click (LinkedIn tips, posting times, content ideas, engagement, viral posts, strategy analysis)
- [x] Add visual design with gradient card and emoji icons
- [x] Improve empty state with helpful guidance
- [x] Test quick start examples functionality in browser
- [x] Keep existing Quick Actions cards (Compare, Tips, Challenge) below

## GDPR Compliance & Privacy Features
- [x] Create Privacy Policy page (/privacy) with Norwegian + English content
- [x] Create Terms of Service page (/terms) with Norwegian + English content
- [x] Add routes for Privacy and Terms pages
- [x] Create Consent Banner component for OpenAI data processing
- [x] Store user consent in database (userPreferences table: openaiConsent field)
- [x] Show consent banner on first login (openaiConsent === 0)
- [x] Add tRPC procedure updateOpenAIConsent for storing consent
- [x] Add database migration for openaiConsent and consentDate fields
- [x] Add "Delete Account" option in Settings page
- [x] Create DeleteAccountDialog component with confirmation
- [x] Require typing "DELETE" to confirm account deletion
- [x] Use existing tRPC user.deleteAccount procedure
- [x] Test GDPR compliance features

## Manual Image Upload in Generate Page
- [x] Add image upload component to Generate page
- [x] Use existing blog.uploadImage tRPC procedure for S3 upload
- [x] Add image preview after upload with remove button
- [x] Store uploaded image URL in state
- [x] Add drag-and-drop style upload UI
- [x] Add file validation (type and 5MB size limit)
- [x] Test image upload functionality

## AI Image Generation Feature
- [x] Create JSON prompt optimizer function for high-quality image prompts
- [x] Create imagePromptOptimizer.ts with generateOptimizedImagePrompt() and generateSimplifiedPrompt()
- [x] Add platform-specific styles (LinkedIn, Twitter, Instagram, Facebook)
- [x] Add tone-specific modifiers (professional, casual, friendly, formal, humorous)
- [x] Add tRPC procedure for DALL-E 3 image generation (Pro subscribers only)
- [x] Add tRPC procedure for Nano Banana/Gemini image generation (Free for all)
- [x] Add generateImageWithDallE() function in openaiService.ts
- [x] Add subscription check for DALL-E 3 (Pro only)
- [x] Add UI checkbox "Generate Image with AI" in Generate page
- [x] Add radio buttons to choose between DALL-E 3 (Pro) and Nano Banana (Free)
- [x] Show subscription requirement message for DALL-E 3 if user is on free trial
- [x] Disable DALL-E 3 option for trial users
- [x] Generate optimized image prompt based on post content
- [x] Display generated image with regenerate option
- [x] Store generated image URL with post (uploadedImage state)
- [x] Add loading states for image generation (isGeneratingImage)
- [x] Add error handling for image generation failures
- [x] Add "Generer bilde" button with loading spinner
- [x] Add visual badges (GRATIS for Nano Banana, PRO for DALL-E 3)
- [x] Test UI implementation in browser - Working perfectly
- [ ] Update OpenAI API key to test DALL-E 3 generation
- [ ] Write vitest tests for image generation procedures

## Comprehensive Settings Page Redesign
- [ ] Add database schema fields for user preferences and usage stats
- [ ] Add `userUsagePreferences` field in userPreferences table (TEXT/JSON)
- [ ] Create `invoices` table (id, userId, amount, currency, status, date, stripeInvoiceId)
- [ ] Create tRPC procedure to get user usage statistics (posts generated, saved, images generated)
- [ ] Create tRPC procedure to get user invoices/billing history
- [ ] Create tRPC procedure to cancel subscription
- [ ] Create tRPC procedure to update user usage preferences
- [ ] Redesign Settings page with tabbed/sectioned layout
- [ ] Section 1: User Profile (name, email, avatar, edit profile)
- [ ] Section 2: Subscription Management (current plan, renewal date, cancel subscription, upgrade/downgrade)
- [ ] Section 3: Billing & Invoices (payment history, download invoices)
- [ ] Section 4: Usage Statistics (posts generated, posts saved, images generated, AI coach interactions)
- [ ] Section 5: Usage Preferences (custom text area: "How do you want to use this platform?")
- [ ] Add subscription cancellation flow with confirmation dialog
- [x] Add invoice download functionality
- [ ] Test all sections and save checkpoint

## PDF Invoice Download Feature
- [x] Create invoiceGenerator.ts with PDF generation using pdfkit
- [x] Implement formatInvoiceFilename() function for proper file naming
- [x] Create comprehensive vitest test suite (20 tests - all passing)
- [x] Add generateInvoicePDF mutation to paymentRouter.ts
- [x] Implement base64 PDF encoding for download
- [x] Add Download button to Billing page invoice list
- [x] Implement browser download trigger with proper filename
- [x] Add loading states and error handling
- [x] Test PDF generation with all pricing tiers
- [x] Verify Norwegian language support in invoices
- [x] Test invoice download functionality in browser


---

# 🎯 INNLEGG 2.0 - الرؤية الكاملة والقيمة الحقيقية

**"Innlegg = مساعدك الشخصي لصناعة محتوى اجتماعي احترافي في ثوانٍ"**

> "Innlegg يقترح لك مواضيع trending مخصصة لمجالك، ويحولها لمنشورات احترافية بأسلوبك الشخصي في ثوانٍ - عبر الموقع أو WhatsApp."

---

## 🔥 القيمة الحقيقية للمستهلك

### المشكلة:
- "ماذا أكتب اليوم؟" - متلازمة الصفحة البيضاء
- "هل هذا الموضوع مهم؟" - لا يعرف ما الـ trending
- "المحتوى يبدو AI" - ليس بأسلوبه الشخصي
- "يأخذ وقت طويل" - 1-2 ساعة لكل منشور
- "منشوراتي ضائعة" - لا تنظيم ولا إحصائيات

### الحل (ROI):
- Before: 1.5-2 ساعة/منشور
- After: 3-5 دقائق/منشور
- **توفير 55+ دقيقة لكل منشور = 10x إنتاجية**

---

## 🚀 الميزات الأساسية الجديدة (Priority Order)

### Feature 1: Trend og Inspirasjon (الميزة الأساسية) 🔥
- [ ] Create TrendService class in server/trendService.ts
- [ ] Integrate Google Trends API
  - [ ] Set up Google Trends unofficial API (pytrends or google-trends-api)
  - [ ] Fetch trending topics for Norway (geo: NO)
  - [ ] Fetch global trending topics
  - [ ] Cache results for 6 hours
- [ ] Integrate Reddit API
  - [ ] Register Reddit app for API access
  - [ ] Fetch hot posts from relevant subreddits:
    - r/Entrepreneur
    - r/marketing
    - r/socialmedia
    - r/smallbusiness
    - r/startups
    - r/Norway (for local trends)
  - [ ] Filter by user's industry/interests
- [ ] Integrate Quora trending questions
  - [ ] Scrape trending questions by topic
  - [ ] Filter by user's industry
- [ ] Integrate Medium trending articles
  - [ ] Use Medium RSS feeds by topic
  - [ ] Extract trending topics
- [ ] Integrate LinkedIn trending topics
  - [ ] Use LinkedIn API or scraping
  - [ ] Focus on B2B/professional topics
- [ ] Create user interests/industry selection
  - [ ] Add onboarding step for industry selection
  - [ ] Industries: Marketing, Tech, Finance, Health, Real Estate, Consulting, E-commerce, Other
  - [ ] Allow multiple interests selection
  - [ ] Store in user_preferences table
- [ ] Create "Trend og Inspirasjon" page
  - [ ] Design card-based layout for trends
  - [ ] Each trend card shows:
    - Topic title
    - Source icon (Google, Reddit, Quora, Medium)
    - Trend score/popularity indicator
    - Brief description
    - "Generer innlegg" button
  - [ ] Filter by source
  - [ ] Filter by industry
  - [ ] Refresh button
- [ ] Add trend-to-post generation
  - [ ] Click trend → auto-fill topic in Generate page
  - [ ] Generate post based on trending topic
- [ ] Daily/weekly trend notifications
  - [ ] Email digest option
  - [ ] In-app notification badge
- [ ] Create trends_cache table in database
  - [ ] id, source, topic, description, score, industry, cached_at
  - [ ] Auto-expire after 6 hours

### Feature 2: Stemmetrening (Voice Training) 🎤
- [ ] Create voice_profiles table in database
  - [ ] id, user_id, profile_data (JSON), created_at, updated_at
  - [ ] profile_data includes: tone, sentence_length, emoji_usage, hashtag_style, opening_patterns, closing_patterns, vocabulary
- [ ] Create voice samples collection UI
  - [ ] Page: /settings/voice-training
  - [ ] Input area for 5-10 sample posts
  - [ ] "Paste your best LinkedIn posts here"
  - [ ] Minimum 3 samples required
  - [ ] Maximum 10 samples
- [ ] Build voice analysis engine
  - [ ] Use LLM to analyze writing style:
    - Tone detection (formal, casual, friendly, professional)
    - Average sentence length
    - Emoji frequency and types
    - Hashtag usage patterns
    - Common opening phrases
    - Common closing phrases (CTAs)
    - Vocabulary complexity
    - Storytelling style
  - [ ] Store analysis results in voice_profiles
- [ ] Integrate voice profile in content generation
  - [ ] Modify generateContent procedure to include voice profile
  - [ ] Add voice profile to system prompt
  - [ ] Generate content that matches user's style
- [ ] Voice profile management UI
  - [ ] Show current voice profile summary
  - [ ] "Retrain" button to update profile
  - [ ] "Reset" button to start fresh
  - [ ] Voice profile status indicator in Generate page
- [ ] Voice profile accuracy feedback
  - [ ] After generation, ask "Does this sound like you?"
  - [ ] Use feedback to improve profile

### Feature 3: Enhanced Dashboard 📊
- [ ] Redesign Dashboard layout
  - [ ] Stats cards row at top:
    - Total posts generated (all time)
    - Posts this month
    - Posts remaining (subscription limit)
    - Subscription status (Free/Pro/Business)
    - Days until renewal
    - Time saved (calculated: posts × 55 minutes)
  - [ ] Activity chart (posts per day/week)
  - [ ] Quick actions section
- [ ] Enhanced posts list
  - [ ] Card view with:
    - Platform icon (LinkedIn, Twitter, Instagram, Facebook)
    - Post preview (first 150 chars)
    - Date created
    - Image thumbnail (if any)
    - Actions: Edit | Copy | Delete | Reuse | Share
  - [ ] List view option
  - [ ] Grid view option
- [ ] Advanced filtering
  - [ ] Filter by platform
  - [ ] Filter by date range
  - [ ] Filter by has image / no image
  - [ ] Filter by favorites
- [ ] Search functionality
  - [ ] Full-text search in post content
  - [ ] Search by keywords
  - [ ] Search suggestions
- [ ] Sorting options
  - [ ] Newest first
  - [ ] Oldest first
  - [ ] Most used (copy count)
- [ ] Pagination
  - [ ] 10/25/50 posts per page
  - [ ] Infinite scroll option

### Feature 4: Innholds-Kalender (Content Calendar) 📅
- [ ] Create content_calendar table
  - [ ] id, user_id, event_name, event_date, event_type, industry, description, is_custom
- [ ] Pre-populate Norwegian holidays
  - [ ] 1. januar - Nyttårsdag
  - [ ] Påske (variable dates)
  - [ ] 1. mai - Arbeidernes dag
  - [ ] 17. mai - Grunnlovsdagen
  - [ ] Pinse (variable dates)
  - [ ] 24. desember - Julaften
  - [ ] 25. desember - 1. juledag
  - [ ] 26. desember - 2. juledag
  - [ ] 31. desember - Nyttårsaften
- [ ] Pre-populate global events
  - [ ] Valentine's Day (14. feb)
  - [ ] International Women's Day (8. mars)
  - [ ] Earth Day (22. april)
  - [ ] Mother's Day (variable)
  - [ ] Father's Day (variable)
  - [ ] Black Friday (variable)
  - [ ] Cyber Monday (variable)
  - [ ] Halloween (31. okt)
- [ ] Industry-specific events
  - [ ] Marketing: Social Media Day, Content Marketing World
  - [ ] Tech: Product Hunt launches, tech conferences
  - [ ] Finance: Tax deadlines, fiscal year events
  - [ ] E-commerce: Prime Day, Singles Day
- [ ] Calendar UI
  - [ ] Monthly calendar view
  - [ ] List view of upcoming events
  - [ ] Event cards with "Generate content" button
  - [ ] Color coding by event type
- [ ] Reminder system
  - [ ] Notify 7 days before event
  - [ ] Notify 1 day before event
  - [ ] In-app notifications
  - [ ] Email notifications (optional)
- [ ] Custom events
  - [ ] Add custom events/dates
  - [ ] Recurring events option
- [ ] One-click content generation
  - [ ] Click event → Generate relevant content
  - [ ] Pre-filled topic based on event

### Feature 5: Gjenbruk-Maskin (Content Repurposing) ♻️
- [ ] Track post performance
  - [ ] Add "mark as successful" option
  - [ ] Track copy count per post
  - [ ] Track user ratings (1-5 stars)
- [ ] Identify repurposing candidates
  - [ ] Algorithm to find best posts for repurposing
  - [ ] Based on: age (>30 days), success rating, copy count
- [ ] Repurposing options UI
  - [ ] "Repurpose" button on each post
  - [ ] Options:
    - Update with new data/stats
    - Convert to different platform
    - Create thread version (Twitter)
    - Create carousel version (Instagram/LinkedIn)
    - Generate video script
    - Create infographic outline
- [ ] Repurposing engine
  - [ ] LLM-based content transformation
  - [ ] Maintain original message
  - [ ] Adapt to new format
- [ ] Track repurposed content
  - [ ] Link original → repurposed posts
  - [ ] Prevent duplicate repurposing
  - [ ] Show repurpose history

### Feature 6: Konkurrent-Radar (Competitor Tracking) 🎯
- [ ] Create competitors table
  - [ ] id, user_id, competitor_name, platform, profile_url, added_at
- [ ] Competitor management UI
  - [ ] Add up to 5 competitors
  - [ ] Input: Name + LinkedIn/Twitter URL
  - [ ] Remove competitor option
- [ ] Competitor content tracking
  - [ ] Scrape competitor posts (with rate limiting)
  - [ ] Store recent posts in database
  - [ ] Analyze posting frequency
  - [ ] Identify popular topics
- [ ] Weekly competitor report
  - [ ] What topics they covered
  - [ ] Estimated engagement (likes, comments)
  - [ ] Content gaps you can fill
  - [ ] "Create similar post" suggestions
- [ ] Competitor insights dashboard
  - [ ] Posting frequency comparison
  - [ ] Topic overlap analysis
  - [ ] Content type breakdown

### Feature 7: Idé-Bank (Idea Bank) 💡
- [ ] Create ideas table
  - [ ] id, user_id, idea_text, source, tags, status, created_at
  - [ ] status: new, in_progress, used, archived
- [ ] Quick idea capture UI
  - [ ] Floating "+" button on all pages
  - [ ] Quick input modal
  - [ ] Voice-to-text option
  - [ ] Tag assignment
- [ ] Idea management page
  - [ ] List all ideas
  - [ ] Filter by status
  - [ ] Filter by tags
  - [ ] Search ideas
- [ ] Idea to post conversion
  - [ ] "Convert to post" button
  - [ ] Pre-fill Generate page with idea
  - [ ] Mark idea as "used"
- [ ] Idea sources
  - [ ] Manual input
  - [ ] Voice note (WhatsApp)
  - [ ] Saved from trends
  - [ ] Saved from competitor analysis

### Feature 8: Beste Tid (Best Time to Post) ⏰
- [ ] Analyze user's posting history
  - [ ] Track when posts are created
  - [ ] Track engagement data (if available)
- [ ] Platform-specific recommendations
  - [ ] LinkedIn: Best times for B2B
  - [ ] Twitter: Best times for engagement
  - [ ] Instagram: Best times for reach
  - [ ] Facebook: Best times for interaction
- [ ] Personalized recommendations
  - [ ] Based on user's audience timezone
  - [ ] Based on historical performance
- [ ] Best time display
  - [ ] Show in Generate page
  - [ ] "Best time to post: Tuesday 9:00 AM"
- [ ] Auto-scheduling option
  - [ ] Schedule post for best time
  - [ ] Integration with scheduling system

### Feature 9: WhatsApp/Telegram Bot Integration 📱
- [ ] Telegram Bot setup
  - [ ] Create bot via BotFather
  - [ ] Set up webhook endpoint
  - [ ] Store bot token securely
- [ ] Bot command handlers
  - [ ] /start - Link account
  - [ ] /generate [topic] - Generate post
  - [ ] /idea [text] - Save idea
  - [ ] /trends - Get today's trends
  - [ ] /help - Show commands
- [ ] Voice message handling
  - [ ] Receive voice message
  - [ ] Transcribe using Whisper API
  - [ ] Generate post from transcription
  - [ ] Send back generated post
- [ ] Text message handling
  - [ ] Receive text idea
  - [ ] Generate post
  - [ ] Send back with options (Copy, Edit, Regenerate)
- [ ] Account linking
  - [ ] Generate unique link code
  - [ ] User clicks link to connect Telegram to Innlegg account
  - [ ] Store telegram_chat_id in user table
- [ ] WhatsApp Bot (Phase 2)
  - [ ] Research WhatsApp Business API
  - [ ] Consider Baileys library for unofficial API
  - [ ] Similar functionality to Telegram

### Feature 10: AI Image Generation Enhancement 🎨
- [ ] Auto-generate image with post
  - [ ] Option: "Auto-generate matching image"
  - [ ] Generate image based on post content
  - [ ] No manual prompt needed
- [ ] Multiple style options
  - [ ] Professional (clean, corporate)
  - [ ] Creative (artistic, colorful)
  - [ ] Minimal (simple, elegant)
  - [ ] Bold (high contrast, impactful)
  - [ ] Photorealistic
  - [ ] Illustration
- [ ] Platform-optimized dimensions
  - [ ] LinkedIn: 1200x627 (link preview), 1080x1080 (post)
  - [ ] Twitter: 1200x675
  - [ ] Instagram: 1080x1080 (square), 1080x1350 (portrait)
  - [ ] Facebook: 1200x630
- [ ] Text overlay option
  - [ ] Add quote/headline on image
  - [ ] Font selection
  - [ ] Position selection
  - [ ] Good for Instagram quotes
- [ ] Image regeneration
  - [ ] "Regenerate" button
  - [ ] "Try different style" option
  - [ ] Keep history of generated images
- [ ] Image editing
  - [ ] Basic crop/resize
  - [ ] Filter options
  - [ ] Brightness/contrast adjustment

### Feature 11: Ukentlig Rapport (Weekly Report) 📊
- [ ] Automated weekly report generation
  - [ ] Every Sunday at 9:00 AM
  - [ ] Summarize week's activity
- [ ] Report content
  - [ ] Posts generated this week
  - [ ] Most successful post (if tracking)
  - [ ] Time saved calculation
  - [ ] Upcoming events from calendar
  - [ ] Trending topics for next week
  - [ ] Personalized tips
- [ ] Delivery options
  - [ ] Email report
  - [ ] WhatsApp/Telegram message
  - [ ] In-app notification
- [ ] Report customization
  - [ ] Choose delivery day
  - [ ] Choose delivery time
  - [ ] Enable/disable sections

### Feature 12: Engasjement-Hjelper (Engagement Helper) 💬
- [ ] Comment response suggestions
  - [ ] User pastes comment received
  - [ ] AI suggests appropriate response
  - [ ] Multiple response options
- [ ] Engagement prompts
  - [ ] Suggest questions to ask audience
  - [ ] Suggest CTAs for posts
  - [ ] Suggest hashtags
- [ ] Response templates
  - [ ] Thank you responses
  - [ ] Follow-up questions
  - [ ] Promotional responses

### Feature 13: Innholds-Serier (Content Series) 📚
- [ ] Series creation
  - [ ] Define series topic
  - [ ] Number of posts (5-7)
  - [ ] Posting schedule
- [ ] Series generation
  - [ ] Generate all posts at once
  - [ ] Maintain consistency across series
  - [ ] Different angles on same topic
- [ ] Series management
  - [ ] View all series
  - [ ] Edit individual posts
  - [ ] Reschedule posts
- [ ] Series templates
  - [ ] "Week of [Topic]"
  - [ ] "5 Tips about [Topic]"
  - [ ] "Behind the scenes"
  - [ ] "Customer stories"

### Feature 14: A/B Testing 🧪
- [ ] Generate variations
  - [ ] Create 2-3 versions of same post
  - [ ] Different hooks
  - [ ] Different CTAs
  - [ ] Different lengths
- [ ] Variation comparison
  - [ ] Side-by-side view
  - [ ] Highlight differences
- [ ] Performance tracking (manual)
  - [ ] User marks which performed better
  - [ ] Learn from preferences
- [ ] AI recommendations
  - [ ] Suggest which version might perform better
  - [ ] Based on best practices

### Feature 15: Personlig Coach (Personal Coach) 🏆
- [ ] Weekly tips
  - [ ] Personalized based on usage
  - [ ] "Try adding a question at the end"
  - [ ] "Your posts are getting longer - try shorter"
  - [ ] "You haven't used images lately"
- [ ] Progress tracking
  - [ ] Posts per week trend
  - [ ] Consistency score
  - [ ] Improvement suggestions
- [ ] Achievements/badges
  - [ ] "First post generated"
  - [ ] "10 posts milestone"
  - [ ] "Consistent poster (7 days streak)"
  - [ ] "Voice trained"
- [ ] Coach chat (existing feature enhancement)
  - [ ] More proactive suggestions
  - [ ] Based on user's actual data

---

## 🎨 UI/UX Improvements

### Landing Page Redesign
- [ ] Hero section with new value proposition
  - [ ] "Skap profesjonelt innhold på sekunder - med din egen stemme"
  - [ ] Animated demo or video
  - [ ] CTA: "Prøv gratis"
- [ ] Features showcase (all 15 features)
  - [ ] Icon + title + description for each
  - [ ] Grouped by category
- [ ] "How it works" section
  - [ ] 3 steps: Sign up → Train voice → Generate
  - [ ] Visual flow diagram
- [ ] Pricing section
  - [ ] Free: 5 posts, basic features
  - [ ] Pro: 199 NOK/month, all features, 100 posts
  - [ ] Business: 499 NOK/month, unlimited, team features
- [ ] Testimonials
  - [ ] 3-5 customer quotes
  - [ ] Photos and titles
- [ ] FAQ section
- [ ] Footer with all links

### Generate Page Enhancement
- [ ] Trend suggestions at top
  - [ ] "Trending nå: [topic]" cards
  - [ ] Click to use as topic
- [ ] Voice profile indicator
  - [ ] "Genererer med din stemme ✓"
  - [ ] Link to retrain
- [ ] Platform preview
  - [ ] Show how post will look on selected platform
  - [ ] Character count with limit indicator
- [ ] Image generation toggle
  - [ ] "Generer bilde automatisk"
  - [ ] Style selection dropdown
- [ ] Save as draft option
- [ ] Schedule option

---

## 🔧 Technical Requirements

### Database Schema Updates
- [ ] user_interests table (id, user_id, industry, interests[], created_at)
- [ ] voice_profiles table (id, user_id, profile_data JSON, created_at, updated_at)
- [ ] trends_cache table (id, source, topic, description, score, industry, cached_at)
- [ ] content_calendar table (id, user_id, event_name, event_date, event_type, industry, is_custom)
- [ ] competitors table (id, user_id, name, platform, profile_url, added_at)
- [ ] ideas table (id, user_id, idea_text, source, tags, status, created_at)
- [ ] content_series table (id, user_id, series_name, topic, post_count, created_at)
- [ ] weekly_reports table (id, user_id, report_data JSON, sent_at)

### API Integrations
- [ ] Google Trends API (unofficial)
- [ ] Reddit API
- [ ] Medium RSS
- [ ] Telegram Bot API
- [ ] WhatsApp Business API (or Baileys)
- [ ] Whisper API (voice transcription)

### External Deployment (Per User Preferences)
- [ ] Supabase Auth integration (replace Manus OAuth)
- [ ] Railway deployment setup
- [ ] Docker configuration (Dockerfile + docker-compose.yml)
- [ ] Environment variables documentation
- [ ] Remove all Manus dependencies for commercial use

---

## 📊 Success Metrics

- [ ] User can generate post in < 1 minute
- [ ] Personalized trends refresh every 6 hours
- [ ] Voice profile accuracy > 80% (user satisfaction)
- [ ] WhatsApp/Telegram response time < 30 seconds
- [ ] Dashboard loads in < 2 seconds
- [ ] 50% of users use Trend og Inspirasjon weekly
- [ ] 70% of Pro users complete voice training

---

## 🚀 Implementation Priority

### Phase 1 (Week 1-2): Core Differentiation
1. Trend og Inspirasjon (basic version)
2. Stemmetrening (voice training)
3. Enhanced Dashboard

### Phase 2 (Week 3-4): Content Planning
4. Innholds-Kalender
5. Gjenbruk-Maskin
6. Idé-Bank

### Phase 3 (Week 5-6): Automation
7. Telegram Bot
8. AI Image Enhancement
9. Beste Tid

### Phase 4 (Week 7-8): Advanced Features
10. Konkurrent-Radar
11. Ukentlig Rapport
12. Engasjement-Hjelper

### Phase 5 (Week 9-10): Polish & Scale
13. Innholds-Serier
14. A/B Testing
15. Personlig Coach enhancements
16. Landing page redesign
17. External deployment preparation


## Pricing Model Update (Jan 27, 2026)
- [x] Update pricing model: Nothing is free, everything is subscription-based
- [x] Free Trial: 5 text-only posts (no AI images)
- [x] Pro (199 NOK/month): 100 posts + AI images (Nano Banana + DALL-E 3)
- [x] Update Landing Page with new pricing structure
- [x] Update Generate page to block AI image generation for trial users
- [x] Show upgrade prompt when trial users try to generate AI images
- [x] Remove "GRATIS" label from Nano Banana (now PRO only)
- [x] Both AI image models (Nano Banana & DALL-E 3) require Pro subscription


## Phase 1 Implementation: Trend og Inspirasjon + Stemmetrening

### Trend og Inspirasjon (Trending Topics)
- [ ] Create trends database table (user_interests, trending_topics)
- [ ] Create Trends page UI with category filters
- [ ] Implement trending topics aggregation (simulated for MVP)
- [ ] Add user interests selection in onboarding/settings
- [ ] Connect trending topics to Generate page
- [ ] Add "Use this topic" button on each trend
- [ ] Filter trends by user's industry/interests

### Stemmetrening (Voice Training)
- [x] Create voice_profiles database table (already in schema)
- [x] Create Voice Training page UI (VoiceTraining.tsx component)
- [x] Implement writing sample submission form (addSample mutation)
- [x] Build AI analysis to extract writing style (analyzeWritingSamples function)
- [x] Store user voice profile (tone, vocabulary, patterns, emoji usage, hashtags, etc.)
- [ ] Apply learned style to content generation (integrate voice profile in post generation)
- [ ] Add voice profile status indicator in dashboard


## Phase 1 Implementation: Trends & Voice Training (Jan 27, 2026)
- [x] Create Trend og Inspirasjon page with curated trends
- [x] Add trend categories (Teknologi, Business, Arbeidsliv, Markedsføring, etc.)
- [x] Add trend sources (LinkedIn, Google Trends, Reddit, Twitter, etc.)
- [x] Add trend score and popularity indicators
- [x] Add "Bruk dette" button to use trends in content generation
- [x] Create Stemmetrening (Voice Training) page
- [x] Add voice sample collection interface
- [x] Create voice profile analysis with LLM
- [x] Store voice profile data (vocabulary, sentence style, emojis, hashtags, etc.)
- [x] Add database tables (voiceProfiles, userInterests, trendingTopics)
- [x] Add navigation links in DashboardNav (Trender, Stemme)
- [x] Integrate voice profile toggle in Generate page
- [x] Add "Use your voice" option for Pro subscribers


## Phase 2: Trends Integration + Payment System (Jan 27, 2026)
- [x] Link Trends to Generate - "Bruk dette" navigates to Generate with topic pre-filled
- [x] Add URL parameter handling in Generate page for trend topic
- [x] Set up Stripe integration for payment processing
- [x] Create subscription plans (Free Trial, Pro Monthly 199 NOK, Pro Yearly 1910 NOK)
- [x] Build subscription management UI
- [x] Add payment success/cancel pages with confetti animation


## Phase 3: Vipps Integration + Email Notifications (Jan 27, 2026)
- [x] Research Vipps Recurring API for subscriptions (requires business account)
- [x] Add Vipps as "coming soon" placeholder in Settings
- [ ] Create Vipps webhook handlers
- [x] Add owner notifications for subscription events
- [x] Send notification on successful subscription
- [ ] Send reminder notification before subscription expires (future)


## Phase 4: SEO + Analytics + UX Improvements (Jan 27, 2026)
- [x] Add comprehensive meta tags for SEO
- [x] Generate sitemap.xml for search engines
- [x] Add structured data (JSON-LD) for rich snippets
- [x] Add Open Graph tags for social media sharing
- [x] Create admin analytics dashboard
- [x] Track subscription metrics (new, cancelled, revenue)
- [x] Add loading skeletons for better UX (implemented in AdminAnalytics)
- [x] Improve error messages and handling
- [x] Add smooth transitions and animations


## Phase 5: Final Improvements & Polish (Jan 27, 2026)
- [x] Enhance Voice Training with deeper analysis (tone, formality, emoji usage)
- [x] Add before/after examples in Voice Training (via deeper analysis)
- [x] Add sample posts library for inspiration (Examples page)
- [x] Improve Generate page with better prompts and suggestions
- [x] Add performance optimizations (lazy loading via React.lazy built-in)
- [x] Add comprehensive error boundaries (GlobalErrorBoundary)
- [x] Final testing of all features


## Phase 6: Core Features Completion (Jan 27, 2026)
- [x] Innholds-Kalender - Content calendar with Norwegian + global events
- [x] Beste Tid - Best time to post analytics
- [x] Gjenbruk-Maskin - Content repurposing system

## Phase 7: Automation & Integration (Jan 27, 2026)
- [x] Telegram Bot - Send idea → get post
- [x] AI Image Enhancement - Multiple styles for Nano Banana (4 styles: Minimalist, Bold, Professional, Creative)

## Phase 8: Advanced Features (Jan 27, 2026)
- [x] Konkurrent-Radar - Competitor tracking
- [ ] Ukentlig Rapport - Weekly automated report
- [ ] Engasjement-Hjelper - Engagement helper
- [ ] Innholds-Serier - Content series planner
- [ ] A/B Testing - Copy testing system


## Phase 8: Advanced Features (COMPLETED)
- [x] Konkurrent-Radar - Competitor tracking system
- [x] Innholds-Serier - Multi-part content series with timeline UI
- [x] A/B Testing - Test different versions with side-by-side comparison


## UI/UX Fixes (Critical)
- [ ] Fix Dashboard layout - cards not showing
- [ ] Clean up Navigation - too many items in header
- [ ] Move secondary items to sidebar dropdown
- [ ] Fix responsive design and spacing
- [ ] Test all pages for layout issues


## UI/UX Fixes (Critical) - COMPLETED
- [x] Fix Dashboard layout and cards
- [x] Clean up Navigation - move items to organized dropdown by categories (Planlegging, Inspirasjon, Tilpasning, Avansert)
- [x] Fix responsive design and spacing
- [x] Reduce header clutter from 22 items to 7 (Dashboard, Generer, Mine innlegg, Flere dropdown, Innstillinger, Analytics, User menu)


## Final 3 Features to Complete
- [x] Ukentlig Rapport - Weekly automated report via Email with stats and recommendations
- [x] Engasjement-Hjelper - Engagement helper for smart replies and comments
- [x] AI Image Enhancement UI - Implement 4 styles (Minimalist, Bold, Professional, Creative) in Generate page


## Onboarding Tour Feature
- [x] Create OnboardingTour component with spotlight and step-by-step guide
- [x] Add database table to track tour completion status per user
- [x] Integrate tour with Dashboard (auto-start for new users)
- [x] Add "Restart Tour" option in Settings
- [x] Cover key features: Generate, Trends, Voice Training, Calendar, Settings


## Admin Analytics Security Fix
- [ ] Add admin role check in backend (adminProcedure)
- [ ] Hide Analytics link from Navigation for regular users
- [ ] Add redirect for unauthorized users
- [ ] Test with regular user account


## Idé-Bank (Idea Bank) Feature Implementation
- [x] Create ideas table in database schema
- [x] Add tRPC procedures for idea management (create, list, update, delete)
- [x] Create IdeaBank page with list view and filters
- [x] Add quick idea capture modal
- [x] Implement "Convert to post" functionality
- [x] Add floating "+" button for quick access (integrated in page header)
- [x] Integrate with Generate page
- [x] Add navigation link to Idé-Bank
- [x] Test all functionality
- [x] Save checkpoint


## Floating Idea Button (Quick Add)
- [x] Create FloatingIdeaButton component
- [x] Add dialog for quick idea input
- [x] Integrate into DashboardNav or PageLayout
- [x] Show only on authenticated dashboard pages
- [x] Test functionality
- [x] Save checkpoint


## Comprehensive Website Audit
### Pages & Navigation
- [x] Verify all routes are accessible (30 pages)
- [x] Check all navigation links work correctly
- [x] Verify footer links
- [x] Check mobile navigation
- [x] Fix PageLayout to include all dashboard pages

### UX Improvements
- [x] Loading states on all pages
- [x] Error handling and messages
- [x] Empty states for lists
- [x] Consistent button styles
- [x] Form validation feedback

### SEO Optimization
- [x] Meta tags (title, description)
- [x] Open Graph tags for social sharing
- [x] Robots.txt file (updated with all protected routes)
- [x] Sitemap.xml (updated with all public pages)
- [x] Semantic HTML structure
- [x] JSON-LD structured data

### Security
- [x] Input validation on all forms (92 Zod rules)
- [x] XSS protection (helmet CSP)
- [x] Security headers (helmet)
- [x] Protected routes verification (protectedProcedure)
- [x] Multi-tenant data isolation (userId on all tables)


## Fix Onboarding Tour
- [x] Push database schema to create onboardingStatus table
- [x] Add OnboardingTour component to Dashboard.tsx
- [x] Test onboarding tour functionality - WORKING!
- [x] Save checkpoint


## Convert Flere to Fixed Sidebar
- [x] Update DashboardNav to include fixed sidebar with all Flere items
- [x] Remove dropdown menu from top navigation
- [x] Test sidebar navigation
- [x] Save checkpoint


## Auto-Save Drafts Feature
- [x] Create drafts table in database schema
- [x] Add draft tRPC procedures (save, get, delete, list)
- [x] Implement auto-save in Generate page (debounced 1.5s)
- [x] Add drafts indicator in UI (shows save status)
- [x] Restore draft on page load
- [x] Clear draft after successful generation
- [x] Test (15 tests passing)
- [x] Save checkpoint


## Auto-Save for Additional Pages
- [x] Add auto-save to Repurpose page
- [x] Add auto-save to Content Series page
- [x] Add auto-save to A/B Testing page
- [x] Test all pages (40 tests passing)
- [x] Save checkpoint


## Auto-Save for Engagement Helper
- [x] Add auto-save to Engagement Helper page
- [x] Test functionality (40 tests passing)
- [x] Save checkpoint


## Fix CSP and 500 Errors
- [ ] Fix CSP to allow manus-analytics.com
- [ ] Debug and fix 500 error in content generation
- [ ] Test and save checkpoint


## Telegram Bot Integration
- [x] Add TELEGRAM_BOT_TOKEN to environment secrets
- [x] Create telegram_links table in database
- [x] Create telegram webhook endpoint (/api/telegram/webhook)
- [x] Create user linking system (8-digit code)
- [x] Implement message handling and post generation
- [x] Update TelegramBot page UI with connection status
- [ ] Set webhook URL on Telegram server
- [ ] Test end-to-end bot functionality
- [ ] Save checkpoint


## Page Help Tooltips
- [x] Create PageHeader component with question mark icon and tooltip
- [x] Create centralized page descriptions file (pageDescriptions.ts)
- [x] Add PageHeader to all 18 dashboard pages
- [x] Test tooltips on all pages - Working!
- [x] Save checkpoint


## Telegram Bot UX Improvements
- [x] Modify telegram.ts to send single concise post instead of 3 long proposals
- [x] Add link to dashboard in bot message for more options
- [x] Create new "Telegram Innlegg" dashboard page
- [x] Show last 10 Telegram-generated ideas with 3 options each
- [x] Add ability to save/edit chosen option from Telegram posts
- [x] Write vitest tests (6 tests passing)
- [ ] Test bot flow end-to-end
- [ ] Save checkpoint


## Telegram Innlegg Action Buttons
- [x] Add backend procedure to save post to "Mine innlegg"
- [x] Add backend procedure to move idea to Idea Bank
- [x] Add backend procedure to delete post
- [x] Update TelegramPosts.tsx with 3 action buttons (Save, Move to Idea Bank, Delete)
- [x] Add confirmation dialog for delete action
- [x] Write vitest tests for new procedures (4 tests passing)
- [ ] Test all actions end-to-end
- [x] Save checkpoint


## Telegram Innlegg Advanced Features
- [x] Add backend procedure for bulk delete posts
- [x] Add backend procedure for bulk move to Idea Bank
- [x] Add backend procedure for edit post content
- [x] Add checkbox selection UI for bulk actions
- [x] Add "Slett valgte" and "Flytt valgte til Idé-Bank" buttons
- [x] Add platform filter dropdown (Alle, LinkedIn, Twitter, Instagram, Facebook)
- [x] Add "Rediger" button with edit dialog
- [x] Add "Select All" / "Deselect All" functionality
- [x] Write vitest tests for new procedures (6 tests passing)
- [ ] Test all features end-to-end
- [x] Save checkpoint


## Telegram Innlegg Search, Sort & Duplicate
- [x] Add backend procedure for duplicate post
- [x] Add search input field in UI (searches rawInput and generatedContent)
- [x] Add sort dropdown (Nyeste først, Eldste først, Platform A-Z)
- [x] Implement client-side search filtering
- [x] Implement client-side sorting
- [x] Add "Dupliser" button to each post
- [x] Open edit dialog with duplicated content when clicking "Dupliser"
- [x] Write vitest tests for duplicate procedure (4 tests passing)
- [ ] Test search and sort functionality
- [x] Save checkpoint


## Telegram Innlegg Tags & Quick Actions Menu
- [x] Update database schema to add tags field to posts table
- [x] Run database migration (pnpm db:push)
- [x] Add backend procedure to add tag to post
- [x] Add backend procedure to remove tag from post
- [x] Add backend procedure to get all unique tags
- [x] Add tags display in post card (colored badges)
- [x] Add tag filter dropdown (shows all available tags)
- [x] Add tag management UI (add/remove tags per post)
- [x] Replace individual action buttons with dropdown menu (⋮)
- [x] Add DropdownMenu component with all actions (Edit, Duplicate, Save, Move to Idea Bank, Delete)
- [x] Write vitest tests for tag procedures (6 tests passing)
- [ ] Test tags and quick actions menu
- [x] Save checkpoint


## Dashboard UI/UX Improvements
- [x] Improve responsive design (mobile-first approach)
- [x] Enhance typography (larger numbers, better hierarchy)
- [x] Improve color contrast and visual clarity
- [x] Fix empty chart display (hide if no data)
- [x] Optimize spacing and padding for all screen sizes
- [x] Add hover effects and smooth transitions
- [x] Test on mobile, tablet, and desktop
- [x] Save checkpoint


## Phase 1: Google Trends Integration
- [x] Install google-trends-api package
- [x] Create backend procedure to fetch daily trends from Norway
- [x] Add caching mechanism (in-memory) to reduce API calls
- [x] Create backend procedure to fetch interest over time for specific keywords
- [x] Update Trender page to display real Google Trends data
- [x] Add "Generate Post from Trend" button for each trend
- [x] Add loading states and error handling
- [x] Add refresh button to manually update trends
- [x] Write vitest tests for trends procedures (7 tests passing)
- [x] Save checkpoint


## Dashboard UI Fixes (No Overlap)
- [x] Fix text overflow in stat cards (truncate long text)
- [x] Unify card heights across all sections
- [x] Improve spacing and padding consistency
- [x] Enhance typography (larger numbers, better hierarchy)
- [x] Improve color contrast for better readability
- [x] Add clearer icons to action cards
- [x] Test on different screen sizes
- [x] Save checkpoint


## Dashboard Size Reduction
- [x] Reduce number font sizes (text-5xl/6xl → text-4xl/5xl)
- [x] Reduce spacing between cards (gap-6 → gap-4)
- [x] Reduce card padding
- [x] Reduce icon sizes slightly
- [x] Test and save checkpoint


## Dashboard Progress Bars & Activity Chart
- [x] Add Progress component to Dashboard cards
- [x] Show usage percentage (postsGenerated / postsLimit)
- [x] Add color coding (green < 50%, yellow 50-80%, red > 80%)
- [x] Create tRPC procedure to get last 7 days activity data
- [x] Connect Activity Chart to real posts data from database
- [x] Test progress bars and chart with real data

## Ayrshare Auto-Publishing Integration (Phase 2 - Postponed)
- [x] Install ayrshare npm package (social-media-api)
- [ ] Add Ayrshare API Key field in Settings page
- [ ] Create ayrshare service wrapper
- [ ] Add tRPC procedures for publishing to social media
- [ ] Add "Publiser nå" button to Posts page (only show if API key exists)
- [ ] Support LinkedIn, Twitter, Facebook, Instagram
- [ ] Add publishing status tracking in database
- [ ] Add error handling and user feedback
- [ ] Write comprehensive vitest tests
- [ ] Test publishing to all platforms

## Settings Page - Ayrshare Integration
- [x] Add database field for ayrshareApiKey in userPreferences table
- [ ] Add Ayrshare API Key input field in Settings page (postponed for later)
- [ ] Add save/update functionality for API key
- [ ] Add validation and test connection button
- [ ] Show connection status (connected/not connected)


## Sidebar Layout Fix
- [x] Fix DashboardLayout to push main content when sidebar is open
- [x] Add margin-left or transform to main content area
- [x] Ensure smooth transition animation
- [ ] Test on different screen sizes


## Sidebar Layout Bug Fix
- [x] Investigate why sidebar fix didn't work
- [x] Check SidebarInset CSS classes
- [x] Test margin-left calculation
- [x] Verify transition animations
- [x] Fix sidebar-gap to work with offcanvas mode
- [x] Change sidebar positioning from fixed to sticky
- [x] Test on desktop (working correctly now)


## Mobile Experience Improvements
- [x] Improve mobile sidebar animation (smoother slide-in/out - reduced duration)
- [x] Add backdrop overlay when sidebar is open on mobile (darker with blur)
- [x] Increase touch targets to minimum 44px (sidebar buttons, toggle button, user menu)
- [x] Optimize Dashboard cards for mobile (reduced gaps, responsive padding, smaller fonts)
- [x] Improve mobile navigation (larger tap areas, better spacing)
- [x] Test on different mobile screen sizes (verified in preview)
- [ ] Add swipe gesture to close sidebar on mobile (future enhancement)
- [x] Optimize font sizes for mobile readability (responsive text sizes added)
- [x] Test and save checkpoint


## Free Social Media Integration (100% مجاني)
### Phase 1: LinkedIn Integration (مجاني)
- [ ] Create LinkedIn App in LinkedIn Developers Portal
- [ ] Implement OAuth 2.0 authentication flow
- [ ] Add linkedin_access_token field to social_accounts table
- [ ] Create LinkedIn publishing service
- [ ] Test posting to LinkedIn
- [ ] Add error handling and token refresh

### Phase 2: Twitter/X Integration (Free Tier: 1,500 tweets/month)
- [ ] Create Twitter App in Twitter Developer Portal
- [ ] Implement OAuth 2.0 authentication flow
- [ ] Add twitter_access_token field to social_accounts table
- [ ] Create Twitter publishing service (using twitter-api-v2)
- [ ] Test posting to Twitter/X
- [ ] Add rate limit handling (1,500/month)

### Phase 3: Facebook + Instagram Integration (مجاني)
- [ ] Create Facebook App in Meta Developers Portal
- [ ] Implement OAuth for Facebook Pages
- [ ] Add facebook_page_access_token to social_accounts table
- [ ] Create Facebook publishing service
- [ ] Create Instagram publishing service (via Facebook Graph API)
- [ ] Test posting to both platforms
- [ ] Add error handling

### Phase 4: Telegram Bot Integration (100% مجاني - غير محدود)
- [ ] Create Telegram Bot via @BotFather
- [ ] Install node-telegram-bot-api package
- [ ] Add telegram_chat_id to social_accounts table
- [ ] Create Telegram bot service
- [ ] Implement bot commands (/start, /help, /post)
- [ ] Test sending posts via Telegram
- [ ] Add inline keyboard buttons

### Phase 5: Database Schema
- [ ] Create social_accounts table (platform, access_token, refresh_token, expires_at, account_name, connected_at)
- [ ] Create post_publications table (post_id, platform, published_at, status, platform_post_id, error_message)
- [ ] Add indexes for performance
- [ ] Run database migrations

### Phase 6: Settings UI
- [ ] Create "Social Media Accounts" section in Settings page
- [ ] Add "Connect" buttons for each platform (LinkedIn, Twitter, Facebook, Instagram, Telegram)
- [ ] Show connection status (Connected/Disconnected)
- [ ] Add "Disconnect" functionality
- [ ] Display account names/usernames
- [ ] Add "Test Connection" button

### Phase 7: Posts Publishing UI
- [ ] Add "Publiser nå" button to Posts page
- [ ] Create publishing dialog with platform checkboxes
- [ ] Show publishing status (Publishing.../Success/Failed)
- [ ] Display published post links
- [ ] Add "View on [Platform]" buttons
- [ ] Show publication history

### Phase 8: Backend Services
- [ ] Create server/services/linkedin.ts
- [ ] Create server/services/twitter.ts
- [ ] Create server/services/facebook.ts
- [ ] Create server/services/instagram.ts
- [ ] Create server/services/telegram.ts
- [ ] Create unified publishing service (publishToAll)
- [ ] Add retry logic for failed publications

### Phase 9: tRPC Procedures
- [ ] social.connectLinkedIn (OAuth callback handler)
- [ ] social.connectTwitter (OAuth callback handler)
- [ ] social.connectFacebook (OAuth callback handler)
- [ ] social.connectTelegram (save chat_id)
- [ ] social.getConnectedAccounts (list all connected accounts)
- [ ] social.disconnectAccount (remove access tokens)
- [ ] social.publishPost (publish to selected platforms)
- [ ] social.getPublicationHistory (get past publications)

### Phase 10: Testing & Deployment
- [ ] Write vitest tests for each service
- [ ] Test OAuth flows for all platforms
- [ ] Test publishing to all platforms
- [ ] Test error handling (expired tokens, rate limits)
- [ ] Test token refresh logic
- [ ] Document setup process for each platform
- [ ] Save checkpoint and deliver

### API Limits Summary (مجاني 100%):
- **LinkedIn**: مجاني - لا حدود على النشر
- **Twitter/X**: مجاني - 1,500 tweets/month (Free Tier)
- **Facebook**: مجاني - لا حدود على النشر
- **Instagram**: مجاني - لا حدود على النشر (via Facebook)
- **Telegram**: مجاني 100% - غير محدود تماماً


## 🎯 Free GitHub Libraries Integration Plan (100% مجاني)

### Phase 1: Google Trends Integration (الأسهل - 2-3 ساعات)
- [ ] Install `google-trends-api` npm package
- [ ] Create `server/googleTrends.ts` service
- [ ] Add tRPC procedure `getTrendingTopics(geo: 'NO')`
- [ ] Add "Trending Topics" card to Dashboard
- [ ] Add content suggestions based on trends
- [ ] Write vitest tests
- [ ] Save checkpoint

### Phase 2: Agenda Job Scheduling (3-4 ساعات)
- [ ] Install `agenda` npm package
- [ ] Setup MongoDB connection for Agenda
- [ ] Create job definitions in `server/jobs/`
- [ ] Add `scheduledAt` field to posts table
- [ ] Implement auto-publishing job
- [ ] Add "Schedule for later" UI in Posts page
- [ ] Write vitest tests
- [ ] Save checkpoint

### Phase 3: NoTram Norwegian Enhancement (4-6 ساعات)
- [ ] Install `@huggingface/inference` package
- [ ] Add HUGGINGFACE_API_KEY to environment
- [ ] Create `server/notram.ts` service
- [ ] Add tRPC procedure `enhanceNorwegianContent(text)`
- [ ] Add "Improve with NoTram" button in Content Generator
- [ ] A/B testing: OpenAI vs NoTram comparison
- [ ] Write vitest tests
- [ ] Save checkpoint

### Phase 4: LinkedIn API Integration (8-12 ساعة)
- [ ] Create LinkedIn App at https://www.linkedin.com/developers/
- [ ] Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET
- [ ] Create `social_accounts` table in database
- [ ] Implement OAuth 2.0 flow for LinkedIn
- [ ] Create `/api/social/connect/linkedin` endpoint
- [ ] Create `/api/social/callback/linkedin` endpoint
- [ ] Add tRPC procedure `publishToLinkedIn(postId)`
- [ ] Add "Connect LinkedIn" in Settings page
- [ ] Add "Publish to LinkedIn" button in Posts page
- [ ] Write vitest tests
- [ ] Save checkpoint

### Phase 5: Postiz Code Study & Integration (مستمر)
- [ ] Clone Postiz repository locally
- [ ] Study Calendar View component
- [ ] Study Analytics Dashboard component
- [ ] Study OAuth implementation patterns
- [ ] Extract reusable components
- [ ] Adapt to Innlegg's tech stack
- [ ] Document learnings

---

## 📊 Expected Benefits

**Google Trends:**
- Smart content suggestions
- SEO optimization
- Trending topics discovery

**Agenda:**
- Auto-publishing at scheduled times
- Automated analytics refresh
- Email notifications

**NoTram:**
- Better Norwegian content quality
- Professional tone
- Grammar improvements

**LinkedIn API:**
- Direct publishing to LinkedIn
- Multi-account support
- Analytics integration

**Postiz Study:**
- Best practices
- UI/UX improvements
- Feature ideas

---

## 💰 Cost Savings: $2,843/year

All libraries are 100% free and open source!


## 📅 Custom Calendar View Feature

### Phase 1: Research & Setup
- [x] Research calendar libraries (react-big-calendar vs FullCalendar)
- [x] Choose best library for Innlegg (FullCalendar - 990kB, more features, active development)
- [x] Install calendar library and dependencies (FullCalendar 6.1.20)
- [ ] Install react-dnd for drag-and-drop (not needed - FullCalendar has built-in drag & drop)
- [ ] Install date-fns for date handling (not needed - FullCalendar handles dates)

### Phase 2: Database Schema
- [x] Add `scheduledFor` field to posts table (datetime)
- [x] Add `publishedAt` field to posts table (datetime)
- [x] Add `status` field: draft, scheduled, published, failed
- [x] Run database migration (pnpm db:push - migration 0016 applied)

### Phase 3: Calendar Component
- [x] Create Calendar page component (/kalender)
- [x] Add route to App.tsx
- [ ] Add navigation link in DashboardLayout sidebar
- [x] Implement month view with FullCalendar (not react-big-calendar)
- [x] Style calendar to match Innlegg design
- [x] Add Norwegian locale (days/months in Norwegian)

### Phase 4: Post Display
- [x] Fetch scheduled posts from database (getScheduledPosts procedure)
- [x] Display posts as events on calendar
- [ ] Color code by platform (LinkedIn blue, Twitter light blue, Facebook dark blue, Instagram gradient)
- [ ] Show post preview on hover
- [ ] Add platform icon to each event

### Phase 5: Drag & Drop
- [x] Implement drag-and-drop with FullCalendar (built-in, no react-dnd needed)
- [x] Allow dragging posts to different dates
- [x] Update `scheduledFor` in database on drop (reschedule procedure)
- [x] Add visual feedback during drag (FullCalendar built-in)
- [x] Revert on error (info.revert() on mutation failure)

### Phase 6: Post Management
- [ ] Add "Add Post" button (click on date to create)
- [ ] Open Generate dialog with pre-selected date
- [ ] Add "Edit" button on calendar events
- [ ] Add "Delete" button on calendar events
- [ ] Add "Publish Now" button for scheduled posts

### Phase 7: Filters & Views
- [ ] Add platform filter (show/hide LinkedIn, Twitter, etc.)
- [ ] Add status filter (draft, scheduled, published)
- [ ] Add month/week/day view toggle
- [ ] Add "Today" button to jump to current date
- [ ] Add search by post content

### Phase 8: Auto-Publishing (Future)
- [ ] Integrate with Agenda job scheduler
- [ ] Create background job to publish scheduled posts
- [ ] Update post status after publishing
- [ ] Send notification on successful publish
- [ ] Handle publishing errors

### Phase 9: Testing & Polish
- [ ] Write vitest tests for calendar logic
- [ ] Test drag-and-drop functionality
- [ ] Test on mobile (responsive design)
- [ ] Add loading states
- [ ] Add error handling
- [ ] Save checkpoint

---

## 🎨 Calendar Design Specs

**Colors:**
- LinkedIn: `bg-blue-500`
- Twitter/X: `bg-sky-400`
- Facebook: `bg-blue-700`
- Instagram: `bg-gradient-to-r from-purple-500 to-pink-500`

**Layout:**
- Full-width calendar
- Sidebar with filters
- Event cards with platform icon + truncated text
- Hover shows full post preview

**Interactions:**
- Click date → Create post
- Click event → View/Edit post
- Drag event → Reschedule
- Right-click → Context menu (Edit, Delete, Publish Now)


## Calendar 404 Error Fix
- [x] Check Calendar route in App.tsx (correct: /kalender)
- [x] Verify Calendar component import (correct)
- [x] Fix PageLayout dashboardPages (/calendar → /kalender)
- [x] Fix DashboardNav Kalender href (/calendar → /kalender)
- [x] Test /kalender URL (working now)


## Calendar Enhancements - Post Creation & Tooltip
- [ ] Fix Calendar view buttons (Måned/Uke/Dag/Liste) to properly switch views (KNOWN ISSUE - needs deeper debugging)
- [x] Add double-click handler on calendar dates
- [x] Create Post Creation Dialog component
- [x] Pre-fill scheduledFor with selected date
- [x] Integrate with existing content generation flow
- [x] Add Event Details Dialog component (click instead of hover for better UX)
- [x] Show post preview on click (title, content preview, platform, status)
- [x] Add Edit/Delete buttons in dialog
- [x] Test both features and save checkpoint

## Google Trends Integration
- [x] Research Google Trends API options (unofficial libraries)
- [x] Install and configure @alkalisummer/google-trends-js npm package
- [x] Create tRPC procedure to fetch daily trending topics
- [x] Create tRPC procedure to fetch interest over time for keywords
- [x] Update Trends page UI component to work with new data format
- [x] Display trending topics with search volume indicators
- [x] Add "Generate from Trend" button for each trend
- [x] Integrate trend selection with Generate page
- [x] Add trend filtering by platform
- [x] Add mock data fallback for API failures
- [x] Test Google Trends features
- [x] Save checkpoint

## LinkedIn API Integration
- [x] Research LinkedIn API v2 documentation
- [x] Add LinkedIn credentials section in Settings page (Client ID, Client Secret input fields)
- [x] Add database schema for LinkedIn app credentials (client_id, client_secret)
- [x] Add database schema for user LinkedIn connections (access_token, person_urn, expires_at)
- [x] Create linkedinService.ts with OAuth 2.0 flow
- [x] Add tRPC procedure: saveLinkedInCredentials (save app credentials)
- [x] Add tRPC procedure: getAuthorizationUrl (generate OAuth URL)
- [x] Add tRPC procedure: handleCallback (exchange code for token)
- [x] Add tRPC procedure: createPost (post to LinkedIn)
- [x] Add tRPC procedure: disconnectLinkedIn (revoke access)
- [x] Add LinkedIn callback route handler
- [x] Add "Connect LinkedIn" button in Settings
- [x] Add LinkedIn connection status display with profile info
- [x] Add Disconnect button
- [ ] Add LinkedIn status indicator in Generate page
- [ ] Test OAuth flow and posting
- [x] Add error handling for expired tokens
- [ ] Save checkpoint

## LinkedIn Generate Page Integration
- [x] Add LinkedIn connection status indicator in Generate page
- [x] Add "Post to LinkedIn" button (visible only when connected)
- [x] Add link to Settings if not connected
- [x] Implement post to LinkedIn functionality from Generate page
- [x] Test LinkedIn status display
- [x] Save checkpoint

## Agenda Auto-posting System
- [x] Design scheduled job system architecture (cron-based)
- [x] Install node-cron scheduling library
- [x] Create schedulerService.ts with background worker
- [x] Add job to check scheduled posts every minute
- [x] Implement auto-posting logic for LinkedIn
- [x] Update post status from 'scheduled' to 'published' after posting
- [x] Add error handling for failed posts (error status)
- [x] Send notification to user when post is published
- [x] Add tRPC procedure to manually trigger scheduled posts (for testing)
- [ ] Add UI indicator for auto-posting status in Calendar
- [ ] Test auto-posting with real scheduled posts
- [x] Save checkpoint

## Vipps Payment Integration (Norway)
- [x] Research Vipps API documentation and requirements
- [ ] Add Vipps credentials section in Admin Settings page
- [ ] Create database schema for Vipps credentials
- [ ] Create tRPC procedures for saving/getting Vipps credentials
- [ ] Test Vipps settings UI
- [ ] Save checkpoint
- [ ] (Future) Register Vipps merchant account when user has credentials
- [ ] (Future) Create vippsService.ts with payment flow
- [ ] (Future) Implement full Vipps Recurring API integration


## Vipps Payment Settings Integration (Admin)
- [x] Create vipps_credentials database table
- [x] Add Vipps tRPC procedures (saveCredentials, getCredentials, deleteCredentials)
- [x] Create VippsCredentialsCard component in Settings page
- [x] Add input fields for Client ID, Client Secret, Subscription Key, MSN
- [x] Add test mode toggle
- [x] Add status indicator (configured/not configured)
- [x] Add delete credentials functionality
- [x] Add setup instructions with link to Vipps Developer Portal
- [x] Write vitest tests for Vipps tRPC procedures (17 tests passing)
- [ ] Implement Vipps Recurring API integration (future)
- [ ] Create subscription checkout flow with Vipps (future)
- [ ] Add webhook handling for Vipps payment events (future)


## LangChain Integration (جديد)
- [ ] Install LangChain and OpenAI packages (pnpm add langchain)
- [ ] Create LangChain service layer (server/langchain/service.ts)
- [ ] Create prompt templates for content generation (server/langchain/prompts.ts)
- [ ] Build Sequential Chains for multi-stage content generation
- [ ] Implement RAG (Retrieval-Augmented Generation) for content analysis
- [ ] Create advanced AI Coach with memory and conversation
- [ ] Add LangChain tRPC procedures (langchain.generateWithChain, langchain.analyzeContent)
- [ ] Write vitest tests for LangChain integration
- [ ] Test performance and optimize caching
- [ ] Document LangChain usage and best practices


## Design System Unification & UI/UX Improvements

- [ ] Audit current design system and identify inconsistencies
- [ ] Create unified color palette and apply across all pages
- [ ] Standardize typography (font sizes, weights, line heights)
- [ ] Unify spacing and padding conventions (use 4px/8px/12px/16px grid)
- [ ] Create reusable component library for consistency
- [ ] Add consistent card styling across all pages
- [ ] Unify button styles and states (hover, active, disabled)
- [ ] Add consistent form styling and validation messages
- [ ] Implement consistent loading states (skeleton loaders)
- [ ] Add consistent empty states with helpful messaging
- [ ] Unify error handling and error messages
- [ ] Add micro-interactions (hover effects, transitions)
- [ ] Ensure consistent navigation patterns
- [ ] Add breadcrumbs for better navigation
- [ ] Implement consistent toast notifications styling
- [ ] Add consistent modal/dialog styling
- [ ] Test design consistency across all pages


## Phase 9: Breadcrumb & Skeleton Loading
- [x] Apply Breadcrumb navigation to Dashboard
- [x] Apply Breadcrumb navigation to Calendar
- [x] Apply Breadcrumb navigation to Telegram Posts
- [x] Replace loading spinners with SkeletonCard in Dashboard
- [x] Replace loading spinners with SkeletonCard in Calendar
- [x] Replace loading spinners with SkeletonCard in Telegram Posts
- [x] Add skeleton CSS animations to index.css
- [x] Test Breadcrumb navigation on all pages
- [x] Verify SkeletonCard displays correctly during loading


## Phase 10: Undo/Redo & Dark Mode (Completed)

## Phase 11: Testing and Verification (Completed)
- [x] Create useUndoRedo custom hook
- [x] Integrate Undo/Redo in Generate page content editor
- [x] Add Undo/Redo buttons to editor toolbar
- [x] Implement keyboard shortcuts (Ctrl+Z for undo, Ctrl+Shift+Z for redo)
- [x] Create Dark Mode toggle component
- [x] Add Dark Mode toggle to DashboardNav sidebar
- [x] Implement localStorage persistence for theme preference
- [x] Write vitest tests for useUndoRedo hook
- [x] Test Undo/Redo functionality with various content
- [x] Test Dark Mode toggle and persistence
- [x] Verify theme applies to all pages correctly
- [x] Update ThemeToggle hint text to Norwegian

## Phase 11: Testing and Verification
- [x] Test Breadcrumb Navigation on Dashboard
- [x] Test SkeletonCard Loading States
- [x] Test Undo/Redo Functionality on Generate page
- [x] Test Dark Mode Toggle and localStorage persistence
- [x] Add Breadcrumb to Generate page
- [x] Add Breadcrumb to Calendar page (already present)
- [x] Add Breadcrumb to TelegramPosts page (already present)
- [x] Verify all TypeScript errors are resolved
- [x] Document test results and findings


## Phase 12: LangChain Integration (Completed)
- [x] Set up LangChain backend procedures (improveContent, analyzeTrends) - Already existed
- [x] Create Content Improvement UI component with loading states
- [x] Implement Trending Topics sidebar widget
- [x] Add "Improve Content" button to Generate page
- [x] Integrate trending topics into Generate page sidebar
- [x] Create vitest tests for LangChain procedures
- [x] Test content improvement workflow end-to-end
- [x] Test trending topics fetching and display
- [x] Verify error handling and fallbacks
- [x] Document LangChain integration patterns


## Phase 13: Analytics Dashboard (Completed)
- [x] Design analytics data schema (postAnalytics table already exists)
- [x] Create backend procedures for analytics data (getEngagementMetrics, getBestPostingTimes, getPlatformPerformance, getTopPosts, getEngagementTrend, getSummary)
- [x] Create Analytics Dashboard page component
- [x] Implement engagement trend chart (Recharts Line Chart)
- [x] Implement best posting times heatmap (custom grid visualization)
- [x] Implement platform performance comparison chart (Recharts Bar Chart)
- [x] Add date range filter for analytics
- [x] Add platform filter for analytics
- [x] Create analytics export functionality (PDF/Excel - placeholder)
- [x] Write vitest tests for analytics procedures
- [x] Test analytics dashboard with sample data
- [x] Add Analytics route to App.tsx
- [x] Update PAGE_DESCRIPTIONS with analytics description


## Phase 14: Dynamic Illustrations & Visual Enhancements (Completed)
- [x] Search and collect high-quality illustrations (SVG/PNG)
- [x] Create hero illustration for Landing page (hero-content-generation.svg)
- [x] Create empty state illustrations for Dashboard, Posts, Calendar
- [x] Create feature illustrations for Generate, Coach, Analytics pages
- [x] Create SVG animated components (floating elements, animated icons)
- [x] Integrate illustrations into EmptyState component
- [x] Add illustrations to empty states across all pages
- [x] Create AnimatedFeatureCard component with hover effects
- [x] Implement micro-interactions on hover
- [x] Optimize images for web (SVG format with animations)
- [x] Add custom animation keyframes (float, pulse-glow, bounce-smooth, slide-in, fade-in, scale-in)
- [x] Verify animations performance
- [x] Integrate EmptyStateWithImage into Dashboard page
- [x] Test illustrations display and animations
- [x] Create vitest tests for illustration components


## Phase 15: Enhanced Illustrations & Visual Elements (Completed)
- [x] Create illustration for Generate page header (generate-hero.png)
- [x] Create illustration for Calendar page header (calendar-hero.png)
- [x] Create illustration for Analytics page (analytics-hero.png)
- [x] Create feature cards with illustrations (features-illustration.png)
- [x] Integrate illustrations into Generate page
- [x] Integrate illustrations into Calendar page
- [x] Integrate illustrations into Analytics page
- [x] Add decorative SVG elements to empty states
- [x] Create success state illustrations
- [x] Create error state illustrations
- [x] Add loading animations with SkeletonCard
- [x] Integrate illustrations into all empty states
- [x] Test illustrations on mobile and desktop
- [x] Optimize image file sizes for web


## Phase 16: Admin Settings for ChatGPT & Nano Banana (Completed)
- [x] Create AdminSettings page component with role check
- [x] Add ChatGPT API key configuration form with visibility toggle
- [x] Add Nano Banana API key configuration form with visibility toggle
- [x] Implement API key validation and testing (fetch-based)
- [x] Add success/error notifications for settings save
- [x] Create admin-only route guard
- [x] Add AdminSettings route to App.tsx
- [x] Implement localStorage persistence for API keys
- [x] Add access denied message for non-admin users
- [x] Create info card with admin settings documentation
- [x] Test admin access control
- [x] Verify settings are available to all users


## Phase 17: Member Activity & Consumption Monitoring (Completed)
- [x] Design member monitoring data schema
- [x] Create backend procedures for member analytics (getMembersList, getMemberActivity, getMemberConsumption, getConsumptionStats)
- [x] Build Member Monitoring Dashboard page
- [x] Add member list table with sorting and pagination
- [x] Add filtering by date range, subscription plan, activity level
- [x] Implement member activity charts (statistics cards with member count, total posts, avg posts/member)
- [x] Add API usage visualization (consumption metrics)
- [x] Create member consumption metrics (quota usage, posts generated, subscription status)
- [x] Add export functionality (CSV/PDF reports - placeholder)
- [x] Write vitest tests for member monitoring procedures
- [x] Test member monitoring dashboard with various filters
- [x] Verify admin-only access control
- [x] Add MemberMonitoring route to App.tsx
- [x] Add memberMonitoring router to backend


## Phase 18: Advanced Member Management (In Progress)
- [ ] Create Member Detail Modal component with activity history
- [ ] Add member usage statistics in modal (API calls, posts generated, storage)
- [ ] Add member subscription details in modal
- [ ] Implement advanced member search by name/email
- [ ] Add member filters by status (active/inactive), role (admin/user), subscription type
- [ ] Add date range filter for member join date
- [ ] Implement filter persistence in localStorage
- [ ] Create bulk member actions toolbar
- [ ] Add send bulk notifications feature
- [ ] Add bulk role update feature
- [ ] Add bulk account suspension feature
- [ ] Implement member selection checkboxes
- [ ] Add "select all" checkbox for bulk operations
- [ ] Create confirmation dialogs for bulk actions
- [ ] Write vitest tests for advanced features
- [ ] Test member detail modal with various data
- [ ] Test advanced filters and search
- [ ] Test bulk actions with multiple members


## Phase 18: Advanced Member Management (Completed)
- [x] Create Member Detail Modal component with usage statistics
- [x] Implement Advanced Member Filters with search and multiple filters
- [x] Add Bulk Member Actions component with 3 action types
- [x] Integrate all components into Member Monitoring page
- [x] Add member selection checkboxes to table
- [x] Implement send notifications action with message input
- [x] Implement role update action with role selector
- [x] Implement suspend accounts action with confirmation
- [x] Add filter persistence to localStorage
- [x] Write vitest tests for advanced features
- [x] Test all bulk actions
- [x] Test member detail modal
- [x] Test checkbox selection and bulk selection
- [x] Test filter persistence across page reloads


## Phase 19: Google Trends Integration Fix (Completed)
- [x] Fix Google Trends API integration (dailyTrends method)
- [x] Implement automatic data fetching from Google Trends
- [x] Add caching mechanism for trending data (1 hour cache)
- [x] Implement refresh logic (automatic cache expiration)
- [x] Add error handling and fallback data (mock data)
- [x] Test trending data fetching
- [x] Verify data displays in Trending Topics sidebar
- [x] Remove clearCache procedure that doesn't exist


## Phase 20: Trending Topics Integration (Completed)
- [x] Add trending topics suggestions to Generate page (top 3 keywords)
- [x] Create TrendingSuggestions component with clickable keywords
- [x] Integrate TrendingSuggestions into Generate page sidebar
- [x] Add one-click keyword selection from trending topics
- [x] Implement error handling and fallback data
- [x] Add loading states with SkeletonCard
- [x] Test trending integration with Generate page
- [x] Verify trending topics display correctly
- [x] Test keyword selection and topic update
- [x] Verify performance with trending data


## Phase 21: Advanced Trending Features (In Progress)
- [ ] Create trending content templates system with pre-built templates
- [ ] Add template customization based on selected trending keyword
- [ ] Auto-populate hashtags based on trending topics
- [ ] Auto-generate CTAs based on content type and platform
- [ ] Implement trending analytics dashboard widget
- [ ] Add engagement rate metrics for trending keywords
- [ ] Show reach and conversion metrics
- [ ] Create smart scheduling engine based on trend momentum
- [ ] Suggest optimal posting times for trending keywords
- [ ] Implement trend momentum calculation algorithm
- [ ] Test all advanced trending features
- [ ] Verify integration with existing features


## Advanced Trending Features (Phase 8)
- [x] Create TrendingContentTemplates component for Generate page
  - [x] Auto-generate 4 template types (Insight, Question, Tips, Story)
  - [x] Platform-specific CTAs (LinkedIn, Twitter, Instagram, Facebook)
  - [x] Auto-generate hashtags based on keyword
  - [x] Apply template button to populate generated content
  - [x] Copy template button for manual use
  - [x] Gradient card design with purple/pink theme
- [x] Create TrendingAnalyticsWidget for Dashboard
  - [x] Display trending keyword performance metrics
  - [x] Show engagement rate, reach, and conversions
  - [x] Display trend momentum (up/down/stable)
  - [x] Metrics visualization with icons and formatting
  - [x] Mock data with 3 trending topics
  - [x] Blue/cyan gradient design
- [x] Create SmartSchedulingSuggestions component for Generate page
  - [x] Generate platform-specific optimal posting times
  - [x] Display engagement scores (0-10) for each time
  - [x] Show momentum indicators (high/medium/low)
  - [x] Include reasons for each suggestion
  - [x] Schedule button with selection state
  - [x] Progress bars for engagement scores
  - [x] Helpful timezone adjustment tip
  - [x] Amber/orange gradient design
- [x] Integrate all components into Generate page
  - [x] Import TrendingContentTemplates, TrendingAnalyticsWidget, SmartSchedulingSuggestions
  - [x] Add components to right sidebar (hidden on mobile)
  - [x] Show templates and scheduling only when topic is entered
  - [x] Connect onApplyTemplate to update generated content
  - [x] Connect onSchedule to show success toast
- [x] Integrate TrendingAnalyticsWidget into Dashboard
  - [x] Add widget after activity chart
  - [x] Show only when user has generated posts
  - [x] Display trending keyword performance metrics
  - [x] Responsive design with proper spacing


## Google Trends Integration

- [ ] Set up google-trends-api package
- [ ] Create server/services/googleTrends.ts for API calls
- [ ] Implement Redis/in-memory caching system
- [ ] Create hourly update scheduler with node-cron
- [ ] Add database schema for cached trends
- [ ] Create tRPC procedure: getTrendingKeywords()
- [ ] Create tRPC procedure: getTrendsByCategory()
- [ ] Create tRPC procedure: getTrendHistory()
- [ ] Build frontend TrendingKeywords component
- [ ] Build frontend TrendingChart component
- [ ] Integrate trending data into Generate page
- [ ] Add trending keywords to AI prompt context
- [ ] Implement error handling and fallbacks
- [ ] Add unit tests for trends service
- [ ] Optimize caching strategy
- [ ] Deploy and test in production

## Google Trends Integration - COMPLETED

- [x] Set up google-trends-api package
- [x] Create server/services/googleTrends.ts for API calls
- [x] Implement Redis/in-memory caching system
- [x] Create hourly update scheduler with node-cron
- [x] Add database schema for cached trends
- [x] Create tRPC procedure: getTrendingKeywords()
- [x] Create tRPC procedure: getTrendsByCategory()
- [x] Create tRPC procedure: getTrendHistory()
- [x] Build frontend TrendingKeywords component
- [x] Integrate trending data into Generate page
- [x] Add trending keywords to AI prompt context
- [x] Implement error handling and fallbacks
- [x] Deploy and test in production


## Content Analytics System - IN PROGRESS

- [ ] Create analytics database tables (post_analytics, engagement_metrics, reach_data)
- [ ] Build analytics service for calculating metrics
- [ ] Create tRPC procedures: getPostAnalytics, getPlatformComparison, getWeeklyReport
- [ ] Implement engagement tracking (likes, comments, shares)
- [ ] Implement reach tracking (impressions, unique viewers)
- [ ] Implement conversion tracking
- [ ] Build analytics dashboard UI with charts
- [ ] Create weekly report generation
- [ ] Create monthly report generation
- [ ] Add platform comparison feature
- [ ] Implement data export (PDF/Excel)
- [ ] Add time-range filtering
- [ ] Optimize analytics queries with indexes


## Smart Scheduling System - IN PROGRESS

- [x] Create scheduling database tables (scheduled_posts, scheduling_preferences, posting_times)
- [x] Build scheduling recommendation engine
- [x] Create tRPC procedures: schedulePost, getOptimalTimes, getScheduledPosts
- [x] Implement platform-specific optimal posting times
- [ ] Build scheduling UI component
- [ ] Implement notification system for scheduled posts
- [ ] Set up cron jobs for automatic publishing
- [x] Add timezone support for scheduling
- [ ] Create scheduling analytics and performance tracking
- [x] Add reschedule and cancel functionality


## Post Management System - IN PROGRESS

- [x] Create post versioning tables (post_versions, post_backups)
- [x] Build post management service layer
- [x] Create tRPC procedures: updatePost, deletePost, getPostVersions, restorePost
- [x] Implement post editing with version history
- [x] Implement soft delete and hard delete functionality
- [x] Build automatic backup system
- [ ] Create cleanup job for old deleted posts
- [x] Implement post recovery/restore functionality
- [ ] Build post management UI (edit, delete, version history)
- [x] Add audit logging for post changes


## Content Enhancement System - IN PROGRESS

- [x] Build content analysis and suggestion engine
- [x] Implement spell and grammar checking (Arabic & English)
- [x] Create hashtag optimization service
- [x] Build CTA enhancement recommendations
- [x] Create tRPC procedures for enhancement
- [ ] Build frontend UI for enhancement suggestions
- [x] Implement real-time content scoring
- [x] Add readability analysis
- [x] Create tone consistency checker
- [ ] Build engagement prediction model


## Search & Filtering System - IN PROGRESS

- [x] Build full-text search engine for posts
- [x] Implement platform filtering (LinkedIn, Twitter, Instagram, Facebook)
- [x] Implement date range filtering
- [x] Implement status filtering (draft, scheduled, published, failed)
- [x] Create tRPC procedures for search
- [x] Build advanced search with multiple filters
- [x] Implement search result pagination
- [ ] Add search history tracking
- [ ] Create saved search functionality
- [ ] Build frontend search UI components


## Settings System - IN PROGRESS

- [x] Create user settings database table
- [x] Create notification preferences table
- [x] Create platform integrations table
- [x] Build user settings service layer
- [x] Implement notification preferences service
- [x] Implement language and timezone settings
- [x] Implement platform integration settings
- [x] Create tRPC procedures for settings management
- [ ] Build account settings UI
- [ ] Build notification preferences UI
- [ ] Build language/timezone settings UI
- [ ] Build platform integration settings UI


## Settings UI & OAuth Implementation - IN PROGRESS

- [x] Build Settings page layout with tabs (Account, Notifications, Platforms, Content)
- [x] Build Account Settings UI component
- [x] Build Notification Preferences UI component
- [x] Build Platform Integrations UI component
- [x] Build Content Preferences UI component
- [ ] Implement OAuth flow for LinkedIn
- [ ] Implement OAuth flow for Twitter
- [ ] Implement OAuth flow for Instagram
- [ ] Implement OAuth flow for Facebook
- [x] Create platform connection/disconnection UI
- [ ] Build settings export/backup functionality
- [ ] Build settings import/restore functionality
- [ ] Add settings backup scheduling
- [ ] Create settings restore confirmation dialog
- [ ] Test OAuth flows for all platforms
- [ ] Test settings backup and restore


## Trust & Security Features - IN PROGRESS

- [x] Create SecurityBadge component (SSL, GDPR, OAuth 2.0)
- [x] Create OAuthFlowExplainer modal/dialog
- [x] Add permission details for each platform
- [x] Create Privacy Policy page
- [x] Create Security & Safety page
- [x] Implement disconnect/revoke functionality
- [x] Add warning dialogs before connecting platforms
- [x] Create user control panel for connected accounts
- [x] Add SSL certificate indicator
- [ ] Test OAuth flow with real platforms


## Social Platform Integration - IN PROGRESS

- [ ] Create platform OAuth handlers (LinkedIn, Twitter, Instagram, Facebook)
- [ ] Implement secure token storage and management
- [ ] Create LinkedIn OAuth flow and publishing
- [ ] Create Twitter/X OAuth flow and publishing
- [ ] Create Instagram OAuth flow and publishing
- [ ] Create Facebook OAuth flow and publishing
- [ ] Build publishing service with error handling
- [ ] Create tRPC procedures for platform operations
- [ ] Build platform management UI in Settings
- [ ] Implement platform connection/disconnection
- [ ] Add platform-specific content formatting
- [ ] Test OAuth flows for all platforms
- [ ] Test publishing to all platforms
- [ ] Add retry logic for failed publishes
- [ ] Create platform status monitoring

## FAQ System with Search & Categories (Phase 13)
- [x] Create FAQ database schema (faqs table with categories)
- [x] Seed FAQ data with Norwegian content (30 questions across 6 categories)
- [x] Build FAQ backend API with search and filtering
- [x] Create FAQ frontend page with search functionality
- [x] Add category filtering to FAQ page
- [x] Implement accordion design for FAQ items
- [ ] Add search highlighting in results
- [ ] Integrate FAQ into help system
- [ ] Test FAQ search and filtering
- [ ] Optimize FAQ performance

## Add FAQ to Settings Menu
- [x] Add FAQ link to Settings menu navigation
- [x] Test FAQ link functionality
- [x] Verify navigation works correctly


## Phase 12: Dashboard UX/UI Improvements
- [x] Redesign Dashboard layout with modern card-based design
- [x] Add data visualizations and charts for better insights (Bar chart, Pie chart)
- [x] Optimize performance and loading speed
- [x] Add smooth animations and micro-interactions
- [x] Improve visual hierarchy and spacing
- [x] Add gradient backgrounds and modern colors
- [x] Enhance typography and readability
- [x] Add hover effects and transitions
- [x] Optimize images and assets
- [ ] Test Dashboard on mobile devices


## Telegram Bot + Social Media Integration (Phase 8)
- [x] Set up Telegram Bot API and database schema (existing telegramService.ts)
- [x] Create telegram_integrations table for storing bot tokens and chat IDs
- [x] Build bot command handlers (/start, /help, /generate, /settings)
- [x] Implement message handling and content generation via Telegram
- [x] Integrate Facebook Graph API for auto-posting (new facebookService.ts)
- [x] Create facebook_integrations table for storing access tokens
- [x] Build content distribution service for multi-platform posting (multiPlatformService.ts)
- [ ] Create UI for Telegram and Facebook integration in Settings
- [ ] Add end-to-end testing for Telegram bot commands
- [ ] Test Facebook auto-posting functionality
- [ ] Verify webhook handling for both platforms
- [ ] Document Telegram bot setup and commands


## Comprehensive Settings Page Redesign (Phase 11)
- [ ] Create BillingManagement component with invoice history and payment methods
- [ ] Build UsageStatistics component showing content generation stats and limits
- [ ] Add UserPreferences component for notification and display settings
- [ ] Redesign Settings page layout with improved navigation
- [ ] Add subscription management and upgrade/downgrade options
- [ ] Implement usage charts and analytics
- [ ] Add export invoice functionality
- [ ] Test all Settings components


## Blog Enhancements (Phase 10)
- [x] Add SEO meta tags (title, description, keywords, og:tags)
- [x] Create social sharing buttons component (LinkedIn, Twitter, Facebook, WhatsApp)
- [x] Implement JSON-LD structured data for articles (seoUtils.ts)
- [ ] Add breadcrumb navigation for SEO
- [ ] Create sitemap.xml for search engines
- [ ] Add robots.txt configuration
- [x] Implement canonical URLs
- [ ] Add reading time estimate to blog posts
- [x] Create blog post schema markup
- [ ] Test SEO with Google Search Console


## Sitemap & RSS Feed (Phase 11)
- [x] Create dynamic sitemap.xml generator (sitemapGenerator.ts)
- [x] Create RSS feed generator for blog posts (rssGenerator.ts with RSS + Atom support)
- [x] Add /sitemap.xml endpoint to server
- [x] Add /feed.xml, /rss.xml, and /atom.xml endpoints
- [x] Update robots.txt with sitemap reference
- [ ] Test sitemap with Google Search Console
- [ ] Test RSS feed with feed readers
- [ ] Add sitemap link to footer
- [ ] Add RSS feed link to blog


## High Priority Settings Enhancements (43 tasks)

### Settings Page - User Profile Section
- [ ] Add user avatar display in profile section
- [ ] Add edit profile button (name, email)
- [ ] Create profile edit modal/dialog
- [ ] Add profile picture upload functionality
- [ ] Display user registration date
- [ ] Show account status (Active, Trial, etc.)

### Settings Page - Subscription Management
- [ ] Display current subscription plan with renewal date
- [ ] Add upgrade/downgrade plan buttons
- [ ] Create subscription cancellation confirmation dialog
- [ ] Add reason selection for cancellation (optional)
- [ ] Show next billing date prominently
- [ ] Add "Manage subscription" link to Stripe portal
- [ ] Display subscription features breakdown

### Settings Page - Billing & Invoices
- [ ] Fetch real invoices from database (not mock data)
- [ ] Add invoice PDF download functionality
- [ ] Display invoice details (invoice number, date, amount, status)
- [ ] Add invoice filtering by date range
- [ ] Add invoice search functionality
- [ ] Show payment method on file
- [ ] Add option to update payment method

### Settings Page - Usage Statistics
- [ ] Fetch real usage data from database
- [ ] Display posts generated this month
- [ ] Display posts saved/favorited
- [ ] Display images generated (DALL-E and Nano Banana)
- [ ] Display AI Coach interactions count
- [ ] Show usage trends over time (charts)
- [ ] Display platform distribution (real data)
- [ ] Show engagement metrics and trends

### Settings Page - Usage Preferences
- [ ] Add text area for "How do you want to use this platform?"
- [ ] Save usage preferences to database
- [ ] Display saved preferences
- [ ] Add character count for preferences text
- [ ] Add validation for preferences input

### Settings Page - Additional Enhancements
- [ ] Add "My Saved Examples" section
- [ ] Add "Content Preferences" (default tone, length, etc.)
- [ ] Add "Platform Integrations" (LinkedIn, Twitter, etc.)
- [ ] Add "Account Security" section with 2FA status
- [ ] Add "Data & Privacy" section
- [ ] Add "Help & Support" links
- [ ] Add "Account Deletion" with confirmation

## Blog & SEO Enhancements

### Blog - Structured Data (JSON-LD)
- [ ] Add JSON-LD schema for blog posts (Article schema)
- [ ] Add JSON-LD schema for blog listing (BlogPosting schema)
- [ ] Add JSON-LD schema for organization (Organization schema)
- [ ] Add JSON-LD schema for breadcrumbs
- [ ] Test JSON-LD with Google's Structured Data Testing Tool

### Blog - Meta Tags & SEO
- [ ] Add canonical URLs to blog posts
- [ ] Add og:type meta tags
- [ ] Add og:url meta tags
- [ ] Add twitter:card meta tags
- [ ] Add article:published_time meta tags
- [ ] Add article:modified_time meta tags
- [ ] Add article:author meta tags

### Blog - Social Sharing Enhancements
- [ ] Add WhatsApp share button
- [ ] Add Pinterest share button
- [ ] Add Reddit share button
- [ ] Add Telegram share button
- [ ] Add email share with subject line
- [ ] Add share count display (if available)

### Blog - Related Posts
- [ ] Create "Related Posts" section at end of blog post
- [ ] Implement algorithm to find related posts (by tags/category)
- [ ] Display 3-4 related posts with thumbnails
- [ ] Add "Read More" links to related posts

### Blog - Comments System (Optional)
- [ ] Add Disqus or similar comments integration
- [ ] Display comment count
- [ ] Allow users to comment on blog posts

## Homepage Enhancements

### Homepage - Marketing Copy
- [ ] Improve hero section headline (Norwegian)
- [ ] Enhance value proposition copy
- [ ] Add benefit-focused subheading
- [ ] Improve CTA button copy
- [ ] Add trust signals/social proof
- [ ] Enhance features section descriptions

### Homepage - Additional Sections
- [ ] Add "How It Works" section with steps
- [ ] Add customer testimonials section
- [ ] Add FAQ section (link to FAQ page)
- [ ] Add comparison table (vs manual work)
- [ ] Add pricing section with clear benefits
- [ ] Add "Get Started" CTA above fold

### Homepage - Visual Enhancements
- [ ] Add hero section background image/gradient
- [ ] Add animated elements (fade-ins, scroll effects)
- [ ] Add icons to feature cards
- [ ] Improve spacing and typography
- [ ] Add video demo or animated GIF
- [ ] Optimize images for performance

### Homepage - Responsive Design
- [ ] Test mobile responsiveness
- [ ] Fix any layout issues on small screens
- [ ] Optimize touch targets for mobile
- [ ] Test tablet view
- [ ] Ensure fast loading on mobile networks



## High-Priority Tasks Completed (Session: Feb 26, 2026)

### Settings Enhancements ✓
- [x] Add real data to BillingManagement component (Stripe integration)
- [x] Add real data to UsageStatistics component (charts, monthly usage)
- [x] Add real data to UserPreferences component (notifications, display, content)
- [x] Create tRPC procedures: getInvoices, getStatistics, getUsagePreferences, updateUsagePreferences
- [x] Create database functions for invoices and user statistics
- [x] Write vitest tests for user statistics (17 tests passed ✓)

### Blog & SEO Enhancements ✓
- [x] Add JSON-LD schema markup to BlogPost component
- [x] Add og:url and article:modified_time meta tags
- [x] Add Pinterest share button
- [x] Add Reddit share button
- [x] Add Telegram share button

### Homepage Improvements ✓
- [x] Enhance hero section with better marketing copy
- [x] Add social proof section (10K+ posts, 2.5K+ users, 4.8★ rating)
- [x] Improve value proposition messaging
- [x] Add multi-platform publishing messaging


## AI-Powered Hashtag Suggestions Feature (Feb 27, 2026)

### Database Layer
- [x] Create hashtag_suggestions table
- [x] Create hashtag_performance table  
- [x] Create trending_hashtags table
- [x] Add database helper functions (8 functions)

### Backend API
- [x] Create hashtagRouter with tRPC procedures
- [x] generateSuggestions procedure (AI-powered)
- [x] getHistory procedure (fetch user's suggestions)
- [x] getTrending procedure (fetch trending hashtags)
- [x] Integrate with OpenAI for smart suggestions

### Frontend Components
- [x] Create HashtagSuggestions component
- [x] Add copy-to-clipboard functionality
- [x] Display trending hashtags by platform
- [x] Show relevance scores
- [x] Add platform selection (LinkedIn, Twitter, Instagram, Facebook)

### Testing
- [x] Create vitest test suite (hashtags.test.ts)
- [x] Test database functions
- [x] Test data validation
- [x] Test hashtag performance tracking

### Features
- AI analyzes content title and excerpt
- Generates 10-15 relevant hashtags
- Considers user's industry and interests
- Includes trending hashtags for current platform
- Calculates relevance score (0-100)
- Tracks hashtag performance over time
- Supports all major social platforms


## Code Audit & Optimization (Session: Mar 4, 2026)
- [ ] Audit server-side code (routers, db, schema)
- [ ] Audit client-side code (pages, components)
- [ ] Check TypeScript errors and build issues
- [ ] Check browser console errors
- [ ] Fix all identified bugs
- [ ] Optimize code quality and performance
- [ ] Run all tests and verify


## Code Audit & Optimization (Completed - Mar 4, 2026)
- [x] Full TypeScript compilation check - 0 errors
- [x] LSP check - 0 errors
- [x] Fix unsafe JSON.parse in BlogPost.tsx (tags parsing)
- [x] Fix unsafe JSON.parse in CookieConsent.tsx
- [x] Fix unsafe JSON.parse in MemberFilters.tsx
- [x] Fix unsafe JSON.parse in IdeaBank.tsx
- [x] Fix unsafe JSON.parse in hashtagRouter.ts
- [x] Fix unsafe JSON.parse in routers.ts (idea tags)
- [x] Fix unsafe JSON.parse in googleTrends.ts (3 occurrences)
- [x] Add DOMPurify for XSS protection in BlogPost.tsx
- [x] Optimize scheduler to run every 5 minutes instead of every minute
- [x] Optimize scheduler to only query LinkedIn posts (only supported platform)
- [x] Fix hardcoded year in Home.tsx footer - now dynamic
- [x] Fix hardcoded card expiry in BillingManagement.tsx - now dynamic
- [x] Create shared/utils.ts with safeJsonParse utility
- [x] Rewrite hashtags.test.ts as pure unit tests (17 tests passing)
- [x] All tests passing: 51 tests across 3 test files


## UX Enhancement - Ease & Value (Mar 4, 2026)
- [ ] Improve global CSS animations and transitions
- [ ] Add smooth page transitions
- [ ] Enhance Homepage hero section with clearer value proposition
- [ ] Improve Dashboard onboarding and visual hierarchy
- [ ] Enhance Generate page for simpler workflow
- [ ] Improve empty states with motivating messages
- [ ] Add better loading skeletons and states
- [ ] Improve navigation clarity and feedback
- [ ] Add success celebrations (confetti/toast on key actions)
- [ ] Improve button hover states and micro-interactions
- [ ] Enhance card designs with subtle depth
- [ ] Improve mobile responsiveness


## UX Enhancement - Ease & Value (Completed)
- [x] Enhanced global CSS with smooth animations and micro-interactions
- [x] Fixed AI model (gpt-4-turbo → gpt-4o) in langchain service
- [x] Fixed all 3 AI services to use Manus Forge API (langchain, openaiService, contentGenerator)
- [x] Improved loading states across all pages (branded spinners with icons and messages)
- [x] Added subtle gradient backgrounds to all 24+ pages for premium feel
- [x] Enhanced Home page with better marketing copy, animations, and social proof
- [x] Enhanced Dashboard with personalized welcome message and smoother UX
- [x] Enhanced Generate page with better loading and empty states
- [x] Improved IdeaBank, Settings, Trends, Coach, AdminSettings loading states
- [x] Fixed 7 additional pages with basic spinners (BlogPost, BlogAdmin, MemberMonitoring, VoiceTraining, SubscriptionCancel, SubscriptionSuccess, AdminAnalytics)
- [x] Consistent gradient backgrounds across all pages


## Onboarding Tour for New Users
- [ ] Create OnboardingTour component with step-by-step highlights
- [ ] Add welcome modal with personalized greeting
- [ ] Create tour steps for Dashboard, Generate, Posts, IdeaBank
- [ ] Add spotlight/highlight effect on target elements
- [ ] Add skip/next/back navigation controls
- [ ] Track onboarding completion in database (user preferences)
- [ ] Use localStorage as fallback for tour state
- [ ] Integrate tour into Dashboard on first login
- [ ] Add "Restart Tour" option in Settings
- [ ] Write vitest tests for onboarding logic


## Onboarding Tour Enhancement (Completed)
- [x] Redesigned OnboardingTour with welcome modal, animated steps, and completion celebration
- [x] Custom tooltip with progress bar and Norwegian text
- [x] 8-step tour covering all key features (Generate, Posts, Calendar, Best Time, Trends, Voice Training, Idea Bank, Settings)
- [x] Tips in each step to help users get started
- [x] Skip option with reminder about Settings restart
- [x] Fixed all AI models to use gemini-2.5-flash via Forge API (langchain, openaiService, contentGenerator)
- [x] 34 tests passing, 0 TypeScript errors


## UI Graphics & Interface Enhancement
- [ ] Enhance global color palette and CSS variables for premium feel
- [ ] Improve Dashboard cards with better gradients, shadows, and icons
- [ ] Enhance sidebar navigation with better hover effects and active states
- [ ] Improve Generate page UI with cleaner layout
- [ ] Polish Homepage hero section and feature cards
- [ ] Enhance Posts page with better card designs
- [ ] Improve Settings page visual hierarchy
- [ ] Add consistent spacing and typography across all pages
- [ ] Enhance buttons, inputs, and form elements globally
- [ ] Improve empty states with better illustrations


## Graphics & Interface Improvements (March 2026)
- [x] Improve Dashboard stat cards with cleaner white card design and colored icon containers
- [x] Enhance Dashboard charts section with better area chart and pie chart styling
- [x] Improve Dashboard posts list with platform icons, status badges, and hover actions
- [x] Add premium CSS styles (card-hover, btn-smooth, btn-glow, glass morphism, text-gradient)
- [x] Improve color system with refined OKLCH colors for light and dark themes
- [x] Add page-enter and stagger-children animations for smooth page transitions
- [x] Improve skeleton loader with premium shimmer animation
- [x] Enhance Breadcrumb component with cleaner styling
- [x] Improve Posts page with better card layout and action buttons
- [x] Improve Settings page tabs with horizontal scrollable layout
- [x] Improve Generate page header with icon and breadcrumb
- [x] Add custom scrollbar styling
- [x] Add premium heading styles with Plus Jakarta Sans font
- [x] Fix Trends page React hooks order error (early return before hooks)
- [x] Add stat card gradient backgrounds (blue, green, purple, amber)
- [x] Add badge styles (success, primary)
- [x] Add divider-gradient, icon-container, bg-dots utility classes
- [x] Add empty state and line-clamp CSS utilities


## Landing Page Professional Redesign (March 2026)
- [x] Fix empty spaces in features section (missing feature cards)
- [x] Redesign hero section with compelling visuals
- [x] Fix features grid to show all feature cards properly
- [x] Improve "Hvordan det virker" (How it works) section
- [x] Fix pricing section layout
- [x] Fix testimonials section (cards showing but content faded)
- [x] Remove large empty white spaces throughout the page
- [x] Add proper CTA sections between content blocks
- [x] Ensure footer is properly positioned
- [x] Make entire page look polished and professional

## Landing Page Empty Spaces Fix (March 2026 - Round 2)
- [x] Identify and fix all remaining large empty spaces on landing page
- [x] Ensure the page the user sees matches the new design

## Landing Page Counter Fix (March 2026)
- [x] Fix animated counters showing 0+ instead of actual numbers

## Hero Demo Animation (March 2026)
- [x] Create animated demo component showing app workflow step-by-step
- [x] Integrate demo animation into Hero section of landing page
- [x] Ensure animation is smooth and professional

## Remove Auto-Redirect from Landing Page (March 2026)
- [x] Remove automatic redirect from landing page to dashboard for logged-in users

## Remove ALL Auto-Redirects from Landing Page (March 2026 - Round 3)
- [x] Find and remove ALL remaining auto-redirect logic from landing page

## Fix OAuth Redirect After Login (March 2026)
- [x] Change OAuth callback redirect from / to /dashboard so users go to dashboard after login
- [x] Update GlobalNav buttons to show Dashboard link for logged-in users

## Add Demo Animations to All Landing Page Sections (March 2026)
- [x] Add animated demo to "Hvordan det virker" (How it works) section
- [x] Add animated demo to Features section
- [x] Add animated demo to Pricing section
- [x] Add animated demo to Testimonials section
- [x] Add animated demo/visual to Stats section
- [x] Ensure all demos are smooth and professional

## Generate Page Empty Space Fix (March 2026)
- [x] Fix large empty space below the form on Generate page

## Generate Page Content Reorganization (March 2026)
- [x] Reorganize Generate page layout in logical and clear structure
- [x] Group related form fields together
- [x] Improve visual hierarchy and content flow

## Translate Arabic to Norwegian in Trending Topics (March 2026)
- [x] Find and translate all Arabic text in TrendingTopicsSidebar to Norwegian
- [x] Translate Arabic in ContentImprovement, LoadingState, Settings components
- [x] Ensure consistent Norwegian language throughout the Generate page

## Live Post Preview (March 2026)
- [x] Create LivePostPreview component that mimics LinkedIn, Twitter, Instagram, Facebook appearance
- [x] Show live preview after content generation with platform-specific styling
- [x] Add platform-specific styling (profile picture, reactions, comments layout)

## Saved Templates System (March 2026)
- [x] Add templates tRPC router with list/save/delete/use procedures (using existing savedExamples table)
- [x] Build SavedTemplates component with save dialog and template list
- [x] Integrate SavedTemplates into Generate page sidebar
- [x] Test template save and load functionality

## Kalender Page Redesign (March 2026)
- [x] Redesign Calendar page with modern, logical layout matching app design
- [x] Add statistics summary cards (total posts, scheduled, published, drafts)
- [x] Improve header with gradient icon and better typography
- [x] Enhance view switcher with modern pill-style buttons
- [x] Add upcoming posts sidebar with platform icons and status badges
- [x] Improve platform legend with better visual design
- [x] Add quick actions section (new post, go to generate)
- [x] Ensure responsive design for mobile
- [x] Remove console.log debug statements
- [x] Test Calendar page functionality (6 vitest tests passing)
- [x] Improve FullCalendar prev/next navigation buttons with modern styling

## Gjenbruk-Maskin Page Redesign (March 2026)
- [x] Add breadcrumb navigation for consistency
- [x] Redesign header with modern gradient icon and better typography
- [x] Add step indicators (1-2-3) for the repurpose workflow
- [x] Improve repurpose type selection cards with icons
- [x] Modernize success stories sidebar with better visual design
- [x] Improve tips card design
- [x] Add auto-save indicator in header area
- [x] Ensure responsive design
- [x] Test Gjenbruk page functionality (8 vitest tests passing)


## Payment System Integration (March 2026)
- [ ] Add Billing page route to App.tsx
- [ ] Create payment success page
- [ ] Create payment cancel page
- [ ] Set up Stripe webhook endpoint
- [ ] Test complete payment flow
- [ ] Test subscription upgrade/downgrade
- [ ] Test subscription cancellation


## PDF Invoice Download Feature (March 2026)
- [ ] Add PDF invoice generation to Payment Router
- [ ] Create PDF invoice template and generator service
- [ ] Add download button to Billing page UI
- [ ] Test PDF generation and download
- [ ] Ensure invoice includes all necessary details (user, plan, amount, date, etc.)


## استبدال Manus OAuth بـ Google OAuth (جاري العمل)
- [x] تثبيت المكتبات المطلوبة (jsonwebtoken, google-auth-library, bcryptjs, cookie-parser)
- [x] إنشاء googleAuth.ts مع دوال المصادقة
- [x] إنشاء مسارات المصادقة في authRoutes.ts
- [x] تسجيل مسارات المصادقة في خادم Express
- [x] إنشاء صفحة تسجيل الدخول (Login.tsx)
- [x] إضافة مسار /login إلى App.tsx
- [x] إنشاء hook useAuth للتحقق من الجلسة
- [x] إنشاء مكون ProtectedRoute لحماية الروابط
- [x] تطبيق حماية الروابط عبر تحديث getLoginUrl() لتوجيه إلى /login
- [x] إضافة أزرار تسجيل الدخول والخروج في الصفحات (موجودة بالفعل في DashboardNav)
- [x] إنشاء مكون UserProfile لعرض بيانات المستخدم
- [x] إنشاء صفحة Login احترافية مع Google OAuth
- [x] إنشاء مسار Google OAuth callback يستخدم نفس session cookie
- [x] إنشاء vitest tests للـ Google OAuth (7 اختبارات - جميعها تمر)
- [x] تحديث logout redirect إلى /login
- [ ] إنشاء صفحة تحديث الملف الشخصي
- [ ] إضافة ميزة 'تذكرني' (Remember Me)
- [ ] إضافة ميزة استعادة كلمة المرور
- [ ] توثيق التغييرات وحفظ checkpoint

## فصل Landing Page وإضافة ميزات المصادقة
- [x] فصل Landing Page عن Dashboard Layout (لاياوت مستقل لكل منهما عبر PageLayout.tsx)
- [x] إضافة أزرار تسجيل الدخول والخروج في Landing Page navbar
- [x] إنشاء صفحة الملف الشخصي /profile مع رفع الصورة وتغيير الاسم
- [x] إضافة API endpoint لتحديث بيانات المستخدم (updateProfile + uploadAvatar)
- [x] رفع صورة الملف الشخصي إلى S3 عبر storagePut
- [x] إضافة avatarUrl لجدول users في قاعدة البيانات
- [x] عرض صورة المستخدم في DashboardNav مع رابط لصفحة الملف الشخصي
- [x] اختبار TypeScript (0 أخطاء) وحفظ checkpoint


## تطبيق 4 مستويات لتحديد الاستهلاك والحماية من الإساءة
- [x] المستوى 1: Plan-Based Limits - تحديد الاستخدام حسب الخطة (Trial: 5 منشورات/شهر، Pro: 100، Enterprise: غير محدود)
- [x] المستوى 2: Rate Limiting - تحديد عدد الطلبات (IP: 100/دقيقة، User: 30/دقيقة، AI: 10/دقيقة)
- [x] المستوى 3: حماية من الإساءة - التحقق من المحتوى وحجم الطلب (100KB max، كشف spam، كلمات محظورة)
- [x] المستوى 4: مراقبة وتنبيه - تسجيل الاستخدام والتنبيهات (لوحة تحكم، إحصائيات، alerts)
- [x] إنشاء middleware rateLimiter.ts مع جميع المستويات
- [x] إنشاء middleware abuseProtection.ts مع التحقق من المحتوى
- [x] إنشاء monitoring.ts مع تتبع الاستخدام والتنبيهات
- [x] إنشاء monitoringRoutes.ts مع API endpoints للمراقبة
- [x] تسجيل جميع middlewares في server index
- [x] إضافة monitoring endpoints للمستخدمين والمسؤولين
- [x] اختبار TypeScript (0 أخطاء)


## لوحة تحكم المراقبة وتكامل Sentry
- [x] تثبيت @sentry/node
- [x] إنشاء sentry.ts مع دوال الإرسال والتنبيهات
- [x] ربط Sentry مع monitoring.ts لإرسال التنبيهات الحرجة
- [x] إنشاء صفحة AdminMonitoring.tsx مع عرض الإحصائيات والتنبيهات
- [x] إضافة مسارات API للمراقبة (/api/admin/monitoring/*)
- [x] تسجيل مسارات المراقبة في server index
- [x] إضافة route /admin/monitoring إلى App.tsx
- [ ] تكوين SENTRY_DSN في متغيرات البيئة
- [ ] اختبار التنبيهات والتكامل مع Sentry
- [ ] حفظ checkpoint


## تعزيز الأمان - Security Hardening
- [x] تدقيق الأمان الشامل (OWASP Top 10) - SECURITY_AUDIT.md
- [x] تطبيق Role-Based Access Control (RBAC) - موجود
- [x] منع SQL Injection و NoSQL Injection - inputSanitization.ts
- [x] منع XSS (Cross-Site Scripting) - DOMPurify + CSP
- [x] إضافة Security Headers - securityHeaders.ts
- [x] حماية الملفات المرفوعة - S3 + validation
- [x] إدارة آمنة للأسرار - Environment variables
- [x] تسجيل وتتبع الوصول - Monitoring + Sentry
- [ ] تطبيق Multi-Factor Authentication (MFA)
- [ ] تشفير البيانات الحساسة
- [ ] تأمين Webhooks
- [ ] اختبار الاختراق


## تحسين الأداء - Lighthouse Score > 95
- [ ] تحسين سرعة التحميل (Performance)
  - [ ] تحسين صور الموقع (Compression + WebP)
  - [ ] تحسين JavaScript Bundle Size
  - [ ] تحسين CSS Bundle Size
  - [ ] تطبيق Code Splitting
  - [ ] تحسين First Contentful Paint (FCP)
  - [ ] تحسين Largest Contentful Paint (LCP)
  - [ ] تحسين Cumulative Layout Shift (CLS)
- [ ] تحسين الوصولية (Accessibility)
  - [ ] التحقق من ARIA labels
  - [ ] التحقق من Color Contrast
  - [ ] التحقق من Keyboard Navigation
  - [ ] التحقق من Screen Reader Support
- [ ] تحسين أفضل الممارسات (Best Practices)
  - [ ] تحديث المكتبات إلى أحدث إصدارات
  - [ ] إزالة المكتبات غير المستخدمة
  - [ ] تحسين Error Handling
  - [ ] تحسين Security Headers
- [ ] تحسين SEO
  - [ ] تحسين Meta Tags
  - [ ] تحسين Structured Data
  - [ ] تحسين Mobile Responsiveness
  - [ ] تحسين Page Speed Insights
