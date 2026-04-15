# OTW site test report

Test target: https://otw-chi-two.vercel.app

## Summary
- ✅ Public pages loaded and rendered: Home, Pricing, Order, How It Works
- ✅ Auth flow: sign-in succeeded and redirected to `/dashboard`; then logged out successfully back to `/`
- ✅ Core authenticated navigation worked: `/requests`, `/membership/manage`, `/support`, `/settings`

## Evidence (screenshots)
- Home (logged out): [home.png](./home.png)
- Pricing: [pricing.png](./pricing.png)
- Order (request form): [order.png](./order.png)
- How It Works: [how-it-works.png](./how-it-works.png)

## Notes / potential issues to double-check

### 1) Console noise: repeated `net::ERR_ABORTED`
While navigating, I observed frequent console errors like `net::ERR_ABORTED` for:
- server component (`?_rsc=...`) fetches
- some API calls (e.g. `api/auth/get-session`, `api/app-version`)

This *can* happen if requests are intentionally canceled due to rapid route changes/prefetching, but the volume was high enough that it’s worth validating in a normal Chrome session:
1. Open DevTools → Console
2. Hard refresh
3. Click through Home → Pricing → Order → How It Works and confirm whether the errors reproduce

If they do reproduce, the next step would be to identify which fetch is being aborted and why (prefetch, route transition, error boundary, auth/session polling, etc.).

### 2) “Request a Service” routing label vs destination
The “Request a Service” nav item routed to `/order` (Order Delivery) in this test run. If you intended `/request` as the destination, confirm the expected route.

