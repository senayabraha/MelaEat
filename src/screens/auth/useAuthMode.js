import { useMemo, useState, useEffect } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/api/apiClient';

const allowedRoles = new Set(['customer', 'restaurant', 'driver', 'admin']);

export const deriveModeFromPath = (pathname) => {
  if (pathname.startsWith('/reset-password')) return 'reset';
  if (pathname.startsWith('/signup')) return 'signup';
  return 'signin';
};

export const getCallbackOrigin = () => {
  const isBrowser = typeof window !== 'undefined';
  const origin = isBrowser ? window.location.origin : '';
  const isLocalhost = isBrowser && /^https?:\/\/(localhost|127\.0\.0\.1)(:|$|\/)/.test(origin);
  const configured = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  if (isLocalhost && configured) return configured;
  if (origin) return origin;
  return configured || 'https://mela-eat.vercel.app';
};

export const useAuthMode = () => {
  const { role: routeRole } = useParams();
  const location = useLocation();
  const [params] = useSearchParams();

  const requestedRole = params.get('role') || routeRole;
  const selectedRole = allowedRoles.has(requestedRole) ? requestedRole : 'customer';

  const hashParams = useMemo(
    () => new URLSearchParams(location.hash.startsWith('#') ? location.hash.slice(1) : location.hash),
    [location.hash]
  );

  const hasRecoveryTokens = Boolean(
    hashParams.get('access_token') && hashParams.get('refresh_token') && hashParams.get('type') === 'recovery'
  );
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
  const [recoveryHandled, setRecoveryHandled] = useState(false);
  const [isProcessingRecovery, setIsProcessingRecovery] = useState(isRecoveryCallback);

  useEffect(() => {
    if (isRecoveryCallback || recoveryHandled || mode === 'update-password') return;
    const next = deriveModeFromPath(location.pathname);
    setMode(next === 'signup' && selectedRole === 'admin' ? 'signin' : next);
  }, [location.pathname, selectedRole, isRecoveryCallback, recoveryHandled, mode]);

  // PASSWORD_RECOVERY fires once supabase-js establishes the session from the link.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update-password');
        setRecoveryHandled(true);
        setIsProcessingRecovery(false);
      }
    });

    // Fallback: if supabase-js consumed the token before our listener attached,
    // an active session on the reset-password path means we should show the form.
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

  return {
    mode, setMode,
    selectedRole,
    params, hashParams, location,
    isRecoveryCallback,
    recoveryHandled, setRecoveryHandled,
    isProcessingRecovery, setIsProcessingRecovery,
  };
};
