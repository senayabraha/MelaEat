import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

export default function Addresses() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    default_address_text: '',
    default_lat: '',
    default_lng: '',
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    base44.auth.me()
      .then((currentUser) => {
        setUser(currentUser);
        setForm({
          default_address_text: currentUser.default_address_text || '',
          default_lat: currentUser.default_lat ?? '',
          default_lng: currentUser.default_lng ?? '',
        });
      })
      .catch(() => base44.auth.redirectToLogin(window.location.href));
  }, []);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({
        default_address_text: form.default_address_text.trim(),
        default_lat: form.default_lat === '' ? null : Number(form.default_lat),
        default_lng: form.default_lng === '' ? null : Number(form.default_lng),
      });
      toast({ title: 'Delivery location updated' });
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-display text-3xl font-semibold mb-2">Delivery address</h1>
      <p className="text-muted-foreground mb-8">Save the location you want checkout to prefill for you.</p>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div>
          <Label className="mb-2 block">Address</Label>
          <Textarea
            value={form.default_address_text}
            onChange={(event) => updateField('default_address_text', event.target.value)}
            rows={4}
            placeholder="Bole, near Edna Mall, house number..."
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="mb-2 block">Latitude</Label>
            <Input
              value={form.default_lat}
              onChange={(event) => updateField('default_lat', event.target.value)}
              placeholder="8.9806"
            />
          </div>
          <div>
            <Label className="mb-2 block">Longitude</Label>
            <Input
              value={form.default_lng}
              onChange={(event) => updateField('default_lng', event.target.value)}
              placeholder="38.7578"
            />
          </div>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save address'}
        </Button>
      </div>
    </div>
  );
}
