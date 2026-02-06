# hCaptcha Authentication Issue Diagnosis

## Problem Summary
The OTW delivery system at `otw-chi-two.vercel.app` is experiencing authentication failures when users attempt to place orders. The error manifests as:
- **Error**: `"pat_missing_auth"` from `https://api.hcaptcha.com/authenticate`
- **Status**: 500 Internal Server Error
- **Impact**: Users cannot complete order placement

## Investigation Findings

### 1. Environment Variables
✅ **CONFIGURED**: Both required hCaptcha environment variables are set in Vercel:
- `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` (updated 2h ago)
- `HCAPTCHA_SECRET_KEY` (added 13h ago)

### 2. Client-Side Configuration
✅ **CONFIGURED**: The `NeonAuthUIProvider` in `app/layout.tsx` (lines 44-52) is properly configured:
```typescript
<NeonAuthUIProvider
  authClient={authClient}
  redirectTo="/dashboard"
  emailOTP
  captcha={{
    provider: 'hcaptcha',
    siteKey: process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY!,
  }}
>
```

### 3. Server-Side Validation
⚠️ **ISSUE IDENTIFIED**: The `HCAPTCHA_SECRET_KEY` environment variable is set in Vercel, but there is **NO server-side validation code** found in the codebase that uses this secret key.

**Search Results**:
- No matches for `HCAPTCHA_SECRET` in any server files
- No matches for `hcaptcha.*secret` patterns
- No matches for `captcha.*verify` patterns

### 4. Root Cause Analysis

The issue is that **Neon Auth** (`@neondatabase/auth`) is configured to use hCaptcha, but the **server-side secret key is not being passed to Neon Auth's configuration**.

Looking at `lib/auth/server.ts`:
```typescript
export const auth = createNeonAuth({
  baseUrl,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET,
  },
});
```

**The problem**: The `createNeonAuth` configuration is missing the hCaptcha secret key configuration. Neon Auth needs to know the hCaptcha secret to verify captcha tokens on the server side.

## Solution

The Neon Auth configuration needs to include the hCaptcha secret key. Based on the Neon Auth documentation, the server configuration should include captcha settings.

### Required Fix

Update `lib/auth/server.ts` to include hCaptcha configuration:

```typescript
import { createNeonAuth } from '@neondatabase/auth/next/server';

const baseUrl = process.env.NEON_AUTH_BASE_URL;

if (!baseUrl) {
  throw new Error('Missing NEON_AUTH_BASE_URL environment variable.');
}

if (!process.env.NEON_AUTH_COOKIE_SECRET) {
  throw new Error('Missing NEON_AUTH_COOKIE_SECRET environment variable.');
}

if (process.env.NEON_AUTH_COOKIE_SECRET.length < 32) {
  throw new Error('NEON_AUTH_COOKIE_SECRET must be at least 32 characters long.');
}

export const auth = createNeonAuth({
  baseUrl,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET,
  },
  captcha: {
    provider: 'hcaptcha',
    secretKey: process.env.HCAPTCHA_SECRET_KEY!,
  },
});

export async function getNeonSession() {
  try {
    const session = await auth.getSession();
    return session?.data || null;
  } catch (error) {
    console.error('Neon Auth Error:', error);
    return null;
  }
}
```

## Additional Issues to Address

### Missing Environment Variable Documentation
The `.env.example` file does not include the hCaptcha environment variables. This should be added:

```env
# hCaptcha (for bot protection)
NEXT_PUBLIC_HCAPTCHA_SITE_KEY="your_hcaptcha_site_key"
HCAPTCHA_SECRET_KEY="your_hcaptcha_secret_key"
```

## Impact Assessment

**Severity**: HIGH
- Users cannot place orders
- Complete blocking of core functionality
- Affects all users attempting to use the order system

**Affected Components**:
- Order placement flow
- User authentication during checkout
- Any form that requires captcha verification

## Next Steps

1. ✅ Update `lib/auth/server.ts` with hCaptcha configuration
2. ✅ Update `.env.example` to document required hCaptcha variables
3. ✅ Test the fix on a preview deployment
4. ✅ Deploy to production
5. ✅ Verify order placement works end-to-end
