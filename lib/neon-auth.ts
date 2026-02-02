import { createClient } from '@neondatabase/neon-js';
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react/adapters';

export const authClient = createClient({
  auth: {
    adapter: BetterAuthReactAdapter(),
    url: `${process.env.NEXT_PUBLIC_APP_URL!}/api/auth`,
  },
  dataApi: {
    url: 'https://placeholder-until-provided.com', // Placeholder or optional if not using data API yet
  },
});
