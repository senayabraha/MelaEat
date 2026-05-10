'use client';

import { useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/api/apiClient';
import { roleLabels } from './useFinishAuth';
import { getCallbackOrigin } from './useAuthMode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ResetRequestForm({ authMode, switchMode, initialError }) {
  const { selectedRole } = authMode;
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError || '');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the app.');
      if (!email.trim()) throw new Error('Enter the email address for your account.');
      const redirectTo = `${getCallbackOrigin()}/reset-password/${encodeURIComponent(selectedRole)}`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (resetError) throw resetError;
      setMessage('Password reset email sent. Open the link in your email to choose a new password.');
    } catch (err) {
      setError(err instanceof TypeError && err.message === 'Failed to fetch'
        ? 'Could not reach Supabase. Check your NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY values.'
        : err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="font-display text-2xl font-semibold mb-2">Reset your {roleLabels[selectedRole]} password</h1>
      <p className="text-sm text-muted-foreground mb-6">Enter your email and we will send a secure recovery link.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label className="mb-2 block">Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
        </div>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}
        <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Sending email...' : 'Send reset email'}</Button>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">
        Remembered it?{' '}
        <button type="button" className="font-medium text-primary hover:underline" onClick={() => switchMode('signin')}>Back to sign in</button>
      </p>
    </>
  );
}
