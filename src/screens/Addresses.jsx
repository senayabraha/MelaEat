import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Trash2, MapPin } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import MapPicker from '@/components/customer/MapPicker';

const hasCoordinate = (value) => value !== null && value !== undefined && Number.isFinite(Number(value));

export default function Addresses() {
  const { user, checkUserAuth } = useAuth();
  const [form, setForm] = useState({
    default_address_text: '',
    default_lat: null,
    default_lng: null,
  });
  const [saving, setSaving] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    setForm({
      default_address_text: user.default_address_text || '',
      default_lat: hasCoordinate(user.default_lat) ? Number(user.default_lat) : null,
      default_lng: hasCoordinate(user.default_lng) ? Number(user.default_lng) : null,
    });
    setSavedAddresses(Array.isArray(user.saved_addresses) ? user.saved_addresses : []);
  }, [user]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        default_address_text: form.default_address_text.trim(),
        default_lat: form.default_lat,
        default_lng: form.default_lng,
        saved_addresses: savedAddresses,
      };
      await base44.auth.updateMe(payload);
      await checkUserAuth();
      toast({ title: 'Delivery location updated' });
    } catch (error) {
      toast({ title: 'Could not save address', description: error.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: 'Geolocation not supported', variant: 'destructive' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, default_lat: pos.coords.latitude, default_lng: pos.coords.longitude }));
        toast({ title: 'Location set from GPS' });
      },
      () => toast({ title: 'Could not get location', variant: 'destructive' }),
      { timeout: 8000, maximumAge: 60000 }
    );
  };

  const addCurrentAddress = () => {
    const text = form.default_address_text.trim();
    if (!text) {
      toast({ title: 'Address text is required', variant: 'destructive' });
      return;
    }
    const next = [
      { label: text, address_text: text, lat: form.default_lat, lng: form.default_lng },
      ...savedAddresses.filter((a) => a.address_text !== text),
    ].slice(0, 10);
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
          <div className="flex items-center justify-between mb-2">
            <Label>Drop a pin on the map</Label>
            <button onClick={useCurrentLocation} className="text-xs font-medium text-primary flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> Use current location
            </button>
          </div>
          <MapPicker
            lat={form.default_lat}
            lng={form.default_lng}
            onChange={(lat, lng) => setForm((f) => ({ ...f, default_lat: lat, default_lng: lng }))}
          />
          <p className="text-xs text-muted-foreground mt-2">Tap the map to place your default delivery pin.</p>
        </div>

        <div>
          <Label className="mb-2 block">Address details (building, landmark)</Label>
          <Textarea
            value={form.default_address_text}
            onChange={(event) => setForm((f) => ({ ...f, default_address_text: event.target.value }))}
            rows={3}
            placeholder="Bole, near Edna Mall, house number..."
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={save} disabled={saving} className="flex-1">
            {saving ? 'Saving…' : 'Save as default'}
          </Button>
          <Button variant="outline" onClick={addCurrentAddress}>Save to address book</Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-3 mt-6">
        <h2 className="font-display text-xl font-semibold">Saved addresses</h2>
        {savedAddresses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No saved addresses yet.</p>
        ) : savedAddresses.map((a, idx) => (
          <div key={`${a.address_text}-${idx}`} className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2">
            <button
              className="text-left flex-1"
              onClick={() => setForm({ default_address_text: a.address_text || '', default_lat: a.lat ?? null, default_lng: a.lng ?? null })}
            >
              <p className="text-sm font-medium">{a.label || a.address_text}</p>
              {a.address_text !== a.label && (
                <p className="text-xs text-muted-foreground">{a.address_text}</p>
              )}
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
