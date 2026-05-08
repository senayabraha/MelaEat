import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useCart } from '@/lib/cart';
import { formatETB, isOpenNow } from '@/lib/format';
import { useToast } from '@/components/ui/use-toast';
import MapPicker from '@/components/customer/MapPicker';
import { MapPin, Loader2 } from 'lucide-react';

export default function Checkout() {
  const { cart, subtotal, clear, itemCount } = useCart();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [phone, setPhone] = useState('');
  const [addressText, setAddressText] = useState('');
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [deliveryMode, setDeliveryMode] = useState('now');
  const [scheduledTime, setScheduledTime] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [savedAddresses, setSavedAddresses] = useState([]);

  useEffect(() => {
    if (itemCount === 0) navigate('/browse');
  }, [itemCount, navigate]);

  useEffect(() => {
    base44.auth.isAuthenticated().then(async (a) => {
      if (a) {
        const me = await base44.auth.me();
        setUser(me);
        setPhone(me.phone || '');
        if (me.default_lat) setLat(me.default_lat);
        if (me.default_lng) setLng(me.default_lng);
        if (me.default_address_text) setAddressText(me.default_address_text);
        setSavedAddresses(Array.isArray(me.saved_addresses) ? me.saved_addresses : []);
      }
    });
  }, []);

  const { data: restaurant, isLoading: restaurantLoading } = useQuery({
    queryKey: ['restaurant', cart.restaurant_id],
    queryFn: () => base44.entities.Restaurant.get(cart.restaurant_id),
    enabled: !!cart.restaurant_id,
  });

  const deliveryFee = restaurant?.delivery_fee || 0;
  const discount = appliedPromo
    ? appliedPromo.discount_type === 'percentage'
      ? Math.round((subtotal * appliedPromo.discount_value) / 100)
      : appliedPromo.discount_type === 'fixed'
      ? appliedPromo.discount_value
      : 0
    : 0;
  const freeDelivery = appliedPromo?.discount_type === 'free_delivery';
  const total = Math.max(0, subtotal + (freeDelivery ? 0 : deliveryFee) - discount);
  const belowMinimum = !!restaurant?.minimum_order && subtotal < restaurant.minimum_order;

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: 'Geolocation not supported', variant: 'destructive' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        toast({ title: 'Location set' });
      },
      () => toast({ title: 'Could not get location', variant: 'destructive' })
    );
  };

  const applyPromo = async () => {
    if (!promoCode.trim()) return;
    const res = await base44.entities.Promotion.filter({ code: promoCode.trim().toUpperCase(), is_active: true });
    if (res.length === 0) {
      toast({ title: 'Invalid promo code', variant: 'destructive' });
      return;
    }
    const promo = res[0];
    if (promo.min_order && subtotal < promo.min_order) {
      toast({ title: `Minimum order ${formatETB(promo.min_order)} required`, variant: 'destructive' });
      return;
    }
    setAppliedPromo(promo);
    toast({ title: 'Promo applied', description: promo.title || promo.code });
  };

  const statusReason = useMemo(() => {
    if (!restaurant || restaurantLoading) return null;
    if (restaurant.status === 'suspended') return 'This restaurant is temporarily suspended.';
    if (restaurant.status === 'paused') return 'The restaurant has paused incoming orders.';
    if (!isOpenNow(restaurant)) return 'The restaurant is currently outside operating hours.';
    return null;
  }, [restaurant]);

  const handlePlaceOrder = async () => {
    if (!user) {
      base44.auth.redirectToLogin(window.location.href);
      return;
    }
    const nextErrors = {};
    if (!phone.trim()) nextErrors.phone = 'Phone number is required.';
    if (!lat || !lng) nextErrors.location = 'Please place a delivery pin on the map.';
    if (deliveryMode === 'schedule' && !scheduledTime) nextErrors.scheduledTime = 'Please pick a delivery date and time.';
    if (!restaurantLoading && statusReason) nextErrors.restaurant = statusReason;
    if (!restaurantLoading && belowMinimum) nextErrors.minimumOrder = `Minimum order is ${formatETB(restaurant.minimum_order)}.`;

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast({ title: 'Please fix the highlighted fields', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        customer_phone: phone,
        restaurant_id: cart.restaurant_id,
        items: cart.items.map((it) => ({
          menu_item_id: it.menu_item_id,
          quantity: it.quantity,
          selected_options: it.selected_options,
          notes: it.notes,
        })),
        promo_code: appliedPromo?.code,
        payment_method: paymentMethod,
        delivery_lat: lat,
        delivery_lng: lng,
        delivery_address_text: addressText,
        delivery_notes: notes,
        is_scheduled: deliveryMode === 'schedule',
        scheduled_for: deliveryMode === 'schedule' ? new Date(scheduledTime).toISOString() : null,
      };
      const { order: created } = await base44.orders.create(payload);
      clear();
      navigate(`/order/${created.id}`);
    } catch (error) {
      toast({
        title: 'Could not place order',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const minScheduled = new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-display text-3xl font-semibold mb-8">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
        {/* Delivery timing */}
        <section className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold mb-4">When?</h2>
          <Tabs value={deliveryMode} onValueChange={setDeliveryMode}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="now">Deliver now</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
            </TabsList>
            <TabsContent value="now" className="text-sm text-muted-foreground mt-3">
              Estimated arrival in {(restaurant?.estimated_prep_minutes || 25) + 20} minutes.
            </TabsContent>
            <TabsContent value="schedule" className="mt-3">
              <Label className="mb-2 block">Pick date & time</Label>
              <Input
                type="datetime-local"
                min={minScheduled}
                value={scheduledTime}
                onChange={(e) => {
                  setScheduledTime(e.target.value);
                  setErrors((prev) => ({ ...prev, scheduledTime: undefined }));
                }}
              />
            </TabsContent>
          </Tabs>
          {errors.scheduledTime && <p className="text-sm text-destructive mt-2">{errors.scheduledTime}</p>}
        </section>

        {/* Contact + address */}
        <section className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold mb-4">Delivery details</h2>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Phone number</Label>
              <Input value={phone} onChange={(e) => { setPhone(e.target.value); setErrors((prev) => ({ ...prev, phone: undefined })); }} placeholder="+251 ..." />
              {errors.phone && <p className="text-sm text-destructive mt-2">{errors.phone}</p>}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Delivery location (drop a pin)</Label>
                <button onClick={useCurrentLocation} className="text-xs font-medium text-primary flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Use current
                </button>
              </div>
              <MapPicker
                lat={lat}
                lng={lng}
                onChange={(la, ln) => {
                  setLat(la);
                  setLng(ln);
                  setErrors((prev) => ({ ...prev, location: undefined }));
                }}
              />
              <p className="text-xs text-muted-foreground mt-2">Tap the map to place your pin.</p>
              {errors.location && <p className="text-sm text-destructive mt-2">{errors.location}</p>}
            </div>
            <div>
              <Label className="mb-2 block">Address details (building, landmark)</Label>
              <Input value={addressText} onChange={(e) => setAddressText(e.target.value)} placeholder="e.g. Bole, near Edna Mall" />
              {savedAddresses.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {savedAddresses.map((a, i) => (
                    <Button key={`${a.address_text}-${i}`} type="button" size="sm" variant="outline" onClick={() => {
                      setAddressText(a.address_text || '');
                      if (a.lat) setLat(a.lat);
                      if (a.lng) setLng(a.lng);
                    }}>
                      {a.label || `Address ${i + 1}`}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label className="mb-2 block">Delivery notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Gate code, floor, etc."
                rows={2}
              />
            </div>
          </div>
        </section>

        {/* Payment */}
        <section className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold mb-4">Payment</h2>
          <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-2">
            {[
              { v: 'cash', label: 'Cash on delivery' },
              { v: 'telebirr', label: 'Telebirr', disabled: true },
              { v: 'card', label: 'Card', disabled: true },
            ].map((p) => (
              <label key={p.v} className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition ${
                p.disabled
                  ? 'cursor-not-allowed opacity-55'
                  : paymentMethod === p.v
                    ? 'cursor-pointer border-foreground bg-secondary'
                    : 'cursor-pointer border-border'
              }`}>
                <RadioGroupItem value={p.v} disabled={p.disabled} />
                <span className="text-sm font-medium">
                  {p.label}
                  {p.disabled && <span className="ml-2 text-xs text-muted-foreground">Coming soon</span>}
                </span>
              </label>
            ))}
          </RadioGroup>
        </section>

        {/* Promo */}
        <section className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold mb-4">Promo code</h2>
          <div className="flex gap-2">
            <Input value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="Enter code" />
            <Button variant="outline" onClick={applyPromo}>Apply</Button>
          </div>
          {appliedPromo && (
            <p className="text-sm text-success mt-2">{appliedPromo.code} applied</p>
          )}
        </section>

        </div>

        {/* Summary */}
        <section className="bg-card border border-border rounded-2xl p-6 lg:sticky lg:top-24 h-fit">
          <h2 className="font-display text-xl font-semibold mb-4">Order summary</h2>
          {errors.restaurant && <p className="text-sm text-destructive mb-3">{errors.restaurant}</p>}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatETB(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Delivery fee</span><span>{freeDelivery ? <span className="text-success">Free</span> : formatETB(deliveryFee)}</span></div>
            {discount > 0 && (
              <div className="flex justify-between text-success"><span>Discount</span><span>-{formatETB(discount)}</span></div>
            )}
          <div className="border-t border-border my-3" />
          {belowMinimum && (
            <p className="text-sm text-destructive mb-2">Minimum order is {formatETB(restaurant.minimum_order)} before checkout.</p>
          )}
          <div className="flex justify-between font-semibold text-base"><span>Total</span><span>{formatETB(total)}</span></div>
          </div>
          <Button
            className="w-full h-12 rounded-full mt-5 text-base"
            onClick={handlePlaceOrder}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Place order  |  ${formatETB(total)}`}
          </Button>
        </section>
      </div>
    </div>
  );
}
