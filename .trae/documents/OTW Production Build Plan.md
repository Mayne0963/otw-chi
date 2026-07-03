## Foundations
- **Auth Choice**: Clerk (production-friendly, smooth roles). Install and configure Clerk for App Router.
- **Database Choice**: Neon Postgres. Use Prisma as ORM.
- **Design System**: Keep and reuse OTW Luxe components (`OtwPageShell`, `OtwCard`, `OtwButton`, `OtwSectionHeader`, `OtwStatPill`, `OtwEmptyState`) across all new pages.
- **Validation**: Zod for server actions and API routes.
- **Payments**: Stripe (subscriptions via payment links or Checkout + webhooks). Prepare Connect later.
- **Security**: Role-based guards, rate limiting (basic middleware), input validation.

## Packages & Configuration
- **Add Packages**: `@prisma/client`, `prisma`, `@clerk/nextjs`, `zod`, `stripe`, `@stripe/stripe-js`, `@tanstack/react-query` (optional), `resend` (optional), `@upstash/ratelimit` + `@upstash/redis` (optional), `date-fns`.
- **Env Setup**: Create `.env.example` with:
  - `DATABASE_URL`
  - `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
  - `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - `RESEND_API_KEY` (optional), `TWILIO_*` (optional)
- **Prisma Init**: `prisma/schema.prisma` with Neon Postgres provider.
- **Middleware**: `middleware.ts` for Clerk public routes whitelist; role guarding inside server components/actions.

## Prisma Schema
- **Enums**: `Role` (CUSTOMER, DRIVER, ADMIN, FRANCHISE), `RequestStatus` (DRAFT, SUBMITTED, ASSIGNED, PICKED_UP, DELIVERED, COMPLETED, CANCELLED), `ServiceType` (FOOD, STORE, FRAGILE, CONCIERGE).
- **Models**:
  - `User` (id, email, name, role, clerkId)
  - `CustomerProfile` (userId, phone, defaultPickup, defaultDropoff)
  - `DriverProfile` (userId, status, rating, zoneId)
  - `City` (id, name, slug)
  - `Zone` (id, name, slug, cityId)
  - `MembershipPlan` (id, name, priceCents, perks,json)
  - `MembershipSubscription` (id, userId, planId, status, stripeCustomerId, stripeSubId, renewsAt)
  - `Request` (id, customerId, pickup, dropoff, serviceType, notes, status, zoneId, milesEstimate, costEstimate, assignedDriverId?, createdAt)
  - `RequestEvent` (id, requestId, type, message, timestamp)
  - `NIPLedger` (id, userId, requestId?, amount, reason, createdAt)
  - `SupportTicket` (id, userId, subject, status, message, createdAt)
- **Migrations & Seed**:
  - Seed cities/zones, membership plans (Basic/Plus/Executive), sample users.

## Auth & Roles Integration
- **Clerk Setup**: Wrap `app/layout.tsx` with Clerk Provider; add `SignIn`, `SignUp` routes under `app/(auth)/sign-in`, `sign-up` if needed.
- **Role Storage**: Store role in `User` and mirror in Clerk metadata; server checks read from DB.
- **Route Access**:
  - Customer: `/dashboard`, `/requests*`, `/membership/manage`, `/wallet/nip`, `/settings`, `/support`
  - Driver: `/driver*`
  - Admin: `/admin*`
  - Franchise: `/franchise*`
- **Guards**: Utility `requireRole(role[]){...}` used in server components/actions.

## API/Server Actions Structure
- **Directories**:
  - `app/api/requests/*` (CRUD, lifecycle transitions)
  - `app/api/membership/*` (subscribe, preview, webhook handler under `/api/stripe/webhook`)
  - `app/api/driver/*` (jobs list, status toggle, complete)
  - `app/api/admin/*` (overview, requests, drivers, cities-zones, ledger)
- **Patterns**: Zod schemas per route; role checks before DB ops.

## Pages to Add (Minimum Production)
- **Public/Marketing** (use Luxe components):
  - `/how-it-works`: Explainer with sections.
  - `/pricing`: Tiers + benefits + FAQ; uses `OtwCard` variants.
  - `/services`: Tiles for Food/Store/Fragile/Concierge.
  - `/cities` and `/cities/[city]`: SSR lists/coverage.
  - `/franchise`, `/franchise/apply`: Overview + form.
  - `/driver/apply`: Application form.
  - `/about`, `/contact`: Static info + form.
  - `/terms`, `/privacy`: Policy pages.
- **App (Logged In)**:
  - `/dashboard`: Snapshot (active request, membership, NIP). Luxe cards.
  - `/requests/new`: Create request; save DRAFT → SUBMITTED with server action.
  - `/requests`: Paginated list + filters.
  - `/requests/[id]`: Detail, status timeline from `RequestEvent`.
  - `/membership/manage`: Plan switch via Stripe.
  - `/wallet/nip`: NIP dashboard (refactor current NIP page under auth).
  - `/settings`: Profile + addresses.
  - `/support`: Ticket creation + list.
- **Driver**:
  - `/driver/dashboard`: Assigned jobs, status toggle persisted.
  - `/driver/jobs`: Available/Active/Completed.
  - `/driver/jobs/[id]`: Detail + status updates.
  - `/driver/earnings`: Ledger summary.
  - `/driver/profile`, `/driver/zones`: Profile, zone assignment view.
- **Admin (HQ)**:
  - `/admin`: KPIs snapshot.
  - `/admin/requests`: Manage lifecycle, assignment.
  - `/admin/drivers`: Approvals, zones.
  - `/admin/customers`: Basic directory.
  - `/admin/memberships`: Subscriptions view.
  - `/admin/cities-zones`: CRUD.
  - `/admin/nip-ledger`: Ledger.
  - `/admin/support`: Tickets.
  - `/admin/settings`: Admin configs.
- **Franchise (Optional)**:
  - `/franchise/dashboard`, `/franchise/drivers`, `/franchise/requests`, `/franchise/payouts`, `/franchise/zones`.

## Request Assignment Logic (v1)
- Zone selection at request creation (manual v1).
- Driver matching by `zoneId` and `status=ONLINE`.
- Admin manual assignment possible from `/admin/requests`.

## Stripe Membership (v1)
- Create products/prices for tiers.
- Checkout session creation (server action) → redirect.
- Webhook handler updates `MembershipSubscription` status.
- Gate discounts/multipliers in pricing engine (placeholder rules).

## Pricing Engine (v1)
- Base fee + per-mile + surcharges + membership discount.
- Server function used in `/requests/new` and admin overrides.

## Notifications (Optional v1)
- Email via Resend for status updates.
- SMS via Twilio (optional toggle).

## Logging & Monitoring
- Add Sentry SDK; structured logs around lifecycle transitions.

## SEO & Analytics
- Metadata + open graph on marketing pages; sitemap; Plausible or GA.

## File/Folder Plan (Highlights)
- `prisma/schema.prisma`, `prisma/seed.ts`
- `lib/auth/roles.ts` (role guards), `lib/validation/*` (Zod schemas), `lib/pricing.ts`, `lib/stripe.ts`
- `app/(marketing)/how-it-works/page.tsx`, `pricing/page.tsx`, `services/page.tsx`, `cities/page.tsx`, `cities/[city]/page.tsx`, `franchise/page.tsx`, `franchise/apply/page.tsx`, `driver/apply/page.tsx`, `about/page.tsx`, `contact/page.tsx`, `terms/page.tsx`, `privacy/page.tsx`
- `app/(app)/dashboard/page.tsx`, `requests/page.tsx`, `requests/new/page.tsx`, `requests/[id]/page.tsx`, `membership/manage/page.tsx`, `wallet/nip/page.tsx`, `settings/page.tsx`, `support/page.tsx`
- `app/driver/dashboard/page.tsx`, `driver/jobs/page.tsx`, `driver/jobs/[id]/page.tsx`, `driver/earnings/page.tsx`, `driver/profile/page.tsx`, `driver/zones/page.tsx`
- `app/admin/page.tsx`, `admin/requests/page.tsx`, `admin/drivers/page.tsx`, `admin/customers/page.tsx`, `admin/memberships/page.tsx`, `admin/cities-zones/page.tsx`, `admin/nip-ledger/page.tsx`, `admin/support/page.tsx`, `admin/settings/page.tsx`
- `app/api/*` route handlers per feature

## Implementation Order
- **Phase 1**: Auth + Prisma + core lifecycle; build `/dashboard`, `/requests`, `/requests/[id]`.
- **Phase 2**: Stripe subscriptions + gating; `/membership/manage`.
- **Phase 3**: Driver ops with zone-based assignment + earnings ledger.
- **Phase 4**: Admin HQ panels + overrides.
- **Phase 5**: NIP ledger rules + wallet.
- **Phase 6**: Franchise layer dashboards.

## Deliverables
- Full file list of changes.
- Full code for each new/modified file.
- Pages compile; routes work.
- Start with Step 1 and Step 2: install packages, configure Clerk, set up Prisma schema + migrations + seed, then implement minimum pages.