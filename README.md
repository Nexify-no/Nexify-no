# 🚀 Innlegg - Din AI Innholdsassistent

**Professional AI-powered content generation platform for Norwegian creators and businesses**

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Node.js](https://img.shields.io/badge/node.js-22.13.0-green)
![React](https://img.shields.io/badge/react-19.2.1-61dafb)
![License](https://img.shields.io/badge/license-Proprietary-red)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [Database Setup](#database-setup)
- [Development](#development)
- [Testing](#testing)
- [Building for Production](#building-for-production)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Support](#support)

---

## 📖 Overview

Innlegg is an AI-powered content generation platform designed specifically for Norwegian creators, businesses, and marketers. The application leverages advanced language models to generate professional social media content, blog posts, and marketing materials in Norwegian language.

**Key Capabilities**:
- Generate AI-powered content in seconds
- Multi-platform support (LinkedIn, Twitter, Instagram, Facebook)
- Content scheduling and publishing
- Analytics and performance tracking
- Content repurposing and optimization
- Trend analysis and hashtag recommendations

---

## ✨ Features

### Core Features
- **AI Content Generation** - Generate professional content using OpenAI GPT models
- **Multi-Platform Support** - Publish to LinkedIn, Twitter, Instagram, and Facebook
- **Content Scheduling** - Schedule posts for optimal publishing times
- **Draft Management** - Save and manage content drafts
- **Content Versioning** - Track and restore previous versions
- **Analytics** - Track content performance and engagement

### Advanced Features
- **Content Repurposing** - Adapt content for different platforms
- **Trend Analysis** - Discover trending topics and hashtags
- **Bulk Operations** - Manage multiple posts efficiently
- **User Preferences** - Customize tone, style, and language
- **Subscription Management** - Flexible pricing plans
- **Payment Processing** - Secure Stripe integration

### Security Features
- **OAuth 2.0 Authentication** - Secure user authentication (Google OAuth + JWT session cookies)
- **Rate Limiting** - Protect against abuse
- **CORS Protection** - Cross-origin request security
- **SQL Injection Prevention** - Parameterized queries via Drizzle ORM
- **XSS Protection** - HTML sanitization with DOMPurify
- **Security Headers** - Helmet.js configuration

---

## 🚀 Quick Start

### For Development

```bash
# Clone the repository
git clone https://github.com/yourusername/innlegg.git
cd innlegg

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local

# Set up database
pnpm db:push

# Start development server
pnpm dev
```

Visit `http://localhost:3000` in your browser.

### For Production

```bash
# Build the application
pnpm build

# Start production server
pnpm start
```

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

| Requirement | Version | Purpose |
|-------------|---------|---------|
| **Node.js** | 18.0+ or 20.0+ or 22.0+ | JavaScript runtime |
| **pnpm** | 10.0+ | Package manager |
| **MySQL/TiDB** | 8.0+ | Database |
| **Git** | 2.0+ | Version control |

### System Requirements

- **Development**: 512 MB RAM, 1 CPU core, 2 GB disk space
- **Production**: 2 GB RAM, 2+ CPU cores, 50+ GB disk space

### Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Mobile 90+)

---

## 📦 Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/innlegg.git
cd innlegg
```

### Step 2: Install Dependencies

```bash
# Using pnpm (recommended)
pnpm install

# Or using npm
npm install

# Or using yarn
yarn install
```

### Step 3: Set Up Environment Variables

```bash
# Copy the example environment file
cp .env.example .env.local

# Edit the file with your configuration
nano .env.local
```

### Step 4: Set Up Database

```bash
# Generate and apply migrations
pnpm db:push

# Verify database connection
pnpm db:check
```

### Step 5: Start Development Server

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`.

---

## 🔧 Environment Setup

### Required Environment Variables

Create a `.env.local` file in the project root with the following variables:

```bash
# Core (required — server refuses to boot without these)
NODE_ENV=development
JWT_SECRET=your_jwt_secret_at_least_32_chars   # >=32 random chars — signs session cookies
DATABASE_URL=mysql://user:password@localhost:3306/innlegg
PUBLIC_SITE_URL=http://localhost:5000

# AI / LLM
OPENAI_API_KEY=sk-your-openai-api-key
# BUILT_IN_FORGE_API_URL=https://api.openai.com  # optional OpenAI-compatible proxy base
# BUILT_IN_FORGE_API_KEY=                         # optional — falls back to OPENAI_API_KEY
# HUGGINGFACE_API_KEY=hf_your_huggingface_token   # optional

# Security
TOKEN_ENCRYPTION_KEY=your_random_secret          # AES-256-GCM encryption of stored OAuth tokens

# Auth: Google OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Payment Processing (Stripe)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Rate limiting (recommended for production)
REDIS_URL=

# Analytics (optional)
VITE_GA4_ID=
VITE_ANALYTICS_WEBSITE_ID=
VITE_ANALYTICS_ENDPOINT=

# Client (build-time)
VITE_SITE_URL=http://localhost:5000

# Optional: Error Tracking
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Optional: AI models (defaults to gpt-4o-mini) & image provider (defaults to OpenAI/DALL·E)
CONTENT_MODEL=gpt-4o-mini
LLM_MODEL=gpt-4o-mini
IMAGE_PROVIDER=openai            # or "fal" (fal.ai FLUX) — then set IMAGE_MODEL + FAL_API_KEY

# Optional: Telegram Bot (if using Telegram integration)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# The full, authoritative list lives in .env.example
```

### Environment Variable Descriptions

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | MySQL/TiDB connection string |
| `JWT_SECRET` | ✅ | Secret key (≥32 chars) for session cookies |
| `PUBLIC_SITE_URL` | ✅ | Canonical site URL (OAuth/redirects/sitemap) |
| `OPENAI_API_KEY` | ✅ | OpenAI API key for content generation |
| `TOKEN_ENCRYPTION_KEY` | ✅ | Encrypts stored OAuth tokens at rest |
| `STRIPE_SECRET_KEY` | ✅ | Stripe secret key for payments |
| `GOOGLE_CLIENT_ID` | ❌ | Google OAuth client ID (optional) |
| `SENTRY_DSN` | ⚠️ | Sentry DSN for error tracking (recommended) |
| `CONTENT_MODEL` / `LLM_MODEL` | ❌ | Text models — quality tier / light tier (default `gpt-4o-mini`) |
| `IMAGE_PROVIDER` / `IMAGE_MODEL` / `FAL_API_KEY` | ❌ | Image provider: `openai` (DALL·E) or `fal` (FLUX) |
| `TELEGRAM_BOT_TOKEN` | ❌ | Telegram bot token (optional) |

### Getting API Keys

**Google OAuth** (optional):
1. Visit https://console.cloud.google.com/apis/credentials
2. Create an OAuth 2.0 Client ID
3. Copy the Client ID and Client Secret to `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`

**OpenAI**:
1. Visit https://platform.openai.com/api-keys
2. Create a new API key
3. Copy the key to `OPENAI_API_KEY`

**Stripe**:
1. Visit https://dashboard.stripe.com
2. Get test keys from Developers → API Keys
3. Copy Secret Key and Publishable Key

**Sentry**:
1. Visit https://sentry.io
2. Create a new project
3. Copy the DSN to `SENTRY_DSN`

---

## 🗄️ Database Setup

### Creating the Database

```bash
# Connect to MySQL
mysql -u root -p

# Create database
CREATE DATABASE innlegg CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'innlegg_user'@'localhost' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON innlegg.* TO 'innlegg_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Running Migrations

```bash
# 1) Generate a migration from schema.ts changes (offline)
pnpm db:generate          # drizzle-kit generate

# 2) Apply pending migrations (needs DATABASE_URL) — use this in prod/CI, as a
#    separate step (NEVER at app boot)
pnpm db:migrate           # drizzle-kit migrate

# Dev-only: push schema.ts straight to a local DB (skips migration history)
pnpm db:push              # drizzle-kit push — DO NOT use in production
```

> In Docker, migrations run via a dedicated one-shot `migrate` service; the app
> container only runs `node dist/index.js` and never alters the schema on start.
> Switching an existing push-built DB to `migrate` requires a one-time baseline
> (see `docs/PRODUCTION_READINESS_BACKLOG.md`).

### Database Schema

The application uses the following main tables:

- **users** - User accounts and authentication
- **posts** - Generated social media content
- **subscriptions** - User subscription plans
- **preferences** - User preferences and settings
- **analytics** - Performance metrics and analytics
- **onboarding_status** - User onboarding progress

### Backup and Recovery

```bash
# Create database backup
mysqldump -u innlegg_user -p innlegg > backup_$(date +%Y%m%d).sql

# Restore from backup
mysql -u innlegg_user -p innlegg < backup_20260507.sql
```

---

## 💻 Development

### Project Structure

```
innlegg/
├── client/                    # Frontend (React)
│   ├── src/
│   │   ├── pages/            # Page components
│   │   ├── components/       # Reusable components
│   │   ├── contexts/         # React contexts
│   │   ├── hooks/            # Custom hooks
│   │   ├── lib/              # Utilities and helpers
│   │   ├── App.tsx           # Main app component
│   │   └── main.tsx          # Entry point
│   ├── public/               # Static assets
│   └── index.html            # HTML template
├── server/                    # Backend (Express + tRPC)
│   ├── routers.ts            # tRPC route definitions
│   ├── db.ts                 # Database helpers
│   ├── _core/                # Core infrastructure
│   │   ├── index.ts          # Express server setup
│   │   ├── trpc.ts           # tRPC configuration
│   │   ├── context.ts        # tRPC context
│   │   └── auth.ts           # Authentication logic
│   └── routers/              # Feature routers
├── drizzle/                   # Database schema and migrations
├── shared/                    # Shared types and constants
├── storage/                   # S3 storage helpers
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript configuration
├── package.json              # Dependencies
└── README.md                 # This file
```

### Development Workflow

1. **Start Development Server**
   ```bash
   pnpm dev
   ```

2. **Make Changes**
   - Edit files in `client/src/` for frontend
   - Edit files in `server/` for backend

3. **Hot Module Replacement (HMR)**
   - Frontend changes reload automatically
   - Backend changes require server restart

4. **Type Checking**
   ```bash
   pnpm check
   ```

5. **Code Formatting**
   ```bash
   pnpm format
   ```

### Adding New Features

#### Adding a New API Endpoint

1. Define the procedure in `server/routers.ts`:
   ```typescript
   export const appRouter = router({
     myFeature: router({
       getData: protectedProcedure
         .input(z.object({ id: z.number() }))
         .query(async ({ ctx, input }) => {
           // Your logic here
           return data;
         }),
     }),
   });
   ```

2. Use in frontend:
   ```typescript
   const { data } = trpc.myFeature.getData.useQuery({ id: 1 });
   ```

#### Adding a New Database Table

1. Add table to `drizzle/schema.ts`:
   ```typescript
   export const myTable = mysqlTable("my_table", {
     id: int("id").autoincrement().primaryKey(),
     name: varchar("name", { length: 255 }).notNull(),
     createdAt: timestamp("created_at").defaultNow(),
   });
   ```

2. Apply migration:
   ```bash
   pnpm db:push
   ```

---

## 🧪 Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test server/auth.test.ts

# Generate coverage report
pnpm test:coverage
```

### Test Structure

Tests are located in `server/` directory with `.test.ts` extension:

```
server/
├── auth.test.ts
├── content.test.ts
├── payment.test.ts
└── ...
```

### Writing Tests

Example test using Vitest:

```typescript
import { describe, it, expect } from "vitest";
import { myFunction } from "./myFunction";

describe("myFunction", () => {
  it("should return correct value", () => {
    const result = myFunction(5);
    expect(result).toBe(10);
  });

  it("should handle edge cases", () => {
    const result = myFunction(0);
    expect(result).toBe(0);
  });
});
```

### Current Test Status

- **Total Tests**: 233
- **Passing**: 207 (89%)
- **Failing**: 26 (11%)
- **Test Files**: 327

**Note**: Some Telegram router tests are currently failing. See [Troubleshooting](#troubleshooting) for details.

---

## 🏗️ Building for Production

### Build Process

```bash
# Build the application
pnpm build

# This will:
# 1. Build frontend with Vite
# 2. Bundle backend with esbuild
# 3. Generate optimized production files
```

### Build Output

```
dist/
├── public/               # Frontend static files
│   ├── assets/          # Bundled JavaScript/CSS
│   └── index.html       # HTML entry point
└── index.js             # Backend server
```

### Build Optimization

The build process includes:
- **Code Splitting**: 40+ routes with lazy loading
- **Minification**: Terser with console removal
- **Tree-Shaking**: Unused code removal
- **Asset Optimization**: Image and font optimization

### Performance Metrics

After optimization:
- **Bundle Size**: 3.2 MB (down from 3.34 MB)
- **First Contentful Paint**: 14.1s (4G network)
- **Largest Contentful Paint**: 24.4s (4G network)
- **JavaScript Files**: 71 chunks

---

## 🚀 Deployment

### Deployment Options

#### Option 1: Docker Compose (Recommended)

Brings up the app + MySQL with a single command:
```bash
docker compose up --build
```
Then open http://localhost:5000. See `docker-compose.yml` for the local environment defaults.

#### Option 2: Docker

The repo ships a production `Dockerfile` — **multi-stage** (builder → migrator →
slim **non-root** runtime, prod deps only), with a `/health` `HEALTHCHECK`. The
runtime CMD is `node dist/index.js` only; **migrations run separately** (the
`migrator` stage / compose `migrate` service), never at boot.

```bash
# Build the runtime image and run migrations as a one-shot job, then start the app
docker build --target runtime -t innlegg .
docker build --target migrator -t innlegg-migrate .
docker run --rm -e DATABASE_URL=... innlegg-migrate     # apply migrations once
docker run -p 5000:5000 --env-file .env innlegg          # start the app (non-root)
```

#### Option 3: Traditional Server

1. Build application:
   ```bash
   pnpm build
   ```

2. Upload `dist/` to server

3. Install production dependencies:
   ```bash
   pnpm install --prod
   ```

4. Start server:
   ```bash
   NODE_ENV=production pnpm start
   ```

### Pre-Deployment Checklist

- [ ] All tests passing (100%)
- [ ] Environment variables configured
- [ ] Database backups created
- [ ] Migrations applied as a **separate step** (`pnpm db:migrate`), not at app boot — existing push-built DB baselined first
- [ ] SSL/TLS certificates ready (app forces Secure cookies + HTTPS in prod)
- [ ] Rate limiting configured (`REDIS_URL` set — in-memory is ineffective on serverless)
- [ ] Monitoring enabled — `SENTRY_DSN` set (Sentry no-ops without it)
- [ ] `ENABLE_DEV_LOGIN` unset on the public deploy (auto-refused on prod HTTPS)
- [ ] Graceful shutdown verified (SIGTERM drains in-flight requests)
- [ ] Health checks passing
- [ ] Performance metrics acceptable
- [ ] Security audit completed

### Post-Deployment Monitoring

```bash
# Monitor error rates
# Check Sentry dashboard at https://sentry.io

# Monitor performance
# Check Google Analytics at https://analytics.google.com

# Monitor uptime
# Check status page at https://status.innlegg.no

# View server logs
# Check application logs in /var/log/innlegg/
```

---

## 📚 API Documentation

### API Overview

The application uses **tRPC** for type-safe API communication. All endpoints are automatically typed and documented.

### Main API Routes

#### Authentication
- `auth.me` - Get current user
- `auth.logout` - Logout current user

#### Content Management
- `content.generate` - Generate new content
- `content.list` - List user's content
- `content.update` - Update existing content
- `content.delete` - Delete content
- `content.publish` - Publish to platform

#### User Management
- `user.getPreference` - Get user preferences
- `user.updateLanguage` - Update language preference
- `user.getSubscription` - Get subscription details

#### Payment
- `payment.createCheckoutSession` - Create Stripe checkout
- `payment.getPaymentHistory` - Get payment history

### API Examples

#### Generate Content

```typescript
const { data } = trpc.content.generate.useMutation();

data.mutate({
  topic: "Digital Marketing",
  platform: "linkedin",
  tone: "professional",
}, {
  onSuccess: (result) => {
    console.log("Generated:", result.generatedContent);
  },
});
```

#### List User Content

```typescript
const { data: posts } = trpc.content.list.useQuery();

posts?.forEach(post => {
  console.log(`${post.platform}: ${post.generatedContent}`);
});
```

#### Create Payment

```typescript
const { mutate } = trpc.payment.createCheckoutSession.useMutation();

mutate({
  planId: "pro_monthly",
}, {
  onSuccess: (session) => {
    window.open(session.url, '_blank');
  },
});
```

### Full API Documentation

For complete API documentation, see:
- [tRPC Documentation](https://trpc.io/docs)
- [API Routes](./docs/API.md) (coming soon)
- [Type Definitions](./shared/types.ts)

---

## 🔍 Troubleshooting

### Common Issues

#### Issue: "Cannot find module" error

**Solution**:
```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### Issue: Database connection fails

**Solution**:
```bash
# Check database URL
echo $DATABASE_URL

# Verify MySQL is running
mysql -u root -p -e "SELECT 1;"

# Check credentials
mysql -u innlegg_user -p innlegg -e "SELECT 1;"
```

#### Issue: Port 3000 already in use

**Solution**:
```bash
# Use different port
PORT=3001 pnpm dev

# Or kill process using port 3000
lsof -i :3000
kill -9 <PID>
```

#### Issue: Tests failing

**Solution**:
```bash
# Run tests with verbose output
pnpm test -- --reporter=verbose

# Run specific test file
pnpm test server/auth.test.ts

# Check test status
pnpm test -- --reporter=summary
```

### Known Issues

1. **Telegram Router Tests Failing** (26 tests)
   - Issue: `__vite_ssr_exportName__` not defined
   - Status: Under investigation
   - Workaround: Skip Telegram tests for now

2. **Performance Metrics High**
   - Issue: Large JavaScript bundle
   - Status: Optimization in progress
   - Workaround: Use CDN for static assets

3. **Database Indexes Missing**
   - Issue: Slow queries on large datasets
   - Status: Planned for next release
   - Workaround: Add indexes manually (see Database Setup)

### Getting Help

1. **Check Documentation**: Review this README and docs/ folder
2. **Search Issues**: Check GitHub issues for similar problems
3. **Ask Community**: Post in discussions or forums
4. **Contact Support**: Email support@innlegg.no

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Development Process

1. **Fork the Repository**
   ```bash
   git clone https://github.com/yourusername/innlegg.git
   cd innlegg
   ```

2. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Changes**
   - Follow code style guidelines
   - Add tests for new features
   - Update documentation

4. **Run Tests**
   ```bash
   pnpm test
   pnpm check
   pnpm format
   ```

5. **Commit Changes**
   ```bash
   git commit -m "feat: add your feature description"
   ```

6. **Push and Create Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

### Code Style

- Use TypeScript for all code
- Follow ESLint rules
- Format with Prettier
- Add JSDoc comments for functions

### Testing Requirements

- Write tests for new features
- Maintain 80%+ code coverage
- All tests must pass before merge

### Commit Message Format

```
type(scope): subject

body

footer
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

---

## 📞 Support

### Getting Support

- **Documentation**: https://innlegg.no/docs
- **Email**: support@innlegg.no
- **Issues**: https://github.com/yourusername/innlegg/issues
- **Discussions**: https://github.com/yourusername/innlegg/discussions

### Reporting Bugs

When reporting bugs, please include:
1. Detailed description of the issue
2. Steps to reproduce
3. Expected vs actual behavior
4. Environment information (OS, Node version, etc.)
5. Error messages and logs

### Feature Requests

To request features:
1. Check if feature already exists
2. Describe the use case
3. Explain expected behavior
4. Provide examples if possible

---

## 📄 License

**Proprietary and confidential.**

Copyright © 2026 Nexify CRM Systems AS. All rights reserved. (Org.nr: 936300278)

This source code is proprietary and confidential. Unauthorized copying,
distribution, or use is strictly prohibited. See the [LICENSE](LICENSE) file for
the full terms.

---

## 🙏 Acknowledgments

- Built with [React](https://react.dev) and [tRPC](https://trpc.io)
- Database powered by [Drizzle ORM](https://orm.drizzle.team)
- Styling with [Tailwind CSS](https://tailwindcss.com)
- UI components from [Radix UI](https://www.radix-ui.com)
- AI powered by [OpenAI](https://openai.com)
- Payments via [Stripe](https://stripe.com)

---

## 📊 Project Status

- **Current Version**: 1.1.0
- **Status**: Beta — core flows verified end-to-end (see `CODE_STATUS_REPORT.md`, Session 2026-06-22)
- **Last Updated**: June 22, 2026
- **Maintenance**: Active
- **Tests**: 278 passing / 2 skipped · `pnpm check` clean · prod bundle boots

### Recent fixes (2026-06-22)
- Fixed white-screen-on-reload (IP rate-limiter now scoped to `/api`)
- All AI features restored (removed an invalid `thinking` param sent to OpenAI)
- Generated content now saved to "Mine innlegg"; scheduler publishes again
- Unified 3-tier pricing (Gratis 2 · Pro 15 · Premium 30, 10% annual) from one source
- Settings/relational queries fixed; quotas now enforced for paid plans

### Roadmap

- [ ] Stripe billing history + invoice PDF (live Stripe)
- [ ] Persist AI-generated images (`imageUrl` column)
- [ ] Real analytics engagement (LinkedIn metrics-refresh job)
- [ ] Add Sentry error tracking
- [ ] Optimize performance (target: <2s FCP)
- [ ] Implement team collaboration
- [ ] Mobile app development

---

## 📞 Contact

**Project Lead**: Nexify AI  
**Email**: team@innlegg.no  
**Website**: https://innlegg.no  
**Twitter**: [@innlegg_no](https://twitter.com/innlegg_no)

---

**Last Updated**: June 22, 2026  
**Version**: 1.1.0  
**Status**: ✅ Ready for Development | ⚠️ Conditionally Ready for Production

---

## Quick Links

- [Installation Guide](#installation)
- [Environment Setup](#environment-setup)
- [Development Guide](#development)
- [Testing Guide](#testing)
- [Deployment Guide](#deployment)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

**Happy coding! 🚀**
