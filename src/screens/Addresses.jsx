import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Trash2 } from 'lucide-react';

export default function Addresses() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    default_address_text: '',
    default_lat: '',
    default_lng: '',
  });
  const [saving, setSaving] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
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
        setSavedAddresses(Array.isArray(currentUser.saved_addresses) ? currentUser.saved_addresses : []);
      })
      .catch(() => base44.auth.redirectToLogin(window.location.href));
  }, []);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        default_address_text: form.default_address_text.trim(),
        default_lat: form.default_lat === '' ? null : Number(form.default_lat),
        default_lng: form.default_lng === '' ? null : Number(form.default_lng),
        saved_addresses: savedAddresses,
      };
      await base44.auth.updateMe(payload);
      toast({ title: 'Delivery location updated' });
    } catch (error) {
      toast({ title: 'Could not save address', description: error.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const addCurrentAddress = () => {
    const text = form.default_address_text.trim();
    if (!text) {
      toast({ title: 'Address is required', variant: 'destructive' });
      return;
    }
    const latNum = form.default_lat === '' ? null : Number(form.default_lat);
    const lngNum = form.default_lng === '' ? null : Number(form.default_lng);
    const next = [{ label: text, address_text: text, lat: latNum, lng: lngNum }, ...savedAddresses.filter((a) => a.address_text !== text)].slice(0, 10);
    setSavedAddresses(next);
    toast({ title: 'Address added to saved list' });
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
        <Button variant="outline" onClick={addCurrentAddress}>Save to address book</Button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-3 mt-6">
        <h2 className="font-display text-xl font-semibold">Saved addresses</h2>
        {savedAddresses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No saved addresses yet.</p>
        ) : savedAddresses.map((a, idx) => (
          <div key={`${a.address_text}-${idx}`} className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2">
            <button
              className="text-left flex-1"
              onClick={() => setForm({ default_address_text: a.address_text || '', default_lat: a.lat ?? '', default_lng: a.lng ?? '' })}
            >
              <p className="text-sm font-medium">{a.label || a.address_text}</p>
              <p className="text-xs text-muted-foreground">{a.address_text}</p>
            </button>
            <Button variant="ghost" size="icon" onClick={() => setSavedAddresses(savedAddresses.filter((_, i) => i !== idx))}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
