import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-black">
      <SignUp routing="path" path="/sign-up" appearance={{ elements: { card: "shadow-xl" } }} />
    </div>
  );
}
