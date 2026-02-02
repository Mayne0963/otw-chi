import { createClient } from '@neondatabase/neon-js';
import { BetterAuthVanillaAdapter } from '@neondatabase/neon-js/auth/vanilla/adapters';
import { headers } from 'next/headers';

// Initialize a server-side client
const serverClient = createClient({
    auth: {
        adapter: BetterAuthVanillaAdapter(),
        url: process.env.NEXT_PUBLIC_NEON_AUTH_URL!,
    },
    dataApi: {
        url: 'https://placeholder-until-provided.com',
    }
});

export async function getNeonSession() {
  try {
    const headersList = await headers();
    // Pass headers to getSession if supported, or rely on automatic handling if library does it.
    // However, the standard vanilla adapter usually requires passing headers manually in server environments if not implicitly handled.
    // Since getSession signature in vanilla client usually expects headers or request object, let's see.
    // The README says: const { data: session } = await client.auth.getSession();
    
    // In server components, we might need to pass headers.
    // For now, let's try the standard call.
    const { data: session } = await serverClient.auth.getSession({
        // @ts-ignore - Headers might not be in type definition but required for server-side auth
        headers: headersList
    });
    return session;
  } catch (error) {
    console.error('Neon Auth Error:', error);
    return null;
  }
}
