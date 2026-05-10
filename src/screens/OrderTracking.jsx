import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { melaeat } from '@/api/apiClient';
import { Phone, MapPin, Star, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import OrderStatusTimeline from '@/components/orders/OrderStatusTimeline';
import OrderChat from '@/components/orders/OrderChat';
import { formatETB, statusLabel, statusColor, paymentStatusLabel, paymentStatusColor } from '@/lib/format';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

export default function OrderTracking() {
  const { id } = useParams();
  const { user } = useAuth();
  const [showRating, setShowRating] = useState(false);
  const [restaurantStars, setRestaurantStars] = useState(0);
  const [driverStars, setDriverStars] = useState(0);
  const [review, setReview] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showIssue, setShowIssue] = useState(false);
  const [issueDescription, setIssueDescription] = useState('');
  const { toast } = useToast();

  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: () => melaeat.entities.Order.get(id),
    refetchInterval: 30000,
  });

  const { data: driverProfile } = useQuery({
    queryKey: ['driver-profile', order?.driver_email],
    queryFn: async () => {
      const profiles = await melaeat.entities.User.filter({ email: order.driver_email }, '-created_date', 1);
      return profiles[0] || null;
    },
    enabled: !!order?.driver_email,
  });

  useEffect(() => {
    const unsub = melaeat.entities.Order.subscribe((evt) => {
      if (evt.id === id) refetch();
    });
    return () => unsub && unsub();
  }, [id, refetch]);

  const submitRating = async () => {
    try {
      await melaeat.orders.submitRating(id, {
        customer_rating_restaurant: restaurantStars,
        customer_rating_driver: driverStars,
        customer_review: review,
      });
      setShowRating(false);
      toast({ title: 'Thank you for your rating!' });
      refetch();
    } catch (error) {
      toast({ title: 'Could not submit rating', description: error.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const cancelOrder = async () => {
    try {
      await melaeat.orders.action(id, { action: 'customer_cancel', reason: 'Cancelled by customer' });
      setConfirmCancel(false);
      toast({ title: 'Order cancelled' });
      refetch();
    } catch (error) {
      toast({
        title: 'Could not cancel order',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const submitIssue = async () => {
    if (!issueDescription.trim()) return;
    try {
      await melaeat.entities.IssueReport.create({
        order_id: id,
        reporter_email: user?.email,
        reporter_role: 'customer',
        category: 'other',
        description: issueDescription.trim(),
      });
      setShowIssue(false);
      setIssueDescription('');
      toast({ title: 'Issue reported', description: 'Our team will review this.' });
    } catch (error) {
      toast({ title: 'Could not submit issue', description: error.message || 'Please try again.', variant: 'destructive' });
    }
  };

  if (isLoading || !order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 flex flex-col items-center gap-4 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p>Loading order…</p>
      </div>
    );
  }

  const isDelivered = order.status === 'delivered';
  const isClosed = ['delivered', 'cancelled', 'rejected'].includes(order.status);
  const alreadyRated = !!order.customer_rating_restaurant;
  const canCancel = ['accepted', 'pending'].includes(order.status);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-sm text-muted-foreground">Order {order.order_number}</p>
          <h1 className="font-display text-3xl font-semibold mt-1">{order.restaurant_name}</h1>
          {order.estimated_ready_at && !isDelivered && (
            <p className="text-sm text-muted-foreground mt-1">
              Estimated ready {new Date(order.estimated_ready_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColor(order.status)}`}>
            {statusLabel(order.status)}
          </span>
          {canCancel && (
            <Button variant="outline" size="sm" onClick={() => setConfirmCancel(true)}>
              Cancel order
            </Button>
          )}
        </div>
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
                  <p className="text-sm text-muted-foreground">
                    {driverProfile?.phone ? driverProfile.phone : 'On the way to you'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={!driverProfile?.phone}
                  onClick={() => window.open(`tel:${driverProfile.phone}`)}
                >
                  <Phone className="w-4 h-4" />
                </Button>
              </div>
            </section>
          )}

          {/* Chat: open during active orders AND for 24h after delivery so customers can flag issues */}
          {!isClosed && (
            <OrderChat orderId={order.id} currentRole="customer" recipientRole={order.driver_email ? 'driver' : 'restaurant'} />
          )}

          {isDelivered && !alreadyRated && (
            <section className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-display text-xl font-semibold mb-3">How was it?</h2>
              <Button onClick={() => setShowRating(true)}>Rate your experience</Button>
            </section>
          )}

          {/* Post-delivery issue report */}
          {isDelivered && (
            <section className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold">Problem with this order?</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Missing item, wrong order, or other issue.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowIssue(true)}>
                  <AlertTriangle className="w-4 h-4 mr-1" /> Report issue
                </Button>
              </div>
            </section>
          )}
        </div>

        <div>
          <section className="bg-card border border-border rounded-2xl p-6 sticky top-24">
            <h2 className="font-display text-xl font-semibold mb-4">Summary</h2>
            <div className="space-y-2 text-sm mb-4">
              {order.items.map((it, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-muted-foreground">{it.quantity}x {it.name}</span>
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
              <p>
                Payment:{' '}
                <span className={`inline-flex px-2 py-0.5 rounded border font-medium ${paymentStatusColor(order.payment_status)}`}>
                  {paymentStatusLabel(order.payment_status)}
                </span>
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* Rating dialog */}
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
            <Button onClick={submitRating} className="w-full" disabled={restaurantStars === 0}>Submit</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>
              You can cancel before the restaurant starts preparing it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={cancelOrder}>Cancel order</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Issue report dialog */}
      <Dialog open={showIssue} onOpenChange={setShowIssue}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report an issue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              rows={4}
              placeholder="Describe the issue — e.g. missing item, wrong order, cold food…"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowIssue(false)}>Cancel</Button>
              <Button onClick={submitIssue} disabled={!issueDescription.trim()}>Submit issue</Button>
            </div>
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
