import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-black">
      <SignIn routing="path" path="/sign-in" appearance={{ elements: { card: "shadow-xl" } }} />
    </div>
  );
}
