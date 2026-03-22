import Link from 'next/link';
import MembershipCompareBuilder, {
  type MembershipComparePlan,
} from '@/components/membership/MembershipCompareBuilder';
import { getConsumerPlanDisplayPerks } from '@/lib/membership-perks';

export const dynamic = 'force-dynamic';

const comparePlans: MembershipComparePlan[] = [
  {
    id: 'otw-basic',
    name: 'OTW BASIC',
    section: 'consumer',
    price: '$99 / month',
    serviceMiles: '60 / month',
    rollover: 'No rollover',
    users: '1',
    billing: 'Pay instantly',
    perks: getConsumerPlanDisplayPerks('OTW BASIC'),
  },
  {
    id: 'otw-plus',
    name: 'OTW PLUS',
    section: 'consumer',
    price: '$169 / month',
    serviceMiles: '120 / month',
    rollover: 'Rollover up to 30',
    users: '1',
    billing: 'Pay instantly',
    perks: getConsumerPlanDisplayPerks('OTW PLUS'),
  },
  {
    id: 'otw-pro',
    name: 'OTW PRO',
    section: 'consumer',
    price: '$269 / month',
    serviceMiles: '200 / month',
    rollover: 'Rollover up to 75',
    users: '1',
    billing: 'Pay instantly',
    perks: getConsumerPlanDisplayPerks('OTW PRO'),
  },
  {
    id: 'otw-elite',
    name: 'OTW ELITE',
    section: 'consumer',
    price: '$429 / month',
    serviceMiles: '350 / month',
    rollover: 'Rollover up to 150',
    users: '1',
    billing: 'Pay instantly',
    perks: getConsumerPlanDisplayPerks('OTW ELITE'),
  },
  {
    id: 'otw-black',
    name: 'OTW BLACK',
    section: 'consumer',
    price: '$699 / month',
    serviceMiles: '600 / month',
    rollover: 'Unlimited rollover',
    users: '1',
    billing: 'Pay instantly',
    perks: getConsumerPlanDisplayPerks('OTW BLACK'),
  },
  {
    id: 'otw-business-core',
    name: 'OTW BUSINESS CORE',
    section: 'business',
    price: '$699 / month',
    serviceMiles: '500 / month',
    rollover: 'Rollover up to 250',
    users: 'Up to 5',
    billing: 'Monthly invoice',
    perks: ['Offices', 'Realtors', 'Clinics', 'Auto dealers'],
  },
  {
    id: 'otw-business-pro',
    name: 'OTW BUSINESS PRO',
    section: 'business',
    price: '$1,199 / month',
    serviceMiles: '1,000 / month',
    rollover: 'Rollover up to 500',
    users: 'Up to 15',
    billing: 'Monthly invoice',
    perks: ['Priority dispatch', 'Dedicated rep', 'Custom rules'],
  },
  {
    id: 'otw-true',
    name: 'OTW TRUE',
    section: 'business',
    price: '$1,499 / month',
    serviceMiles: '1,200 / month',
    rollover: 'Rollover up to 600',
    users: 'Up to 50',
    billing: 'Monthly invoice',
    perks: [
      'Add/remove employees under one membership',
      'Free OTW BASIC home deliveries for all added employees',
      'Free job-site food delivery for employees',
      '2 free rides to/from work per employee each year',
      '2 free roadside assists to/from work per employee each year',
    ],
  },
  {
    id: 'otw-enterprise',
    name: 'OTW ENTERPRISE',
    section: 'business',
    price: 'Custom',
    serviceMiles: 'Custom',
    rollover: 'Custom',
    users: 'Custom',
    billing: 'Contract / SLA',
    perks: ['Guaranteed response times', 'White-label potential', 'Multi-location support'],
  },
];

export default function CompareMembershipsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Compare Memberships</h1>
        <p className="text-sm text-white/70">
          Add two or more plans to compare. Picking one plan auto-loads its full section so you can quickly compare
          all tiers.
        </p>
        <div className="pt-1">
          <Link href="/pricing" className="text-sm font-medium text-otwGold hover:opacity-80">
            Back to pricing
          </Link>
        </div>
      </div>

      <MembershipCompareBuilder plans={comparePlans} />
    </div>
  );
}

