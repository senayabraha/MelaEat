import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { base44, isSupabaseConfigured, supabase } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Logo from '@/components/layout/Logo';

const allowedRoles = new Set(['customer', 'restaurant', 'driver', 'admin']);

const roleLabels = {
  customer: 'customer',
  restaurant: 'restaurant partner',
  driver: 'driver',
  admin: 'admin',
};

const roleDestinations = {
  customer: '/browse',
  restaurant: '/restaurant',
  driver: '/driver',
  admin: '/admin',
};

export default function Login() {
  const { role: routeRole } = useParams();
  const location = useLocation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const requestedRole = params.get('role') || routeRole;
  const selectedRole = allowedRoles.has(requestedRole) ? requestedRole : 'customer';
  const isRecoveryCallback = location.hash.includes('type=recovery') || params.get('type') === 'recovery';
  const initialMode = isRecoveryCallback
    ? 'update-password'
    : location.pathname.startsWith('/reset-password') || params.get('mode') === 'reset'
      ? 'reset'
      : selectedRole !== 'admin' && (
        location.pathname.startsWith('/signup') || params.get('mode') === 'signup' || params.get('mode') === 'sign-up'
      ) ? 'signup' : 'signin';
  const [mode, setMode] = useState(initialMode);
  const [fullName, setFullName] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const hasRedirect = Boolean(params.get('redirect'));
  const isSignupAllowed = selectedRole !== 'admin';
  const isPasswordMode = mode === 'signin' || mode === 'signup' || mode === 'update-password';


  useEffect(() => {
    const processRecoveryLink = async () => {
      if (!location.pathname.startsWith('/reset-password')) return;

      const code = params.get('code');
      const tokenHash = params.get('token_hash');
      const type = params.get('type');

      try {
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          setMode('update-password');
          return;
        }

        if (tokenHash && type === 'recovery') {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });
          if (verifyError) throw verifyError;
          setMode('update-password');
          return;
        }

        if (location.hash.includes('type=recovery')) {
          setMode('update-password');
        }
      } catch (recoveryError) {
        setError(recoveryError.message || 'Recovery link is invalid or expired. Request a new reset email.');
      }
    };

    processRecoveryLink();
  }, [location.hash, location.pathname, params]);

  const redirectTo = useMemo(() => {
    const target = params.get('redirect');
    if (!target) return roleDestinations[selectedRole];

    try {
      const decoded = decodeURIComponent(target);
      if (decoded.startsWith(window.location.origin)) {
        return decoded.replace(window.location.origin, '') || '/';
      }
      if (decoded.startsWith('/')) return decoded;
    } catch {}

    return roleDestinations[selectedRole];
  }, [params, selectedRole]);

  const finishAuth = async () => {
    const currentUser = await base44.auth.me();
    let role = currentUser.role === 'user' ? selectedRole : currentUser.role;

    if (currentUser.role === 'user') {
      if (selectedRole === 'admin') {
        await supabase.auth.signOut();
        throw new Error('Admin accounts must be assigned by an existing admin before sign in.');
      }
      const updated = await base44.users.completeRole(selectedRole);
      role = updated.role;
    }

    if (role !== selectedRole) {
      await supabase.auth.signOut();
      throw new Error(
        `This account is registered as a ${roleLabels[role] || role}. Please use the ${roleLabels[role] || role} login page.`
      );
    }

    if (role === 'restaurant' && !currentUser.restaurant_id) {
      await base44.users.setupRestaurant({
        name: restaurantName.trim() || currentUser.full_name || 'New Restaurant',
      });
    }

    navigate(hasRedirect ? redirectTo : roleDestinations[role] || '/browse', { replace: true });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the app.');
      }

      if (mode === 'reset') {
        const origin = window.location.origin;
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${origin}/reset-password?role=${selectedRole}`,
        });

        if (resetError) throw resetError;
        setMessage('Password reset email sent. Open the link in your email to choose a new password.');
        return;
      }

      if (mode === 'update-password') {
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }

        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }

        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setMessage('Password updated. You can now sign in.');
        setPassword('');
        setConfirmPassword('');
        setMode('signin');
        return;
      }

      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
        await finishAuth();
        return;
      }

      if (!isSignupAllowed) {
        throw new Error('Admin accounts cannot be created from this page.');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }

      if (password !== confirmPassword) {
        throw new Error('Passwords do not match.');
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: selectedRole,
            restaurant_name: restaurantName.trim(),
          },
        },
      });

      if (signUpError) throw signUpError;

      if (data.session) {
        await finishAuth();
        return;
      }

      setMode('signin');
      setPassword('');
      setConfirmPassword('');
      setMessage(`Account created for ${roleLabels[selectedRole]}. Check your email to confirm your address, then sign in.`);
    } catch (submitError) {
      if (submitError instanceof TypeError && submitError.message === 'Failed to fetch') {
        setError('Could not reach Supabase. Check your NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY values, then restart the app or redeploy on Vercel.');
      } else {
        setError(submitError.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h1 className="font-display text-2xl font-semibold mb-2">
            {mode === 'signin'
              ? `${roleLabels[selectedRole]} sign in`
              : mode === 'reset'
                ? `Reset your ${roleLabels[selectedRole]} password`
                : mode === 'update-password'
                  ? 'Choose a new password'
                  : `Create your ${roleLabels[selectedRole]} account`}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === 'signin'
              ? `Continue as a ${roleLabels[selectedRole]}.`
              : mode === 'reset'
                ? 'Enter your email and we will send a secure recovery link.'
                : mode === 'update-password'
                  ? 'Enter a new password for your account.'
                  : `Create your ${roleLabels[selectedRole]} account.`}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <Label className="mb-2 block">Full name</Label>
                  <Input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Senay Abraha"
                    required
                  />
                </div>
                {selectedRole === 'restaurant' && (
                  <div>
                    <Label className="mb-2 block">Restaurant name</Label>
                    <Input
                      value={restaurantName}
                      onChange={(event) => setRestaurantName(event.target.value)}
                      placeholder="MelaEat Kitchen"
                      required
                    />
                  </div>
                )}
              </>
            )}
            <div>
              <Label className="mb-2 block">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required={mode !== 'update-password'}
                disabled={mode === 'update-password'}
              />
            </div>
            {isPasswordMode && (
              <div>
                <Label className="mb-2 block">{mode === 'update-password' ? 'New password' : 'Password'}</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  required
                />
              </div>
            )}
            {(mode === 'signup' || mode === 'update-password') && (
              <div>
                <Label className="mb-2 block">Confirm password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat your password"
                  required
                />
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? mode === 'signin'
                  ? 'Signing in...'
                  : mode === 'reset'
                    ? 'Sending email...'
                    : mode === 'update-password'
                      ? 'Updating password...'
                      : 'Creating account...'
                : mode === 'signin'
                  ? 'Sign in'
                  : mode === 'reset'
                    ? 'Send reset email'
                    : mode === 'update-password'
                      ? 'Update password'
                      : 'Create account'}
            </Button>
          </form>

          {mode !== 'update-password' && isSignupAllowed && (
            <p className="mt-4 text-sm text-muted-foreground">
              {mode === 'signin' ? "Don't have an account yet?" : 'Already have an account?'}{' '}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setError('');
                  setMessage('');
                }}
              >
                {mode === 'signin' ? 'Create one' : 'Sign in'}
              </button>
            </p>
          )}

          {mode === 'signin' && (
            <p className="mt-2 text-xs text-muted-foreground">
              Forgot password? <Link className="text-primary hover:underline" to={`/reset-password/${selectedRole}`}>Reset it</Link>
            </p>
          )}

          {mode === 'signin' && isSignupAllowed && (
            <p className="mt-2 text-xs text-muted-foreground">
              New here? <Link className="text-primary hover:underline" to={`/signup/${selectedRole}`}>Start with sign up</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
