import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { melaeat } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

export default function DriverProfile() {
  const { user, refreshUser } = useOutletContext();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setForm({
      phone: user.phone || '',
      driver_vehicle_type: user.driver_vehicle_type || 'motorbike',
      driver_license_plate: user.driver_license_plate || '',
    });
  }, [user]);

  const save = async () => {
    setSaving(true);
    await melaeat.auth.updateMe(form);
    await refreshUser();
    toast({ title: 'Profile saved' });
    setSaving(false);
  };

  return (
    <div className="p-6 sm:p-8 max-w-2xl">
      <h1 className="font-display text-3xl font-semibold mb-8">Profile</h1>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-display text-2xl font-bold">
            {(user.full_name || 'D').charAt(0)}
          </div>
          <div>
            <p className="font-display text-xl font-semibold">{user.full_name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground mt-1">* {(user.driver_rating || 5).toFixed(1)}  |  {user.driver_total_deliveries || 0} deliveries</p>
          </div>
        </div>
        <div>
          <Label className="mb-2 block">Phone</Label>
          <Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <Label className="mb-2 block">Vehicle type</Label>
          <Select value={form.driver_vehicle_type} onValueChange={(v) => setForm({ ...form, driver_vehicle_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="motorbike">Motorbike</SelectItem>
              <SelectItem value="bicycle">Bicycle</SelectItem>
              <SelectItem value="car">Car</SelectItem>
              <SelectItem value="scooter">Scooter</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-2 block">License plate</Label>
          <Input value={form.driver_license_plate || ''} onChange={(e) => setForm({ ...form, driver_license_plate: e.target.value })} />
        </div>
        <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
      </div>
    </div>
  );
}