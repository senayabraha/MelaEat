'use client';

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

const getCallbackOrigin = () => {
  const isBrowser = typeof window !== 'undefined';
  const origin = isBrowser ? window.location.origin : '';
  const isLocalhost = isBrowser && /^https?:\/\/(localhost|127\.0\.0\.1)(:|$|\/)/.test(origin);
  const configured = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  if (isLocalhost && configured) return configured;
  if (origin) return origin;
  return configured || 'https://mela-eat.vercel.app';
};

const getResetRedirectUrl = (role) => {
  return `${getCallbackOrigin()}/reset-password/${encodeURIComponent(role)}`;
};

const getSignupCallbackUrl = (role) => {
  return `${getCallbackOrigin()}/login/${encodeURIComponent(role)}`;
};

const deriveModeFromPath = (pathname) => {
  if (pathname.startsWith('/reset-password')) return 'reset';
  if (pathname.startsWith('/signup')) return 'signup';
  return 'signin';
};

export default function Login() {
  const { role: routeRole } = useParams();
  const location = useLocation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const requestedRole = params.get('role') || routeRole;
  const selectedRole = allowedRoles.has(requestedRole) ? requestedRole : 'customer';
  const hashParams = useMemo(
    () => new URLSearchParams(location.hash.startsWith('#') ? location.hash.slice(1) : location.hash),
    [location.hash]
  );
  const hasRecoveryTokens = Boolean(hashParams.get('access_token') && hashParams.get('refresh_token') && hashParams.get('type') === 'recovery');
  const hasRecoveryCode = Boolean(params.get('code') || params.get('token_hash'));
  const isRecoveryCallback =
    hasRecoveryTokens
    || hasRecoveryCode
    || location.hash.includes('type=recovery')
    || params.get('type') === 'recovery';

  const pathMode = deriveModeFromPath(location.pathname);
  const initialMode = isRecoveryCallback
    ? 'update-password'
    : selectedRole === 'admin' && pathMode === 'signup'
      ? 'signin'
      : pathMode;

  const [mode, setMode] = useState(initialMode);
  const [fullName, setFullName] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isProcessingRecovery, setIsProcessingRecovery] = useState(isRecoveryCallback);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const hasRedirect = Boolean(params.get('redirect'));
  const isSignupAllowed = selectedRole !== 'admin';
  const isPasswordMode = mode === 'signin' || mode === 'signup' || mode === 'update-password';

  // Once we land in update-password (after successfully processing recovery),
  // we stick there regardless of URL/path changes until the user navigates away.
  const [recoveryHandled, setRecoveryHandled] = useState(false);

  // Keep mode in sync with the URL when the user clicks Sign-up / Sign-in / Reset links.
  // BUT: never overwrite update-password mode (the recovery flow has priority).
  useEffect(() => {
    if (isRecoveryCallback) return;
    if (recoveryHandled) return;
    if (mode === 'update-password') return;
    const next = deriveModeFromPath(location.pathname);
    setMode(next === 'signup' && selectedRole === 'admin' ? 'signin' : next);
    setError('');
    setMessage('');
  }, [location.pathname, selectedRole, isRecoveryCallback, recoveryHandled, mode]);

  // Listen for PASSWORD_RECOVERY events from supabase-js. supabase-js auto-detects
  // the recovery hash/code on page load (detectSessionInUrl=true by default) and
  // fires this event once the session is established. This is the most reliable
  // signal — covers cases where the URL params get consumed before our useEffect runs.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update-password');
        setRecoveryHandled(true);
        setIsProcessingRecovery(false);
        setError('');
      }
    });

    // Fallback: if supabase-js already consumed the recovery token before this
    // component mounted (and fired PASSWORD_RECOVERY before our listener attached),
    // an active session will be present. Treat any session on the reset-password
    // path as a recovery session so we show the new-password form.
    if (location.pathname.startsWith('/reset-password')) {
      supabase.auth.getSession().then(({ data: sessionData }) => {
        if (sessionData.session) {
          setMode('update-password');
          setRecoveryHandled(true);
          setIsProcessingRecovery(false);
        }
      });
    }

    return () => data.subscription.unsubscribe();
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;

    const processRecoveryLink = async () => {
      if (!location.pathname.startsWith('/reset-password')) {
        if (!cancelled) setIsProcessingRecovery(false);
        return;
      }

      const code = params.get('code');
      const tokenHash = params.get('token_hash');
      const type = params.get('type');
      const errorCode = params.get('error_code') || hashParams.get('error_code');
      const errorDescription = params.get('error_description') || hashParams.get('error_description');
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const hashType = hashParams.get('type');
      const hasRecoveryParams = Boolean(
        (accessToken && refreshToken && hashType === 'recovery')
        || code
        || (tokenHash && type === 'recovery')
        || location.hash.includes('type=recovery')
      );

      // Surface Supabase-side errors (expired link, used link, etc.) instead of
      // silently dropping the user back on the email-entry form.
      if (errorCode || errorDescription) {
        if (cancelled) return;
        setError(decodeURIComponent(errorDescription || 'Recovery link is invalid or expired. Request a new reset email.').replace(/\+/g, ' '));
        setMode('reset');
        setIsProcessingRecovery(false);
        // Strip the error params from the URL so a refresh doesn't re-show the error.
        window.history.replaceState({}, document.title, `/reset-password?role=${encodeURIComponent(selectedRole)}`);
        return;
      }

      if (!hasRecoveryParams) {
        // If supabase-js already auto-consumed the hash, an active session +
        // PASSWORD_RECOVERY event will set update-password via the listener above.
        // Otherwise, drop into reset-request mode.
        if (!cancelled && !recoveryHandled) setIsProcessingRecovery(false);
        return;
      }

      setIsProcessingRecovery(true);

      try {
        if (accessToken && refreshToken && hashType === 'recovery') {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        } else if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if (tokenHash && type === 'recovery') {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });
          if (verifyError) throw verifyError;
        }

        if (cancelled) return;
        setMode('update-password');
        setRecoveryHandled(true);
        const cleanUrl = `/reset-password?role=${encodeURIComponent(selectedRole)}`;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (recoveryError) {
        if (cancelled) return;
        setError(recoveryError.message || 'Recovery link is invalid or expired. Request a new reset email.');
        setMode('reset');
      } finally {
        if (!cancelled) setIsProcessingRecovery(false);
      }
    };

    processRecoveryLink();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.hash, params.toString(), hashParams.toString(), selectedRole]);

  const redirectTo = useMemo(() => {
    const target = params.get('redirect');
    if (!target) return roleDestinations[selectedRole];

    try {
      const decoded = decodeURIComponent(target);
      if (typeof window !== 'undefined' && decoded.startsWith(window.location.origin)) {
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

    if (role !== selectedRole && !(selectedRole === 'customer' && role === 'admin')) {
      // Allow admins to sign in via any role-tab and route them to admin dashboard,
      // but block role mismatch for everyone else.
      if (role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error(
          `This account is registered as a ${roleLabels[role] || role}. Please use the ${roleLabels[role] || role} login page.`
        );
      }
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
        if (!email.trim()) throw new Error('Enter the email address for your account.');
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: getResetRedirectUrl(selectedRole),
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
        setMessage('Password updated. Redirecting you to sign in...');
        setPassword('');
        setConfirmPassword('');
        // Sign out so they re-enter credentials with the new password.
        await supabase.auth.signOut();
        setTimeout(() => navigate(`/login/${selectedRole}`, { replace: true }), 800);
        return;
      }

      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) throw signInError;
        await finishAuth();
        return;
      }

      // signup
      if (!isSignupAllowed) {
        throw new Error('Admin accounts cannot be created from this page.');
      }

      if (!fullName.trim()) {
        throw new Error('Enter your full name.');
      }

      if (selectedRole === 'restaurant' && !restaurantName.trim()) {
        throw new Error('Enter your restaurant name.');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }

      if (password !== confirmPassword) {
        throw new Error('Passwords do not match.');
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: getSignupCallbackUrl(selectedRole),
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

      navigate(`/login/${selectedRole}`, { replace: true });
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

  const switchMode = (nextMode) => {
    setError('');
    setMessage('');
    if (nextMode === 'signup') {
      navigate(`/signup/${selectedRole}`, { replace: false });
    } else if (nextMode === 'signin') {
      navigate(`/login/${selectedRole}`, { replace: false });
    } else if (nextMode === 'reset') {
      navigate(`/reset-password/${selectedRole}`, { replace: false });
    }
  };

  // While the recovery callback is being processed, render a dedicated screen
  // so the user never sees the email-entry form flash before the new-password form.
  if (isProcessingRecovery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-8">
            <Logo />
          </div>
          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin mx-auto mb-4" />
            <h1 className="font-display text-xl font-semibold mb-2">Validating recovery link...</h1>
            <p className="text-sm text-muted-foreground">Hold on while we verify your password reset request.</p>
          </div>
        </div>
      </div>
    );
  }

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
                    autoComplete="name"
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
                      autoComplete="organization"
                    />
                  </div>
                )}
              </>
            )}
            {mode !== 'update-password' && (
              <div>
                <Label className="mb-2 block">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
            )}
            {isPasswordMode && (
              <div>
                <Label className="mb-2 block">{mode === 'update-password' ? 'New password' : 'Password'}</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
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
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
            )}
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}
            <Button type="submit" className="w-full" disabled={loading || isProcessingRecovery}>
              {loading
                ? mode === 'signin'
                  ? 'Signing in...'
                  : mode === 'reset'
                    ? 'Sending email...'
                    : mode === 'update-password'
                      ? 'Updating password...'
                      : 'Creating account...'
                : isProcessingRecovery
                  ? 'Validating recovery link...'
                : mode === 'signin'
                  ? 'Sign in'
                  : mode === 'reset'
                    ? 'Send reset email'
                    : mode === 'update-password'
                      ? 'Update password'
                      : 'Create account'}
            </Button>
          </form>

          {mode !== 'update-password' && mode !== 'reset' && isSignupAllowed && (
            <p className="mt-4 text-sm text-muted-foreground">
              {mode === 'signin' ? "Don't have an account yet?" : 'Already have an account?'}{' '}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
              >
                {mode === 'signin' ? 'Create one' : 'Sign in'}
              </button>
            </p>
          )}

          {mode === 'reset' && (
            <p className="mt-4 text-sm text-muted-foreground">
              Remembered it?{' '}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => switchMode('signin')}
              >
                Back to sign in
              </button>
            </p>
          )}

          {mode === 'signin' && (
            <p className="mt-2 text-xs text-muted-foreground">
              Forgot password?{' '}
              <Link className="text-primary hover:underline" to={`/reset-password/${selectedRole}`}>
                Reset it
              </Link>
            </p>
          )}

          {mode === 'signin' && isSignupAllowed && (
            <p className="mt-2 text-xs text-muted-foreground">
              New here?{' '}
              <Link className="text-primary hover:underline" to={`/signup/${selectedRole}`}>
                Start with sign up
              </Link>
            </p>
          )}

          {/* Role switcher so users on the wrong page can move without typing the URL. */}
          {(mode === 'signin' || mode === 'signup') && (
            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Looking for a different account type?</p>
              <div className="flex flex-wrap gap-2">
                {['customer', 'restaurant', 'driver']
                  .filter((r) => r !== selectedRole)
                  .map((r) => (
                    <Link
                      key={r}
                      to={`/${mode === 'signup' ? 'signup' : 'login'}/${r}`}
                      className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-secondary transition-colors capitalize"
                    >
                      {roleLabels[r]}
                    </Link>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
