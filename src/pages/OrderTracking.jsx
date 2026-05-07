import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Phone, MapPin, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import OrderStatusTimeline from '@/components/orders/OrderStatusTimeline';
import OrderChat from '@/components/orders/OrderChat';
import { formatETB, statusLabel, statusColor } from '@/lib/format';
import { useToast } from '@/components/ui/use-toast';

export default function OrderTracking() {
  const { id } = useParams();
  const [showRating, setShowRating] = useState(false);
  const [restaurantStars, setRestaurantStars] = useState(0);
  const [driverStars, setDriverStars] = useState(0);
  const [review, setReview] = useState('');
  const { toast } = useToast();

  const { data: order, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: () => base44.entities.Order.get(id),
    refetchInterval: 8000,
  });

  useEffect(() => {
    const unsub = base44.entities.Order.subscribe((evt) => {
      if (evt.id === id) refetch();
    });
    return () => unsub && unsub();
  }, [id, refetch]);

  const submitRating = async () => {
    await base44.entities.Order.update(id, {
      customer_rating_restaurant: restaurantStars,
      customer_rating_driver: driverStars,
      customer_review: review,
    });
    setShowRating(false);
    toast({ title: 'Thank you for your rating!' });
    refetch();
  };

  if (!order) {
    return <div className="max-w-2xl mx-auto px-4 py-20 text-center text-muted-foreground">Loading order…</div>;
  }

  const isDelivered = order.status === 'delivered';
  const alreadyRated = !!order.customer_rating_restaurant;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-sm text-muted-foreground">Order {order.order_number}</p>
          <h1 className="font-display text-3xl font-semibold mt-1">{order.restaurant_name}</h1>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColor(order.status)}`}>
          {statusLabel(order.status)}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-display text-xl font-semibold mb-4">Status</h2>
            <OrderStatusTimeline status={order.status} />
            {order.is_scheduled && (
              <p className="mt-4 text-sm text-muted-foreground">
                Scheduled for {new Date(order.scheduled_for).toLocaleString()}
              </p>
            )}
          </section>

          {order.driver_email && (
            <section className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-display text-xl font-semibold mb-3">Your driver</h2>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                  {(order.driver_name || 'D').charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{order.driver_name}</p>
                  <p className="text-sm text-muted-foreground">On the way to you</p>
                </div>
                <Button variant="outline" size="icon"><Phone className="w-4 h-4" /></Button>
              </div>
            </section>
          )}

          {(order.status !== 'delivered' && order.status !== 'cancelled' && order.status !== 'rejected') && (
            <OrderChat orderId={order.id} currentRole="customer" recipientRole={order.driver_email ? 'driver' : 'restaurant'} />
          )}

          {isDelivered && !alreadyRated && (
            <section className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-display text-xl font-semibold mb-3">How was it?</h2>
              <Button onClick={() => setShowRating(true)}>Rate your experience</Button>
            </section>
          )}
        </div>

        <div>
          <section className="bg-card border border-border rounded-2xl p-6 sticky top-24">
            <h2 className="font-display text-xl font-semibold mb-4">Summary</h2>
            <div className="space-y-2 text-sm mb-4">
              {order.items.map((it, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-muted-foreground">{it.quantity}× {it.name}</span>
                  <span>{formatETB(it.line_total)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatETB(order.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{formatETB(order.delivery_fee)}</span></div>
              {order.discount > 0 && (
                <div className="flex justify-between text-success"><span>Discount</span><span>-{formatETB(order.discount)}</span></div>
              )}
              <div className="flex justify-between font-semibold text-base pt-2"><span>Total</span><span>{formatETB(order.total)}</span></div>
            </div>
            <div className="border-t border-border mt-4 pt-4 text-xs text-muted-foreground space-y-1">
              <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> {order.delivery_address_text || 'Pin location'}</p>
              <p>Payment: {order.payment_method}</p>
            </div>
          </section>
        </div>
      </div>

      <Dialog open={showRating} onOpenChange={setShowRating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate your order</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium mb-2">Restaurant</p>
              <StarPicker value={restaurantStars} onChange={setRestaurantStars} />
            </div>
            {order.driver_email && (
              <div>
                <p className="text-sm font-medium mb-2">Driver</p>
                <StarPicker value={driverStars} onChange={setDriverStars} />
              </div>
            )}
            <div>
              <p className="text-sm font-medium mb-2">Comments</p>
              <Textarea value={review} onChange={(e) => setReview(e.target.value)} rows={3} placeholder="Tell us more (optional)" />
            </div>
            <Button onClick={submitRating} className="w-full">Submit</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StarPicker({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => onChange(n)}>
          <Star className={`w-7 h-7 ${n <= value ? 'fill-accent text-accent' : 'text-muted-foreground/40'}`} />
        </button>
      ))}
    </div>
  );
}
