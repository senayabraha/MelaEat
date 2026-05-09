import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

export default function RestaurantProfile() {
  const { user } = useOutletContext();
  const { checkUserAuth } = useAuth();
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setForm({
      full_name: user.full_name || '',
      phone: user.phone || '',
    });
  }, [user]);

  const save = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({
        full_name: form.full_name.trim(),
        phone: form.phone,
      });
      await checkUserAuth();
      toast({ title: 'Profile saved' });
    } catch (error) {
      toast({ title: 'Could not save profile', description: error.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-2xl">
      <h1 className="font-display text-3xl font-semibold mb-8">Profile</h1>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-display text-2xl font-bold">
            {(user.full_name || 'R').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-display text-xl font-semibold">{user.full_name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Full name</Label>
          <Input
            value={form.full_name}
            onChange={(event) => setForm({ ...form, full_name: event.target.value })}
            placeholder="Owner or manager name"
          />
        </div>

        <div>
          <Label className="mb-2 block">Phone</Label>
          <Input
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            placeholder="+251 ..."
          />
        </div>

        <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</Button>
      </div>
    </div>
  );
}
