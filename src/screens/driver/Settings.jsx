import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

export default function DriverSettings() {
  const { user, refreshUser } = useOutletContext();
  const [online, setOnline] = useState(user.driver_status !== 'offline');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const save = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({
        driver_status: online ? 'online' : 'offline',
      });
      await refreshUser();
      toast({ title: 'Settings saved' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-2xl">
      <h1 className="font-display text-3xl font-semibold mb-8">Settings</h1>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-base">Available for deliveries</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Turn this on when you want pickup offers to appear.
            </p>
          </div>
          <Switch checked={online} onCheckedChange={setOnline} />
        </div>

        <div className="border-t border-border pt-5">
          <p className="text-sm font-medium">{user.full_name}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save settings'}</Button>
          <Button variant="outline" onClick={() => base44.auth.logout()}>Sign out</Button>
        </div>
      </div>
    </div>
  );
}
