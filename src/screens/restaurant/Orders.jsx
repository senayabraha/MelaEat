import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { melaeat } from '@/api/apiClient';
import OrderTicket from '@/components/restaurant/OrderTicket';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

export default function RestaurantOrders() {
  const { user } = useOutletContext();
  const [restaurant, setRestaurant] = useState(null);
  const [rejectingOrder, setRejectingOrder] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [overrideOrder, setOverrideOrder] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');
  const previousActiveCount = React.useRef(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      let res = await melaeat.entities.Restaurant.filter({ owner_email: user.email });
      if (res.length === 0 && user.restaurant_id) res = [await melaeat.entities.Restaurant.get(user.restaurant_id)];
      setRestaurant(res[0]);
    })();
  }, [user.email]);

  const { data: orders = [] } = useQuery({
    queryKey: ['restaurant-orders-full', restaurant?.id],
    queryFn: () => melaeat.entities.Order.filter({ restaurant_id: restaurant.id }, '-created_date', 200),
    enabled: !!restaurant,
    refetchInterval: 8000,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['available-drivers'],
    queryFn: () => melaeat.entities.User.filter({ role: 'driver', driver_status: 'online' }),
    enabled: !!restaurant,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['restaurant-orders-full'] });

  const accept = async (o) => {
    try {
      await melaeat.orders.action(o.id, { action: 'accept' });
      toast({ title: 'Order accepted' });
      refresh();
    } catch (error) {
      toast({ title: 'Could not accept order', description: error.message || 'Please try again.', variant: 'destructive' });
    }
  };
  const reject = async (o) => {
    setRejectingOrder(o);
    setRejectReason('');
  };
  const confirmReject = async () => {
    if (!rejectingOrder) return;
    try {
      await melaeat.orders.action(rejectingOrder.id, {
        action: 'reject',
        reason: rejectReason,
      });
      setRejectingOrder(null);
      toast({ title: 'Order rejected' });
      refresh();
    } catch (error) {
      toast({ title: 'Could not reject order', description: error.message || 'Please try again.', variant: 'destructive' });
    }
  };
  const advance = async (o, value, extra = {}) => {
    try {
      await melaeat.orders.action(o.id, { action: value, ...extra });
      refresh();
    } catch (error) {
      toast({ title: 'Could not update order', description: error.message || 'Please try again.', variant: 'destructive' });
    }
  };
  const assign = async (o, driver) => {
    try {
      await melaeat.orders.action(o.id, { action: 'assign_driver', driver_email: driver.email });
      toast({ title: `Assigned to ${driver.full_name}` });
      refresh();
    } catch (error) {
      toast({ title: 'Could not assign driver', description: error.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const onOverridePin = (o) => {
    setOverrideOrder(o);
    setOverrideReason('');
  };

  const confirmOverride = async () => {
    if (!overrideOrder) return;
    if (overrideReason.trim().length < 5) {
      toast({ title: 'A reason is required (5+ chars).', variant: 'destructive' });
      return;
    }
    try {
      await melaeat.orders.action(overrideOrder.id, {
        action: 'delivered',
        override: true,
        override_reason: overrideReason.trim(),
      });
      setOverrideOrder(null);
      toast({ title: 'Delivery confirmed (PIN overridden)', description: 'Logged for audit.' });
      refresh();
    } catch (error) {
      toast({ title: 'Could not override PIN', description: error.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const buckets = {
    new: orders.filter(o => o.status === 'pending'),
    active: orders.filter(o => ['accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way'].includes(o.status)),
    completed: orders.filter(o => ['delivered', 'rejected', 'cancelled'].includes(o.status)),
  };

  useEffect(() => {
    if (previousActiveCount.current === null) {
      previousActiveCount.current = buckets.new.length;
      return;
    }
    if (buckets.new.length > previousActiveCount.current) {
      toast({ title: 'New order received', description: 'A customer is waiting — accept or reject it now.' });
    }
    previousActiveCount.current = buckets.new.length;
  }, [buckets.new.length, toast]);

  if (!restaurant) return null;

  return (
    <div className="p-6 sm:p-8 max-w-6xl">
      <h1 className="font-display text-3xl font-semibold mb-6">Orders</h1>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="new">New ({buckets.new.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({buckets.active.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
        {['new', 'active', 'completed'].map((k) => (
          <TabsContent key={k} value={k} className="mt-6">
            {buckets[k].length === 0 ? (
              <p className="text-muted-foreground text-sm py-12 text-center">No orders here.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {buckets[k].map((o) => (
                  <OrderTicket
                    key={o.id}
                    order={o}
                    onAccept={accept}
                    onReject={reject}
                    onAdvance={advance}
                    onAssign={assign}
                    onOverridePin={onOverridePin}
                    drivers={drivers}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!rejectingOrder} onOpenChange={(open) => !open && setRejectingOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={3}
              placeholder="Reason for rejection"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectingOrder(null)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmReject}>Reject order</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!overrideOrder} onOpenChange={(open) => !open && setOverrideOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override delivery PIN</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use only if the customer cannot read out the PIN (left at gate, language issue, etc.). This is logged for audit.
            </p>
            <Textarea
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              rows={3}
              placeholder="Reason (e.g. customer left at gate, no answer)"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOverrideOrder(null)}>Cancel</Button>
              <Button onClick={confirmOverride} disabled={overrideReason.trim().length < 5}>
                Confirm delivery
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
