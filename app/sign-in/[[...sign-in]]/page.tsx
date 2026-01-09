import { SignIn } from "@clerk/nextjs";
import { getCurrentUser } from "@/lib/auth/roles";

export default async function Page() {
  const user = await getCurrentUser();
  const baseFallback =
    process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL ??
    process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL ??
    '/dashboard';

  const fallbackRedirectUrl =
    user?.role === "DRIVER"
      ? "/driver"
      : baseFallback;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-black">
      <SignIn
        routing="path"
        path="/sign-in"
        fallbackRedirectUrl={fallbackRedirectUrl}
        appearance={{ elements: { card: "shadow-xl" } }}
      />
    </div>
  );
}
