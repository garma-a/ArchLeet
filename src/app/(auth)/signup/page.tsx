'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signUp, signInWithGitHub } from '@/actions/auth';

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleEmailSignUp(formData: FormData) {
    setError(null);
    setSuccess(false);
    
    // Check if passwords match
    const password = formData.get('password');
    const confirm = formData.get('confirm_password');
    
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    
    const result = await signUp(formData);
    if (!result.success) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
  }

  async function handleGitHubSignIn() {
    await signInWithGitHub();
  }

  return (
    <div className="p-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
        <p className="text-gray-400">Join ArchLeet to master software architecture.</p>
      </div>

      {success ? (
        <div className="bg-green-500/10 border border-green-500/50 p-6 rounded-md text-center">
          <h3 className="text-green-500 font-medium text-lg mb-2">Check your email</h3>
          <p className="text-gray-300 text-sm">
            We&apos;ve sent you a confirmation link. Please click it to verify your account.
          </p>
        </div>
      ) : (
        <>
          <form action={handleEmailSignUp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="w-full bg-gray-950 border border-gray-700 text-white rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                placeholder="arch_master"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full bg-gray-950 border border-gray-700 text-white rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full bg-gray-950 border border-gray-700 text-white rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                placeholder="••••••••"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="confirm_password">Confirm Password</label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                required
                className="w-full bg-gray-950 border border-gray-700 text-white rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md px-4 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              Sign Up
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between">
            <hr className="w-full border-gray-800" />
            <span className="p-2 text-xs text-gray-500 uppercase tracking-wider">or</span>
            <hr className="w-full border-gray-800" />
          </div>

          <form action={handleGitHubSignIn} className="mt-6">
            <button
              type="submit"
              className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-medium rounded-md px-4 py-2 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Continue with GitHub
            </button>
          </form>
        </>
      )}

      <p className="mt-8 text-center text-sm text-gray-400">
        Already have an account?{' '}
        <Link href="/login" className="text-blue-500 hover:text-blue-400 font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
