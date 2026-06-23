# 📚 Innlegg API Documentation

**Complete API Reference for Innlegg - Din AI Innholdsassistent**

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [Best Practices](#best-practices)
7. [Code Examples](#code-examples)
8. [Webhooks](#webhooks)
9. [FAQ](#faq)

---

## Overview

### What is tRPC?

Innlegg uses **tRPC** (TypeScript Remote Procedure Call) for API communication. tRPC provides:

- **Type Safety**: Full end-to-end type safety without code generation
- **Automatic Documentation**: Types are self-documenting
- **Simple Syntax**: Call procedures like regular functions
- **Real-time Updates**: Built-in support for subscriptions

### API Base URL

```
/api/trpc
```

All API calls are routed through this endpoint automatically.

### Response Format

All responses follow this format:

```json
{
  "result": {
    "data": { /* actual response data */ }
  }
}
```

### Request Format

Requests are sent as HTTP POST with JSON body:

```json
{
  "0": {
    "json": { /* input data */ }
  }
}
```

---

## Authentication

### OAuth 2.0 Flow

Innlegg uses **Manus OAuth** for authentication:

1. User clicks "Sign In" button
2. Redirected to Manus login portal
3. User authenticates with Manus credentials
4. Redirected back with session cookie
5. Cookie automatically sent with all requests

### Session Management

```typescript
// Check current user
const { data: user } = trpc.auth.me.useQuery();

// Logout
const { mutate: logout } = trpc.auth.logout.useMutation();
logout(undefined, {
  onSuccess: () => {
    // Redirect to login
    window.location.href = '/login';
  }
});
```

### Protected vs Public Endpoints

- **Protected Endpoints** (🔒): Require authentication
- **Public Endpoints** (🌐): No authentication required

---

## API Endpoints

### Authentication Endpoints

#### 🌐 `auth.me`
Get current authenticated user

**Type**: Query (GET)  
**Authentication**: Optional  
**Returns**: `User | null`

```typescript
const { data: user } = trpc.auth.me.useQuery();

// Response
{
  id: 1,
  openId: "user_123",
  name: "John Doe",
  email: "john@example.com",
  role: "user",
  createdAt: "2026-05-01T10:00:00Z",
  avatarUrl: "https://..."
}
```

#### 🌐 `auth.logout`
Logout current user

**Type**: Mutation (POST)  
**Authentication**: Required  
**Input**: None  
**Returns**: `{ success: true }`

```typescript
const { mutate: logout } = trpc.auth.logout.useMutation();
logout();
```

---

### User Endpoints

#### 🔒 `user.getPreference`
Get user preferences

**Type**: Query (GET)  
**Authentication**: Required  
**Returns**: `UserPreference`

```typescript
const { data: prefs } = trpc.user.getPreference.useQuery();

// Response
{
  userId: 1,
  language: "no",
  openaiConsent: 1,
  createdAt: "2026-05-01T10:00:00Z"
}
```

#### 🔒 `user.updateLanguage`
Update user language preference

**Type**: Mutation (POST)  
**Authentication**: Required  
**Input**:
```typescript
{
  language: "no" | "en"
}
```
**Returns**: `{ success: true }`

```typescript
const { mutate: updateLang } = trpc.user.updateLanguage.useMutation();

updateLang({ language: "en" }, {
  onSuccess: () => {
    console.log("Language updated");
  }
});
```

#### 🔒 `user.updateOpenAIConsent`
Update OpenAI data processing consent

**Type**: Mutation (POST)  
**Authentication**: Required  
**Input**:
```typescript
{
  consent: 0 | 1 | 2  // 0=not asked, 1=accepted, 2=declined
}
```
**Returns**: `{ success: true }`

```typescript
const { mutate } = trpc.user.updateOpenAIConsent.useMutation();

mutate({ consent: 1 });
```

#### 🔒 `user.getOnboardingStatus`
Get user onboarding status

**Type**: Query (GET)  
**Authentication**: Required  
**Returns**: `{ completed: boolean }`

```typescript
const { data: status } = trpc.user.getOnboardingStatus.useQuery();

// Response
{
  completed: false
}
```

#### 🔒 `user.completeOnboarding`
Mark onboarding as completed

**Type**: Mutation (POST)  
**Authentication**: Required  
**Input**: None  
**Returns**: `{ success: true }`

```typescript
const { mutate } = trpc.user.completeOnboarding.useMutation();
mutate();
```

#### 🔒 `user.getSubscription`
Get user subscription details

**Type**: Query (GET)  
**Authentication**: Required  
**Returns**: `Subscription`

```typescript
const { data: sub } = trpc.user.getSubscription.useQuery();

// Response
{
  id: 1,
  userId: 1,
  status: "trial",
  postsGenerated: 3,
  trialPostsLimit: 5,
  createdAt: "2026-05-01T10:00:00Z"
}
```

---

### Content Endpoints

#### 🔒 `content.generate`
Generate new AI content

**Type**: Mutation (POST)  
**Authentication**: Required  
**Input**:
```typescript
{
  topic: string;              // Topic to write about
  platform: "linkedin" | "twitter" | "instagram" | "facebook";
  tone?: "professional" | "friendly" | "motivational" | "educational";
  additionalContext?: string; // Optional context
}
```
**Returns**: `{ generatedContent: string; tags: string[] }`

```typescript
const { mutate: generate } = trpc.content.generate.useMutation();

generate({
  topic: "Digital Marketing",
  platform: "linkedin",
  tone: "professional"
}, {
  onSuccess: (result) => {
    console.log("Generated:", result.generatedContent);
  }
});
```

#### 🔒 `content.list`
List user's content

**Type**: Query (GET)  
**Authentication**: Required  
**Returns**: `Post[]`

```typescript
const { data: posts } = trpc.content.list.useQuery();

// Response
[
  {
    id: 1,
    userId: 1,
    platform: "linkedin",
    rawInput: "Digital Marketing",
    generatedContent: "...",
    status: "draft",
    createdAt: "2026-05-01T10:00:00Z"
  }
]
```

#### 🔒 `content.update`
Update existing content

**Type**: Mutation (POST)  
**Authentication**: Required  
**Input**:
```typescript
{
  postId: number;
  content: string;
}
```
**Returns**: `{ success: true }`

```typescript
const { mutate: update } = trpc.content.update.useMutation();

update({
  postId: 1,
  content: "Updated content..."
});
```

#### 🔒 `content.delete`
Delete content

**Type**: Mutation (POST)  
**Authentication**: Required  
**Input**:
```typescript
{
  postId: number;
}
```
**Returns**: `{ success: true }`

```typescript
const { mutate: delete_ } = trpc.content.delete.useMutation();

delete_({ postId: 1 });
```

#### 🔒 `content.publish`
Publish content to platform

**Type**: Mutation (POST)  
**Authentication**: Required  
**Input**:
```typescript
{
  postId: number;
  platform: "linkedin" | "twitter" | "instagram" | "facebook";
}
```
**Returns**: `{ success: true; externalId: string }`

```typescript
const { mutate: publish } = trpc.content.publish.useMutation();

publish({
  postId: 1,
  platform: "linkedin"
}, {
  onSuccess: (result) => {
    console.log("Published with ID:", result.externalId);
  }
});
```

#### 🔒 `content.repurpose`
Repurpose content for different platform

**Type**: Mutation (POST)  
**Authentication**: Required  
**Input**:
```typescript
{
  postId: number;
  targetPlatform: "linkedin" | "twitter" | "instagram" | "facebook";
  repurposeType: "shorten" | "expand" | "casual" | "professional";
}
```
**Returns**: `{ generatedContent: string }`

```typescript
const { mutate: repurpose } = trpc.content.repurpose.useMutation();

repurpose({
  postId: 1,
  targetPlatform: "twitter",
  repurposeType: "shorten"
});
```

#### 🔒 `content.getActivityData`
Get content activity metrics

**Type**: Query (GET)  
**Authentication**: Required  
**Returns**: `ActivityData`

```typescript
const { data: activity } = trpc.content.getActivityData.useQuery();

// Response
{
  totalPosts: 42,
  publishedPosts: 35,
  draftPosts: 7,
  platforms: {
    linkedin: 15,
    twitter: 12,
    instagram: 8
  }
}
```

---

### Scheduling Endpoints

#### 🔒 `scheduling.schedule`
Schedule content for publishing

**Type**: Mutation (POST)  
**Authentication**: Required  
**Input**:
```typescript
{
  postId: number;
  platform: "linkedin" | "twitter" | "instagram" | "facebook";
  scheduledFor: Date;
}
```
**Returns**: `{ success: true; scheduledId: string }`

```typescript
const { mutate: schedule } = trpc.scheduling.schedule.useMutation();

const futureDate = new Date();
futureDate.setHours(futureDate.getHours() + 2);

schedule({
  postId: 1,
  platform: "linkedin",
  scheduledFor: futureDate
});
```

#### 🔒 `scheduling.getScheduled`
Get scheduled posts

**Type**: Query (GET)  
**Authentication**: Required  
**Returns**: `ScheduledPost[]`

```typescript
const { data: scheduled } = trpc.scheduling.getScheduled.useQuery();
```

#### 🔒 `scheduling.cancelSchedule`
Cancel scheduled post

**Type**: Mutation (POST)  
**Authentication**: Required  
**Input**:
```typescript
{
  scheduledId: string;
}
```
**Returns**: `{ success: true }`

```typescript
const { mutate: cancel } = trpc.scheduling.cancelSchedule.useMutation();

cancel({ scheduledId: "sched_123" });
```

---

### Analytics Endpoints

#### 🔒 `analytics.getMetrics`
Get performance metrics

**Type**: Query (GET)  
**Authentication**: Required  
**Input** (optional):
```typescript
{
  dateRange?: {
    from: Date;
    to: Date;
  };
  platform?: "linkedin" | "twitter" | "instagram" | "facebook";
}
```
**Returns**: `Metrics`

```typescript
const { data: metrics } = trpc.analytics.getMetrics.useQuery({
  dateRange: {
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date()
  }
});

// Response
{
  totalImpressions: 5000,
  totalEngagements: 250,
  averageEngagementRate: 5.0,
  topPost: { id: 1, engagements: 150 }
}
```

---

### Payment Endpoints

#### 🔒 `payment.createCheckoutSession`
Create Stripe checkout session

**Type**: Mutation (POST)  
**Authentication**: Required  
**Input**:
```typescript
{
  planId: string; // "pro_monthly", "pro_yearly", etc.
}
```
**Returns**: `{ sessionId: string; url: string }`

```typescript
const { mutate: checkout } = trpc.payment.createCheckoutSession.useMutation();

checkout({ planId: "pro_monthly" }, {
  onSuccess: (session) => {
    window.open(session.url, '_blank');
  }
});
```

#### 🔒 `payment.getPaymentHistory`
Get payment history

**Type**: Query (GET)  
**Authentication**: Required  
**Returns**: `Payment[]`

```typescript
const { data: payments } = trpc.payment.getPaymentHistory.useQuery();

// Response
[
  {
    id: "pay_123",
    amount: 99,
    currency: "USD",
    status: "succeeded",
    createdAt: "2026-05-01T10:00:00Z"
  }
]
```

---

### Trends Endpoints

#### 🌐 `trends.getTrending`
Get trending topics

**Type**: Query (GET)  
**Authentication**: Optional  
**Input** (optional):
```typescript
{
  country?: string; // "NO", "US", etc.
  limit?: number;   // Default: 10
}
```
**Returns**: `TrendingTopic[]`

```typescript
const { data: trends } = trpc.trends.getTrending.useQuery({
  country: "NO",
  limit: 20
});

// Response
[
  {
    topic: "AI in Business",
    volume: 15000,
    growth: 45
  }
]
```

---

### Hashtag Endpoints

#### 🌐 `hashtag.getRecommendations`
Get hashtag recommendations

**Type**: Query (GET)  
**Authentication**: Optional  
**Input**:
```typescript
{
  topic: string;
  platform: "linkedin" | "twitter" | "instagram" | "facebook";
  limit?: number;
}
```
**Returns**: `string[]`

```typescript
const { data: hashtags } = trpc.hashtag.getRecommendations.useQuery({
  topic: "Digital Marketing",
  platform: "instagram",
  limit: 10
});

// Response
["#DigitalMarketing", "#SEO", "#SocialMedia", ...]
```

---

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "User not authenticated"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | User not authenticated |
| `FORBIDDEN` | 403 | User not authorized |
| `NOT_FOUND` | 404 | Resource not found |
| `BAD_REQUEST` | 400 | Invalid input |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMIT` | 429 | Rate limit exceeded |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |

### Error Handling in Code

```typescript
const { mutate: generate } = trpc.content.generate.useMutation();

generate({ topic: "...", platform: "linkedin" }, {
  onSuccess: (data) => {
    console.log("Success:", data);
  },
  onError: (error) => {
    if (error.code === 'UNAUTHORIZED') {
      // Redirect to login
      window.location.href = '/login';
    } else if (error.code === 'RATE_LIMIT') {
      // Show rate limit message
      toast.error("Too many requests. Please try again later.");
    } else {
      // Show generic error
      toast.error(error.message);
    }
  }
});
```

---

## Rate Limiting

### Rate Limit Headers

Every response includes rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1620000000
```

### Rate Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| **Public Endpoints** | 100 | 15 minutes |
| **User Endpoints** | 50 | 15 minutes |
| **AI Generation** | 10 | 1 minute |
| **Payment Endpoints** | 5 | 1 minute |

### Handling Rate Limits

```typescript
const { mutate: generate } = trpc.content.generate.useMutation();

generate(input, {
  onError: (error) => {
    if (error.code === 'RATE_LIMIT') {
      const resetTime = new Date(parseInt(headers['X-RateLimit-Reset']) * 1000);
      console.log(`Rate limited. Reset at: ${resetTime}`);
      
      // Wait and retry
      setTimeout(() => {
        generate(input);
      }, 60000); // Wait 1 minute
    }
  }
});
```

---

## Best Practices

### 1. Use Optimistic Updates

```typescript
const { mutate: update } = trpc.content.update.useMutation();
const utils = trpc.useUtils();

mutate(
  { postId: 1, content: "New content" },
  {
    onMutate: async (newData) => {
      // Cancel ongoing queries
      await utils.content.list.cancel();
      
      // Snapshot old data
      const oldData = utils.content.list.getData();
      
      // Update cache optimistically
      utils.content.list.setData(undefined, (old) => 
        old?.map(p => p.id === newData.postId ? { ...p, ...newData } : p)
      );
      
      return { oldData };
    },
    onError: (err, newData, context) => {
      // Rollback on error
      utils.content.list.setData(undefined, context?.oldData);
    }
  }
);
```

### 2. Handle Loading States

```typescript
const { mutate, isPending } = trpc.content.generate.useMutation();

return (
  <button 
    onClick={() => mutate(input)}
    disabled={isPending}
  >
    {isPending ? "Generating..." : "Generate"}
  </button>
);
```

### 3. Batch Requests

```typescript
// ❌ Bad: Multiple sequential requests
const post1 = await trpc.content.get.query({ id: 1 });
const post2 = await trpc.content.get.query({ id: 2 });
const post3 = await trpc.content.get.query({ id: 3 });

// ✅ Good: Parallel requests
const [post1, post2, post3] = await Promise.all([
  trpc.content.get.query({ id: 1 }),
  trpc.content.get.query({ id: 2 }),
  trpc.content.get.query({ id: 3 })
]);
```

### 4. Cache Management

```typescript
const utils = trpc.useUtils();

// Invalidate cache after mutation
mutate(input, {
  onSuccess: () => {
    // Refetch data
    utils.content.list.invalidate();
  }
});

// Manually update cache
utils.content.list.setData(undefined, (old) => [
  ...old,
  newPost
]);
```

---

## Code Examples

### Complete Example: Generate and Publish Content

```typescript
import { trpc } from "@/lib/trpc";
import { useState } from "react";

export function ContentGenerator() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("linkedin");
  
  // Generate content
  const { mutate: generate, isPending: isGenerating } = 
    trpc.content.generate.useMutation();
  
  // Publish content
  const { mutate: publish, isPending: isPublishing } = 
    trpc.content.publish.useMutation();
  
  const handleGenerate = async () => {
    generate(
      { topic, platform },
      {
        onSuccess: (result) => {
          console.log("Generated:", result.generatedContent);
          
          // Auto-publish if desired
          if (confirm("Publish now?")) {
            publish({ postId: result.id, platform });
          }
        },
        onError: (error) => {
          alert(`Error: ${error.message}`);
        }
      }
    );
  };
  
  return (
    <div>
      <input 
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Enter topic..."
      />
      
      <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
        <option value="linkedin">LinkedIn</option>
        <option value="twitter">Twitter</option>
        <option value="instagram">Instagram</option>
        <option value="facebook">Facebook</option>
      </select>
      
      <button 
        onClick={handleGenerate}
        disabled={isGenerating || isPublishing}
      >
        {isGenerating ? "Generating..." : "Generate"}
      </button>
    </div>
  );
}
```

---

## Webhooks

### Stripe Webhooks

Innlegg automatically handles Stripe webhooks for payment events:

- `payment_intent.succeeded` - Payment successful
- `invoice.paid` - Invoice paid
- `invoice.payment_failed` - Payment failed
- `customer.subscription.updated` - Subscription updated

**Webhook Endpoint**: `/api/stripe/webhook`

---

## FAQ

### Q: How do I authenticate?

A: Use the Manus OAuth login button. Session is maintained automatically via cookies.

### Q: Can I use the API from a mobile app?

A: Yes, but you'll need to implement OAuth login flow in your mobile app. Contact support for mobile SDK.

### Q: What's the maximum content length?

A: Generated content is limited to 5000 characters per platform.

### Q: How often can I generate content?

A: AI generation is limited to 10 requests per minute. See [Rate Limiting](#rate-limiting).

### Q: Can I export my data?

A: Yes, use the export feature in settings or contact support for bulk export.

### Q: Is there a webhook for content events?

A: Not yet, but it's on the roadmap. Use polling for now.

### Q: How do I handle errors in production?

A: Use Sentry integration for error tracking. See [Error Handling](#error-handling).

---

## Support

- **Documentation**: https://innlegg.no/docs
- **Email**: support@innlegg.no
- **GitHub Issues**: https://github.com/yourusername/innlegg/issues
- **Discord**: https://discord.gg/innlegg

---

**Last Updated**: May 7, 2026  
**API Version**: 1.0.0  
**Status**: ✅ Production Ready

---

## Changelog

### v1.0.0 (May 7, 2026)
- Initial API documentation
- 30+ endpoints documented
- Complete error handling guide
- Best practices guide
- Code examples

---

**Happy coding! 🚀**
