import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Award } from 'lucide-react';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    base44.auth.me().then((u) => {
      setUser(u);
      setPhone(u.phone || '');
    }).catch(() => base44.auth.redirectToLogin(window.location.href));
  }, []);

  const save = async () => {
    setSaving(true);
    await base44.auth.updateMe({ phone });
    toast({ title: 'Profile updated' });
    setSaving(false);
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-display text-3xl font-semibold mb-8">Profile</h1>

      <div className="bg-card border border-border rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-display text-2xl font-bold">
            {(user.full_name || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-display text-xl font-semibold">{user.full_name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+251 ..." />
          </div>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </div>

      <div className="bg-gradient-to-br from-primary/10 to-accent/10 border border-border rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <Award className="w-5 h-5 text-primary" />
          <h2 className="font-display text-xl font-semibold">Loyalty points</h2>
        </div>
        <p className="font-display text-4xl font-bold">{user.loyalty_points || 0}</p>
        <p className="text-sm text-muted-foreground mt-1">Earn points with every order.</p>
      </div>
    </div>
  );
}