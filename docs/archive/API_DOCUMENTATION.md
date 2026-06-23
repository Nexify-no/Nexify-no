# API Documentation - Innlegg

## Overview

Innlegg uses tRPC for type-safe API communication between frontend and backend. All API calls are routed through `/api/trpc`.

---

## Authentication

### Login Flow

```typescript
// Get login URL
const loginUrl = getLoginUrl();

// Redirect user to login
window.location.href = loginUrl;

// After OAuth callback, user is authenticated
const { user } = useAuth();
```

### Protected Procedures

All protected procedures require authentication:

```typescript
// Frontend
const { data } = trpc.dashboard.getUserStats.useQuery();

// Backend
export const dashboardRouter = router({
  getUserStats: protectedProcedure.query(({ ctx }) => {
    // ctx.user is available here
    return getUserStats(ctx.user.id);
  }),
});
```

---

## Core Routers

### Admin Router

**Procedures:**
- `getAllUsers(input: { page, limit, search, role, sortBy, sortOrder })` - Get all users with pagination
- `getStats()` - Get admin statistics
- `updateUserRole(input: { userId, role })` - Update user role
- `deleteUser(input: { userId })` - Delete a user
- `getUserActivity(input: { userId })` - Get user activity logs

**Example:**
```typescript
const { data: users } = trpc.admin.getAllUsers.useQuery({
  page: 1,
  limit: 20,
  role: 'user',
});

const updateRoleMutation = trpc.admin.updateUserRole.useMutation();
updateRoleMutation.mutate({ userId: 1, role: 'admin' });
```

### Support Router

**Procedures:**
- `createTicket(input: { title, description, priority })` - Create support ticket
- `getTickets(input: { page, limit, status })` - Get user's tickets
- `getTicketDetail(input: { ticketId })` - Get ticket details
- `addReply(input: { ticketId, message })` - Add reply to ticket
- `updateTicketStatus(input: { ticketId, status })` - Update ticket status
- `getStats()` - Get support statistics
- `getAllTickets(input: { page, limit, status })` - Get all tickets (admin only)

**Example:**
```typescript
const createTicketMutation = trpc.support.createTicket.useMutation();
createTicketMutation.mutate({
  title: 'Cannot login',
  description: 'Getting error when trying to login',
  priority: 'high',
});

const { data: tickets } = trpc.support.getTickets.useQuery({
  page: 1,
  limit: 10,
  status: 'open',
});
```

### Payment Router

**Procedures:**
- `createCheckoutSession(input: { priceId })` - Create Stripe checkout session
- `getCheckoutSession(input: { sessionId })` - Get checkout session details
- `cancelSubscription()` - Cancel user's subscription
- `createCustomerPortalSession()` - Create Stripe customer portal session
- `getSubscriptionStatus()` - Get current subscription status
- `getInvoiceHistory(input: { page, limit })` - Get invoice history

**Example:**
```typescript
const checkoutMutation = trpc.payment.createCheckoutSession.useMutation();
checkoutMutation.mutate({ priceId: 'price_xxx' }, {
  onSuccess: (data) => {
    window.open(data.url, '_blank');
  },
});

const { data: subscription } = trpc.payment.getSubscriptionStatus.useQuery();
```

### Content Router

**Procedures:**
- `generateContent(input: { prompt, platform, tone })` - Generate content
- `getUserPosts(input: { page, limit, platform })` - Get user's posts
- `savePost(input: { content, platform, scheduledTime })` - Save post
- `deletePost(input: { postId })` - Delete post
- `publishPost(input: { postId })` - Publish post to social media

**Example:**
```typescript
const generateMutation = trpc.content.generateContent.useMutation();
generateMutation.mutate({
  prompt: 'Write a funny tweet about coffee',
  platform: 'twitter',
  tone: 'humorous',
});

const { data: posts } = trpc.content.getUserPosts.useQuery({
  page: 1,
  limit: 20,
  platform: 'twitter',
});
```

---

## Error Handling

### tRPC Errors

```typescript
const mutation = trpc.content.generateContent.useMutation({
  onError: (error) => {
    console.error('Error:', error.message);
    // Handle error
  },
});
```

### Common Error Codes

- `UNAUTHORIZED` - User not authenticated
- `FORBIDDEN` - User doesn't have permission
- `NOT_FOUND` - Resource not found
- `BAD_REQUEST` - Invalid input
- `INTERNAL_SERVER_ERROR` - Server error

---

## Pagination

Most list endpoints support pagination:

```typescript
interface PaginationInput {
  page: number;      // 1-indexed
  limit: number;     // Items per page (default: 20, max: 100)
  search?: string;   // Search query
  sortBy?: string;   // Sort field
  sortOrder?: 'asc' | 'desc'; // Sort order
}

interface PaginationResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
```

**Example:**
```typescript
const { data } = trpc.admin.getAllUsers.useQuery({
  page: 2,
  limit: 50,
  search: 'john',
  sortBy: 'createdAt',
  sortOrder: 'desc',
});

console.log(data.pagination.pages); // Total pages
```

---

## Mutations

### Optimistic Updates

```typescript
const mutation = trpc.content.savePost.useMutation({
  onMutate: async (newPost) => {
    // Cancel ongoing queries
    await trpc.useUtils().content.getUserPosts.cancel();

    // Get previous data
    const previousPosts = trpc.useUtils().content.getUserPosts.getData();

    // Update cache optimistically
    trpc.useUtils().content.getUserPosts.setData(
      { page: 1, limit: 20 },
      (old) => {
        if (!old) return old;
        return {
          ...old,
          data: [newPost, ...old.data],
        };
      }
    );

    return { previousPosts };
  },
  onError: (err, newPost, context) => {
    // Rollback on error
    if (context?.previousPosts) {
      trpc.useUtils().content.getUserPosts.setData(
        { page: 1, limit: 20 },
        context.previousPosts
      );
    }
  },
  onSuccess: () => {
    // Invalidate cache to refetch
    trpc.useUtils().content.getUserPosts.invalidate();
  },
});
```

---

## Webhooks

### Stripe Webhooks

Webhook endpoint: `POST /api/stripe/webhook`

**Events handled:**
- `checkout.session.completed` - Payment successful
- `customer.subscription.updated` - Subscription changed
- `customer.subscription.deleted` - Subscription cancelled
- `invoice.paid` - Invoice paid
- `invoice.payment_failed` - Payment failed

**Example payload:**
```json
{
  "id": "evt_1234567890",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_1234567890",
      "customer_email": "user@example.com",
      "payment_intent": "pi_1234567890"
    }
  }
}
```

---

## Rate Limiting

API endpoints have rate limiting:

- **Authenticated users**: 100 requests/minute
- **Unauthenticated users**: 10 requests/minute
- **Webhook endpoints**: 1000 requests/minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

---

## Caching

### Query Caching

```typescript
// Default cache time: 5 minutes
const { data } = trpc.dashboard.getUserStats.useQuery();

// Custom cache time
const { data } = trpc.dashboard.getUserStats.useQuery(undefined, {
  staleTime: 10 * 60 * 1000, // 10 minutes
});

// Disable caching
const { data } = trpc.dashboard.getUserStats.useQuery(undefined, {
  staleTime: 0,
});
```

### Cache Invalidation

```typescript
// Invalidate single query
trpc.useUtils().dashboard.getUserStats.invalidate();

// Invalidate all queries
trpc.useUtils().invalidate();

// Invalidate specific data
trpc.useUtils().dashboard.getUserStats.setData(undefined, null);
```

---

## Best Practices

1. **Always handle loading states**
   ```typescript
   if (isLoading) return <LoadingSpinner />;
   if (error) return <ErrorMessage error={error} />;
   ```

2. **Use optimistic updates for better UX**
   ```typescript
   mutation.mutate(data, {
     onMutate: (newData) => {
       // Update UI immediately
     },
   });
   ```

3. **Invalidate cache after mutations**
   ```typescript
   onSuccess: () => {
     trpc.useUtils().items.list.invalidate();
   }
   ```

4. **Handle errors gracefully**
   ```typescript
   onError: (error) => {
     toast.error(error.message);
   }
   ```

5. **Use proper TypeScript types**
   ```typescript
   type UserInput = Parameters<typeof trpc.admin.updateUserRole.useMutation>[0];
   ```

---

## Testing

### Testing Queries

```typescript
import { trpc } from '@/lib/trpc';

describe('Admin Router', () => {
  it('should fetch all users', async () => {
    const users = await trpc.admin.getAllUsers.query({
      page: 1,
      limit: 20,
    });

    expect(users.data).toBeDefined();
    expect(users.pagination.total).toBeGreaterThan(0);
  });
});
```

### Testing Mutations

```typescript
describe('Support Router', () => {
  it('should create support ticket', async () => {
    const ticket = await trpc.support.createTicket.mutate({
      title: 'Test ticket',
      description: 'Test description',
      priority: 'normal',
    });

    expect(ticket.id).toBeDefined();
    expect(ticket.status).toBe('open');
  });
});
```

---

## Troubleshooting

### Query not updating

**Problem:** Query data not updating after mutation

**Solution:**
```typescript
// Invalidate cache after mutation
onSuccess: () => {
  trpc.useUtils().items.list.invalidate();
}
```

### Stale data

**Problem:** Getting old data from cache

**Solution:**
```typescript
// Reduce stale time
const { data } = trpc.items.list.useQuery(undefined, {
  staleTime: 0, // Always fresh
});
```

### Type errors

**Problem:** TypeScript errors with tRPC

**Solution:**
```typescript
// Make sure types are imported correctly
import type { RouterOutput } from '@/server/routers';
type UserList = RouterOutput['admin']['getAllUsers'];
```
