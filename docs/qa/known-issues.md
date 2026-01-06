# Known Issues & Workarounds

## Backend Dependencies
- Driver location pings rely on the `DriverLocationPing` table (Prisma migration `20251228164501_add_delivery_requests`).
  - If the table is missing in an environment, ping history will be skipped and a warning is returned.
  - Mitigation: ensure migrations are applied in production/staging before enabling live tracking.

## Browser-Specific Workarounds
- iOS Safari: location prompts only appear after a direct user action; ensure the "Use current location" button is tapped.
- Mobile Safari/Chrome: geolocation requires HTTPS (or `http://localhost` in dev).
- Low power mode: background location updates may pause; encourage users to keep the app open while tracking.

## Known UI Limitations
- Protected routes (e.g., `/dashboard`, `/requests`, `/membership/manage`) return redirects or 404s when unauthenticated; link audits should treat these as gated routes.
