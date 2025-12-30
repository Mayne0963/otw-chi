import { SignIn } from "@clerk/nextjs";

export default function Page() {
  const fallbackRedirectUrl =
    process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL ??
    process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL ??
    '/dashboard';

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
