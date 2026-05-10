'use client';

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '@/api/apiClient';
import { useFinishAuth, roleLabels } from './useFinishAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const otherRoles = { customer: 'customer', restaurant: 'restaurant partner', driver: 'driver' };

export default function SignInForm({ authMode, switchMode, flashMessage, onClearFlash }) {
  const { selectedRole, params } = authMode;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { finishAuth } = useFinishAuth({ selectedRole, params });
  const isSignupAllowed = selectedRole !== 'admin';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (flashMessage) onClearFlash();
    setLoading(true);
    setError('');
    try {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the app.');
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw signInError;
      await finishAuth();
    } catch (err) {
      setError(err instanceof TypeError && err.message === 'Failed to fetch'
        ? 'Could not reach Supabase. Check your NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY values, then restart the app or redeploy on Vercel.'
        : err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="font-display text-2xl font-semibold mb-2">{roleLabels[selectedRole]} sign in</h1>
      <p className="text-sm text-muted-foreground mb-6">Continue as a {roleLabels[selectedRole]}.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label className="mb-2 block">Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
        </div>
        <div>
          <Label className="mb-2 block">Password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8} autoComplete="current-password" />
        </div>
        {flashMessage && <p className="text-sm text-muted-foreground" role="status">{flashMessage}</p>}
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</Button>
      </form>
      {isSignupAllowed && (
        <p className="mt-4 text-sm text-muted-foreground">
          Don&apos;t have an account yet?{' '}
          <button type="button" className="font-medium text-primary hover:underline" onClick={() => switchMode('signup')}>Create one</button>
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Forgot password?{' '}
        <Link className="text-primary hover:underline" to={`/reset-password/${selectedRole}`}>Reset it</Link>
      </p>
      {isSignupAllowed && (
        <p className="mt-2 text-xs text-muted-foreground">
          New here?{' '}
          <Link className="text-primary hover:underline" to={`/signup/${selectedRole}`}>Start with sign up</Link>
        </p>
      )}
      <div className="mt-6 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground mb-2">Looking for a different account type?</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(otherRoles).filter(([r]) => r !== selectedRole).map(([r, label]) => (
            <Link key={r} to={`/login/${r}`} className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-secondary transition-colors capitalize">{label}</Link>
          ))}
        </div>
      </div>
    </>
  );
}
