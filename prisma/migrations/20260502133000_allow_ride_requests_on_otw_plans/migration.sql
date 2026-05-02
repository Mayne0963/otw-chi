UPDATE "MembershipPlan"
SET "allowedServiceTypes" = '["FOOD","STORE","FRAGILE","CONCIERGE","RIDE"]'::jsonb
WHERE "name" IN (
  'OTW BASIC',
  'OTW PLUS',
  'OTW PRO',
  'OTW ELITE',
  'OTW BLACK',
  'OTW BUSINESS CORE',
  'OTW BUSINESS PRO',
  'OTW TRUE',
  'OTW ENTERPRISE'
);
