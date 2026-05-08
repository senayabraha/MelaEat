import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Upload } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const DAYS = [
  { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' }, { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' }, { key: 'fri', label: 'Fri' }, { key: 'sat', label: 'Sat' }, { key: 'sun', label: 'Sun' },
];

export default function RestaurantSettings() {
  const { user } = useOutletContext();
  const [restaurant, setRestaurant] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      let res = await base44.entities.Restaurant.filter({ owner_email: user.email });
      if (res.length === 0 && user.restaurant_id) res = [await base44.entities.Restaurant.get(user.restaurant_id)];
      const r = res[0];
      setRestaurant(r);
      setForm(r || {});
    })();
  }, [user.email]);

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.Restaurant.update(restaurant.id, form);
      toast({ title: 'Settings saved' });
    } catch (error) {
      toast({ title: 'Could not save settings', description: error.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const upload = async (key, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm({ ...form, [key]: file_url });
      toast({ title: 'Image uploaded' });
    } catch (error) {
      toast({ title: 'Upload failed', description: error.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const setHours = (day, field, val) => {
    setForm({
      ...form,
      operating_hours: { ...(form.operating_hours || {}), [day]: { ...(form.operating_hours?.[day] || {}), [field]: val } }
    });
  };

  if (!restaurant) return null;

  return (
    <div className="p-6 sm:p-8 max-w-4xl">
      <h1 className="font-display text-3xl font-semibold mb-8">Settings</h1>

      <div className="space-y-6">
        <Section title="Brand">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-20 h-20 rounded-xl bg-secondary overflow-hidden">
              {form.logo_url && <img src={form.logo_url} alt="" className="w-full h-full object-cover" />}
            </div>
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-secondary text-sm">
              <Upload className="w-4 h-4" /> Logo
              <input type="file" hidden accept="image/*" onChange={(e) => upload('logo_url', e)} />
            </label>
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-secondary text-sm">
              <Upload className="w-4 h-4" /> Cover
              <input type="file" hidden accept="image/*" onChange={(e) => upload('cover_image_url', e)} />
            </label>
          </div>
          <Field label="Name"><Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Description"><Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></Field>
          <Field label="Cuisines (comma-separated)">
            <Input
              value={(form.cuisines || []).join(', ')}
              onChange={(e) => setForm({ ...form, cuisines: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            />
          </Field>
        </Section>

        <Section title="Location & contact">
          <div className="grid grid-cols-2 gap-3">
            <Field label="City"><Input value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="Phone"><Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
          <Field label="Address"><Input value={form.address_text || ''} onChange={(e) => setForm({ ...form, address_text: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude"><Input type="number" step="any" value={form.lat || ''} onChange={(e) => setForm({ ...form, lat: Number(e.target.value) })} /></Field>
            <Field label="Longitude"><Input type="number" step="any" value={form.lng || ''} onChange={(e) => setForm({ ...form, lng: Number(e.target.value) })} /></Field>
          </div>
        </Section>

        <Section title="Operations">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Delivery fee (ETB)"><Input type="number" value={form.delivery_fee || 0} onChange={(e) => setForm({ ...form, delivery_fee: Number(e.target.value) })} /></Field>
            <Field label="Min. order (ETB)"><Input type="number" value={form.minimum_order || 0} onChange={(e) => setForm({ ...form, minimum_order: Number(e.target.value) })} /></Field>
            <Field label="Prep time (min)"><Input type="number" value={form.estimated_prep_minutes || 25} onChange={(e) => setForm({ ...form, estimated_prep_minutes: Number(e.target.value) })} /></Field>
          </div>
        </Section>

        <Section title="Operating hours">
          <div className="space-y-2">
            {DAYS.map(d => {
              const h = form.operating_hours?.[d.key] || {};
              return (
                <div key={d.key} className="flex items-center gap-3">
                  <span className="w-12 text-sm font-medium">{d.label}</span>
                  <Switch checked={!h.closed} onCheckedChange={(v) => setHours(d.key, 'closed', !v)} />
                  <Input type="time" value={h.open || '09:00'} onChange={(e) => setHours(d.key, 'open', e.target.value)} disabled={h.closed} className="w-32" />
                  <span className="text-muted-foreground text-sm">to</span>
                  <Input type="time" value={h.close || '22:00'} onChange={(e) => setHours(d.key, 'close', e.target.value)} disabled={h.closed} className="w-32" />
                </div>
              );
            })}
          </div>
        </Section>

        <Button onClick={save} disabled={saving} className="w-full sm:w-auto">{saving ? 'Saving…' : 'Save changes'}</Button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h2 className="font-display text-xl font-semibold mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div>
      <Label className="mb-2 block text-sm">{label}</Label>
      {children}
    </div>
  );
}
