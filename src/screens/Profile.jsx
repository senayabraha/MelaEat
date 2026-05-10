import React, { useEffect, useState } from 'react';
import { melaeat } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

export default function Profile() {
  const { user, checkUserAuth } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressText, setAddressText] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    setFullName(user.full_name || '');
    setPhone(user.phone || '');
    setAddressText(user.default_address_text || '');
  }, [user]);

  const save = async () => {
    setSaving(true);
    try {
      await melaeat.auth.updateMe({
        full_name: fullName.trim(),
        phone,
        default_address_text: addressText.trim(),
      });
      await checkUserAuth();
      toast({ title: 'Profile updated' });
    } catch (error) {
      toast({ title: 'Could not save profile', description: error.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
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
            <Label className="mb-2 block">Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <Label className="mb-2 block">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+251 ..." />
          </div>
          <div>
            <Label className="mb-2 block">Default delivery address</Label>
            <Textarea
              value={addressText}
              onChange={(e) => setAddressText(e.target.value)}
              rows={3}
              placeholder="Bole, near Edna Mall..."
            />
          </div>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</Button>
        </div>
      </div>
    </div>
  );
}
