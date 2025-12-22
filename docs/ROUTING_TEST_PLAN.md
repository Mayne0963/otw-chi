# Routing Verification & Test Plan

This document outlines the test cases and verification steps for the OTW application's routing system.

## 1. Route Identification

### Public Pages
- `/` (Landing)
- `/sign-in`, `/sign-up` (Auth)
- `/pricing`, `/how-it-works`, `/services`, `/contact` (Marketing)
- `/driver/apply` (Driver Recruitment)
- `/order`, `/request` (Public Request Forms - Redirect to Sign-in/Dashboard)
- `/privacy`, `/terms` (Legal)
- `/cities/[city]` (City Landing Pages)
- `/franchise` (Franchise Info)

### Protected Pages (Customer)
- `/dashboard` (Main Hub)
- `/dashboard/profile`
- `/requests/[id]` (Request Details)
- `/onboarding` (New User Setup)

### Protected Pages (Driver)
- `/driver` (Driver Dashboard)
- `/driver/jobs` (Job Board)
- `/driver/jobs/[id]` (Job Details)
- `/driver/earnings`
- `/driver/schedule`

### Protected Pages (Admin)
- `/admin` (Admin Dashboard)
- `/admin/users`
- `/admin/requests`
- `/admin/analytics`

### API Routes
- `/api/requests/*` (CRUD for requests)
- `/api/driver/*` (Driver status, location)
- `/api/admin/*` (Admin operations)
- `/api/otw/*` (Legacy/Mock system - Secured)
- `/api/webhooks/clerk` (Webhooks)
- `/api/stripe/webhook` (Payments)

---

## 2. Test Cases

### A. Authentication & Redirection
| Route | Role | Expected Behavior | Status |
|-------|------|-------------------|--------|
| `/dashboard` | Unauth | Redirect to `/sign-in` | ✅ Verified (Middleware) |
| `/dashboard` | Auth | 200 OK | ✅ Verified |
| `/admin` | Customer | Redirect to `/` | ✅ Verified (Middleware) |
| `/admin` | Driver | Redirect to `/` | ✅ Verified (Middleware) |
| `/admin` | Admin | 200 OK | ✅ Verified |
| `/driver` | Customer | Redirect to `/` | ✅ Verified (Middleware) |
| `/driver` | Driver | 200 OK | ✅ Verified |
| `/onboarding` | Auth | 200 OK (Redirects to `/dashboard` if complete) | ✅ Verified (Component) |

### B. API Security
| Route | Method | Scenario | Expected Status | Status |
|-------|--------|----------|-----------------|--------|
| `/api/requests` | POST | Unauth | 401 Unauthorized | ✅ Verified |
| `/api/requests` | POST | Invalid Data | 400 Bad Request | ✅ Verified |
| `/api/admin/otw/overview` | GET | Non-Admin | 403 Forbidden | ✅ Fixed |
| `/api/driver/status` | POST | Non-Driver | 403 Forbidden | ✅ Fixed |
| `/api/driver/status` | POST | Driver (Own ID) | 200 OK | ✅ Verified |
| `/api/driver/status` | POST | Driver (Other ID) | 403 Forbidden | ✅ Fixed |
| `/api/otw/drivers/accept` | POST | Non-Driver | 403 Forbidden | ✅ Fixed |

### C. Edge Cases & Parameters
| Route | Parameter | Scenario | Expected Behavior | Status |
|-------|-----------|----------|-------------------|--------|
| `/requests/[id]` | `id` | Non-existent ID | Show "Not Found" / 404 UI | ✅ Verified |
| `/requests/[id]` | `id` | Other User's ID | Show "Access Denied" / 403 UI | ✅ Verified |
| `/driver/jobs/[id]` | `id` | Taken Job | Show "Job Taken" UI | ✅ Verified |
| `/cities/[city]` | `city` | Any String | Render generic city page | ⚠️ Soft (SEO) |

---

## 3. Implemented Fixes

### Middleware Security
- **Issue**: `/order`, `/request`, `/privacy`, `/terms` were triggering auth redirects unnecessarily or blocking public access.
- **Fix**: Added these routes to `isPublicMatcher` in `middleware.ts`.

### API Vulnerabilities
- **Issue**: `/api/admin/otw/overview` was accessible to any authenticated user.
- **Fix**: Added `requireRole(['ADMIN'])`.
- **Issue**: `/api/driver/status` allowed any user to update any driver's status.
- **Fix**: Added `requireRole(['DRIVER', 'ADMIN'])` and ownership verification.
- **Issue**: `/api/otw/drivers/*` routes were unprotected.
- **Fix**: Added `requireRole(['DRIVER', 'ADMIN'])` to `accept`, `complete`, and `requests` endpoints.

## 4. Next Steps
- Implement explicit validation for `/cities/[city]` to return 404 for unsupported cities.
- Consider migrating legacy `/api/otw/*` routes to standard `/api/driver/*` patterns fully.
