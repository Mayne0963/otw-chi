# Link Audit (Production)

Tool: `broken-link-checker`  
Target: `https://otw-chi-two.vercel.app`  

## Summary
- Broken links reported: `/about`, `/dashboard`, `/membership/manage`, `/requests`, `/wallet/nip`, `/support`, `/settings`.
- `/about` was missing from public route allowlist; fixed in `proxy.ts`.
- The remaining paths are protected dashboard routes; unauthenticated requests may return 404/redirects by design.

## Follow-up
- Re-run link audit after deployment to confirm `/about` resolves and public CTAs no longer reference protected routes.
