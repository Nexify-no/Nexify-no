# Vipps Integration Guide

## Overview

This document describes the Vipps payment and authentication integration for the innlegg application. Vipps is the dominant mobile payment and identification solution in Norway.

---

## Features Implemented

### 1. **Vipps Payment Integration**
- Initiate payments via Vipps eCommerce API
- Get payment status
- Cancel payments
- Refund payments
- Webhook support for payment callbacks

### 2. **Vipps Login Integration**
- OAuth 2.0 based authentication
- User identification via phone number
- Access token management
- Token refresh capability
- Logout/token revocation

---

## Environment Variables Required

### For Vipps Payments:
```bash
VIPPS_CLIENT_ID=your_client_id
VIPPS_CLIENT_SECRET=your_client_secret
VIPPS_SUBSCRIPTION_KEY=your_subscription_key
VIPPS_MERCHANT_SERIAL_NUMBER=your_merchant_serial_number
VIPPS_ENVIRONMENT=test  # or "production"
VIPPS_CALLBACK_PREFIX=https://yourdomain.com/api/vipps/callback
```

### For Vipps Login:
```bash
VIPPS_LOGIN_CLIENT_ID=your_login_client_id
VIPPS_LOGIN_CLIENT_SECRET=your_login_client_secret
VIPPS_LOGIN_REDIRECT_URI=https://yourdomain.com/api/vipps/login/callback
VIPPS_ENVIRONMENT=test  # or "production"
```

---

## API Endpoints

### Payment Endpoints

#### 1. Initiate Payment
```typescript
POST /api/trpc/vipps.initiatePayment

Input:
{
  amount: number,          // Amount in øre (1 NOK = 100 øre)
  orderId: string,         // Unique order ID
  description: string,     // Payment description
  fallbackUrl: string      // URL to return to if payment fails
}

Response:
{
  success: boolean,
  url: string,             // Desktop payment URL
  deepLinkUrl: string      // Mobile app deep link
}
```

#### 2. Get Payment Status
```typescript
GET /api/trpc/vipps.getPaymentStatus

Input:
{
  orderId: string
}

Response:
{
  // Vipps payment status object
}
```

#### 3. Cancel Payment
```typescript
POST /api/trpc/vipps.cancelPayment

Input:
{
  orderId: string
}

Response:
{
  success: boolean
}
```

#### 4. Refund Payment
```typescript
POST /api/trpc/vipps.refundPayment

Input:
{
  orderId: string,
  amount: number           // Amount to refund in øre
}

Response:
{
  success: boolean
}
```

### Authentication Endpoints

#### 1. Get Login URL
```typescript
GET /api/trpc/vipps.getLoginUrl

Input:
{
  state: string            // CSRF token for security
}

Response:
{
  url: string              // Vipps login URL
}
```

#### 2. Handle Login Callback
```typescript
POST /api/trpc/vipps.handleLoginCallback

Input:
{
  code: string,            // Authorization code from Vipps
  state: string            // CSRF token
}

Response:
{
  success: boolean,
  userInfo: {
    id: string,            // Vipps user ID
    phone: string,         // Phone number
    email?: string,
    name?: string
  },
  accessToken: string,
  refreshToken?: string,
  expiresIn: number
}
```

#### 3. Refresh Token
```typescript
POST /api/trpc/vipps.refreshToken

Input:
{
  refreshToken: string
}

Response:
{
  success: boolean,
  accessToken: string,
  expiresIn: number
}
```

#### 4. Logout
```typescript
POST /api/trpc/vipps.logout

Input:
{
  accessToken: string
}

Response:
{
  success: boolean
}
```

---

## Frontend Implementation

### Payment Flow

```typescript
import { trpc } from "@/lib/trpc";

export function VippsPayment() {
  const initiatePayment = trpc.vipps.initiatePayment.useMutation();

  const handlePayment = async () => {
    try {
      const result = await initiatePayment.mutateAsync({
        amount: 2999,  // 29.99 NOK in øre
        orderId: `order-${Date.now()}`,
        description: "Premium Subscription",
        fallbackUrl: window.location.href,
      });

      // Open Vipps payment URL
      window.open(result.url, "_blank");
    } catch (error) {
      console.error("Payment failed:", error);
    }
  };

  return (
    <button onClick={handlePayment} disabled={initiatePayment.isPending}>
      Pay with Vipps
    </button>
  );
}
```

### Login Flow

```typescript
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";

export function VippsLogin() {
  const getLoginUrl = trpc.vipps.getLoginUrl.useQuery(
    { state: generateRandomState() },
    { enabled: false }
  );

  const handleLogin = () => {
    getLoginUrl.refetch().then((result) => {
      if (result.data?.url) {
        window.location.href = result.data.url;
      }
    });
  };

  return (
    <button onClick={handleLogin}>
      Login with Vipps
    </button>
  );
}

// Handle callback
export function VippsLoginCallback() {
  const handleCallback = trpc.vipps.handleLoginCallback.useMutation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (code && state) {
      handleCallback.mutate({ code, state });
    }
  }, []);

  return <div>Processing login...</div>;
}
```

---

## Webhook Handling

### Payment Callback Webhook

Vipps will send a POST request to `VIPPS_CALLBACK_PREFIX` with payment status updates.

**Implementation needed in:** `server/routes/vippsWebhooks.ts`

```typescript
// TODO: Implement webhook handler
// 1. Verify webhook signature
// 2. Update payment status in database
// 3. Trigger subscription activation if payment successful
// 4. Send confirmation email
```

---

## Testing

### Test Credentials (Vipps Test Environment)

- **Test Phone:** +4798765432
- **Test PIN:** 1234
- **Test OTP:** 000000

### Test Card Numbers

- **Visa:** 4111 1111 1111 1111
- **Mastercard:** 5555 5555 5555 4444

### Testing Payment Flow

1. Set `VIPPS_ENVIRONMENT=test`
2. Use test credentials above
3. Verify payment status with `getPaymentStatus`
4. Test refunds with `refundPayment`

---

## Security Considerations

1. **HTTPS Only:** All Vipps endpoints require HTTPS
2. **Signature Verification:** Always verify webhook signatures
3. **CSRF Protection:** Use state parameter in login flow
4. **Token Storage:** Store tokens securely (HttpOnly cookies recommended)
5. **Rate Limiting:** Implement rate limiting on payment endpoints
6. **Amount Validation:** Always validate amounts on server side

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `redirect_uri_mismatch` | Callback URL doesn't match registered | Update VIPPS_LOGIN_REDIRECT_URI |
| `invalid_client` | Wrong client ID/secret | Verify credentials in Vipps dashboard |
| `payment_failed` | Payment declined | Check amount, user balance |
| `token_expired` | Access token expired | Use refresh token to get new token |

---

## Migration from Stripe

### Database Changes Needed

```sql
-- Add Vipps-specific fields to payments table
ALTER TABLE payments ADD COLUMN vipps_transaction_id VARCHAR(255);
ALTER TABLE payments ADD COLUMN vipps_order_id VARCHAR(255);
ALTER TABLE payments ADD COLUMN vipps_status VARCHAR(50);
```

### User Table Changes

```sql
-- Add Vipps login support
ALTER TABLE users ADD COLUMN vipps_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN vipps_phone VARCHAR(20);
ALTER TABLE users ADD COLUMN login_method ENUM('google', 'vipps', 'email');
```

---

## Monitoring & Analytics

### Events to Track

1. Payment initiated
2. Payment completed
3. Payment failed
4. Payment refunded
5. Login attempted
6. Login successful
7. Login failed

### Recommended Metrics

- Payment success rate
- Average payment amount
- Refund rate
- Login conversion rate
- User retention (Vipps vs other methods)

---

## Support & Resources

- **Vipps Developer Portal:** https://developer.vipps.no
- **Vipps API Documentation:** https://vippsas.github.io/vipps-developer-docs/
- **Vipps Test Environment:** https://apitest.vipps.no
- **Support Email:** integration@vipps.no

---

## Next Steps

1. [ ] Register for Vipps merchant account
2. [ ] Get API credentials (client ID, secret, subscription key)
3. [ ] Add environment variables to Vercel
4. [ ] Implement webhook handler
5. [ ] Create Vipps payment UI component
6. [ ] Create Vipps login UI component
7. [ ] Test payment flow end-to-end
8. [ ] Test login flow end-to-end
9. [ ] Deploy to production
10. [ ] Monitor and optimize

---

## Troubleshooting

### Payment not initiating?
- Check `VIPPS_ENVIRONMENT` is set correctly
- Verify all credentials are correct
- Check network requests in browser DevTools
- Review server logs for errors

### Login not working?
- Verify `VIPPS_LOGIN_REDIRECT_URI` matches registered URL
- Check state parameter is being passed correctly
- Ensure HTTPS is enabled
- Review OAuth flow in browser DevTools

### Webhooks not received?
- Verify webhook URL is publicly accessible
- Check firewall/security group allows Vipps IPs
- Implement webhook signature verification
- Add logging to webhook handler

---

**Last Updated:** May 2026
**Status:** Implementation Complete - Ready for Testing
