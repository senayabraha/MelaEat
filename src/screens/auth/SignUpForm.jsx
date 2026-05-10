'use client';

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '@/api/apiClient';
import { useFinishAuth, roleLabels } from './useFinishAuth';
import { getCallbackOrigin } from './useAuthMode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PasswordStrength from '@/components/auth/PasswordStrength';

const otherRoles = { customer: 'customer', restaurant: 'restaurant partner', driver: 'driver' };

export default function SignUpForm({ authMode, switchMode }) {
  const { selectedRole, params } = authMode;
  const [fullName, setFullName] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { finishAuth } = useFinishAuth({ selectedRole, restaurantName, params });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the app.');
      if (!fullName.trim()) throw new Error('Enter your full name.');
      if (selectedRole === 'restaurant' && !restaurantName.trim()) throw new Error('Enter your restaurant name.');
      if (password.length < 8) throw new Error('Password must be at least 8 characters long.');
      if (password !== confirmPassword) throw new Error('Passwords do not match.');

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: {
          emailRedirectTo: `${getCallbackOrigin()}/login/${encodeURIComponent(selectedRole)}`,
          data: { full_name: fullName.trim(), role: selectedRole, restaurant_name: restaurantName.trim() },
        },
      });
      if (signUpError) throw signUpError;

      if (data.session) { await finishAuth(); return; }

      switchMode('signin', `Account created for ${roleLabels[selectedRole]}. Check your email to confirm your address, then sign in.`);
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
      <h1 className="font-display text-2xl font-semibold mb-2">Create your {roleLabels[selectedRole]} account</h1>
      <p className="text-sm text-muted-foreground mb-6">Create your {roleLabels[selectedRole]} account.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label className="mb-2 block">Full name</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Senay Abraha" required autoComplete="name" />
        </div>
        {selectedRole === 'restaurant' && (
          <div>
            <Label className="mb-2 block">Restaurant name</Label>
            <Input value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} placeholder="MelaEat Kitchen" required autoComplete="organization" />
          </div>
        )}
        <div>
          <Label className="mb-2 block">Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
        </div>
        <div>
          <Label className="mb-2 block">Password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8} autoComplete="new-password" />
          <PasswordStrength password={password} />
        </div>
        <div>
          <Label className="mb-2 block">Confirm password</Label>
          <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your password" required minLength={8} autoComplete="new-password" />
        </div>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Creating account...' : 'Create account'}</Button>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">
        Already have an account?{' '}
        <button type="button" className="font-medium text-primary hover:underline" onClick={() => switchMode('signin')}>Sign in</button>
      </p>
      <div className="mt-6 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground mb-2">Looking for a different account type?</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(otherRoles).filter(([r]) => r !== selectedRole).map(([r, label]) => (
            <Link key={r} to={`/signup/${r}`} className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-secondary transition-colors capitalize">{label}</Link>
          ))}
        </div>
      </div>
    </>
  );
}
