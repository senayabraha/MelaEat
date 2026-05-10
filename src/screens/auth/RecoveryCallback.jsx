'use client';

import { useEffect, useRef } from 'react';
import Logo from '@/components/layout/Logo';
import { supabase } from '@/api/apiClient';

export default function RecoveryCallback({ authMode, onError }) {
  const {
    params, hashParams, location,
    selectedRole,
    recoveryHandled,
    setMode, setRecoveryHandled, setIsProcessingRecovery,
  } = authMode;

  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    let cancelled = false;

    const process = async () => {
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

      if (errorCode || errorDescription) {
        if (cancelled) return;
        const msg = decodeURIComponent(errorDescription || 'Recovery link is invalid or expired. Request a new reset email.').replace(/\+/g, ' ');
        onError(msg);
        setMode('reset');
        setIsProcessingRecovery(false);
        window.history.replaceState({}, document.title, `/reset-password?role=${encodeURIComponent(selectedRole)}`);
        return;
      }

      if (!hasRecoveryParams) {
        if (!cancelled && !recoveryHandled) setIsProcessingRecovery(false);
        return;
      }

      try {
        if (accessToken && refreshToken && hashType === 'recovery') {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash && type === 'recovery') {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
          if (error) throw error;
        }

        if (cancelled) return;
        setMode('update-password');
        setRecoveryHandled(true);
        window.history.replaceState({}, document.title, `/reset-password?role=${encodeURIComponent(selectedRole)}`);
      } catch (err) {
        if (cancelled) return;
        onError(err.message || 'Recovery link is invalid or expired. Request a new reset email.');
        setMode('reset');
      } finally {
        if (!cancelled) setIsProcessingRecovery(false);
      }
    };

    process();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin mx-auto mb-4" />
      <h1 className="font-display text-xl font-semibold mb-2">Validating recovery link...</h1>
      <p className="text-sm text-muted-foreground">Hold on while we verify your password reset request.</p>
    </>
  );
}
