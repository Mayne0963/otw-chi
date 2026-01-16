
import 'dotenv/config';
import { getPrisma } from '@/lib/db';

async function fixCoupon() {
  const prisma = getPrisma();
  // The user clarified the code is ZAFJDE5E (with a 5), not ZAFJDESE (with an S)
  const correctCode = 'ZAFJDE5E';
  const wrongCode = 'ZAFJDESE';

  console.log(`Fixing coupon. creating ${correctCode}...`);

  // 1. Create the correct coupon
  const coupon = await prisma.promoCode.upsert({
    where: { code: correctCode },
    update: { 
        active: true,
        percentOff: 50, // Assuming 50% as before
        maxRedemptions: 1000 
    },
    create: {
      code: correctCode,
      active: true,
      percentOff: 50,
      maxRedemptions: 1000,
      startsAt: new Date(),
    },
  });

  console.log('✅ Created/Updated correct coupon:', coupon);

  // 2. Optionally clean up the wrong one if it exists, or leave it. 
  // Let's leave it just in case, or maybe disable it? 
  // User didn't ask to remove the other one, but to make this one work.
  // I'll leave the S version alone to be safe, or just in case they try both.
}

fixCoupon()
  .catch((e) => {
    console.error('Error fixing coupon:', e);
    process.exit(1);
  });
