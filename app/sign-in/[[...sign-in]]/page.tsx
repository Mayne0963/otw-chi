'use client';
import { AuthView, authViewPaths } from '@neondatabase/neon-js/auth/react';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-black">
       <AuthView view={"SIGN_IN"} />
    </div>
  );
}
