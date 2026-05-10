'use client';

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PasswordStrength from '@/components/auth/PasswordStrength';

export default function UpdatePasswordForm({ authMode }) {
  const { selectedRole } = authMode;
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      if (password.length < 8) throw new Error('Password must be at least 8 characters long.');
      if (password !== confirmPassword) throw new Error('Passwords do not match.');
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage('Password updated. Redirecting you to sign in...');
      setPassword('');
      setConfirmPassword('');
      await supabase.auth.signOut();
      setTimeout(() => navigate(`/login/${selectedRole}`, { replace: true }), 800);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="font-display text-2xl font-semibold mb-2">Choose a new password</h1>
      <p className="text-sm text-muted-foreground mb-6">Enter a new password for your account.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label className="mb-2 block">New password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8} autoComplete="new-password" />
          <PasswordStrength password={password} />
        </div>
        <div>
          <Label className="mb-2 block">Confirm password</Label>
          <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your password" required minLength={8} autoComplete="new-password" />
        </div>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}
        <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Updating password...' : 'Update password'}</Button>
      </form>
    </>
  );
}
