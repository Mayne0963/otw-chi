import { SignUp } from "@clerk/nextjs";

export default function Page() {
  const fallbackRedirectUrl =
    process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL ??
    process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL ??
    '/onboarding';

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-black">
      <SignUp
        routing="path"
        path="/sign-up"
        fallbackRedirectUrl={fallbackRedirectUrl}
        appearance={{ elements: { card: "shadow-xl" } }}
      />
    </div>
  );
}
