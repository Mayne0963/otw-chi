import "server-only";

import { normalizeCouponCode } from "@/lib/coupons";

export const ADMIN_FREE_COUPON_CODE = normalizeCouponCode(
  process.env.OTW_ADMIN_FREE_CODE ?? "OTWADMINFREE"
);

export function isAdminFreeCoupon(code: string | null | undefined) {
  return normalizeCouponCode(code ?? "") === ADMIN_FREE_COUPON_CODE;
}

