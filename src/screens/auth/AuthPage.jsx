'use client';

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthMode } from './useAuthMode';
import Logo from '@/components/layout/Logo';
import RecoveryCallback from './RecoveryCallback';
import SignInForm from './SignInForm';
import SignUpForm from './SignUpForm';
import ResetRequestForm from './ResetRequestForm';
import UpdatePasswordForm from './UpdatePasswordForm';

export default function AuthPage() {
  const authMode = useAuthMode();
  const navigate = useNavigate();
  const { mode, selectedRole, isProcessingRecovery } = authMode;
  const [recoveryError, setRecoveryError] = useState('');
  const [flashMessage, setFlashMessage] = useState('');

  const switchMode = (nextMode, flash) => {
    if (flash) setFlashMessage(flash);
    if (nextMode === 'signup') navigate(`/signup/${selectedRole}`, { replace: false });
    else if (nextMode === 'signin') navigate(`/login/${selectedRole}`, { replace: false });
    else if (nextMode === 'reset') navigate(`/reset-password/${selectedRole}`, { replace: false });
  };

  if (isProcessingRecovery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-8"><Logo /></div>
          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
            <RecoveryCallback authMode={authMode} onError={setRecoveryError} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8"><Logo /></div>
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          {mode === 'signin' && (
            <SignInForm
              authMode={authMode}
              switchMode={switchMode}
              flashMessage={flashMessage}
              onClearFlash={() => setFlashMessage('')}
            />
          )}
          {mode === 'signup' && <SignUpForm authMode={authMode} switchMode={switchMode} />}
          {mode === 'reset' && (
            <ResetRequestForm authMode={authMode} switchMode={switchMode} initialError={recoveryError} />
          )}
          {mode === 'update-password' && <UpdatePasswordForm authMode={authMode} />}
        </div>
      </div>
    </div>
  );
}
