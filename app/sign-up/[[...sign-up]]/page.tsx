'use client';
import { AuthView } from '@neondatabase/neon-js/auth/react';
import Link from 'next/link';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-otwBlack relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-otwGold/5 blur-[100px]" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-otwBlue/5 blur-[100px]" />

      <div className="w-full max-w-md z-10 space-y-8">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block">
            <h1 className="text-4xl font-display font-bold text-otwGold tracking-tight">
              OTW
            </h1>
          </Link>
          <p className="text-otwOffWhite/60 text-sm tracking-wide uppercase">
            Join the inner circle
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-1 shadow-2xl">
          <div className="bg-otwBlack/50 rounded-xl p-6">
             <AuthView view={"SIGN_UP"} />
          </div>
        </div>
        
        <div className="text-center">
            <p className="text-xs text-otwOffWhite/40">
                By signing up, you agree to our Terms of Service and Privacy Policy.
            </p>
        </div>
      </div>
    </div>
  );
}
