import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import OrderTicket from '@/components/restaurant/OrderTicket';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';

export default function RestaurantOrders() {
  const { user } = useOutletContext();
  const [restaurant, setRestaurant] = useState(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      let res = await base44.entities.Restaurant.filter({ owner_email: user.email });
      if (res.length === 0 && user.restaurant_id) res = [await base44.entities.Restaurant.get(user.restaurant_id)];
      setRestaurant(res[0]);
    })();
  }, [user.email]);

  const { data: orders = [] } = useQuery({
    queryKey: ['restaurant-orders-full', restaurant?.id],
    queryFn: () => base44.entities.Order.filter({ restaurant_id: restaurant.id }, '-created_date', 200),
    enabled: !!restaurant,
    refetchInterval: 8000,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['available-drivers'],
    queryFn: () => base44.entities.User.filter({ role: 'driver', driver_status: 'online' }),
    enabled: !!restaurant,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['restaurant-orders-full'] });

  const accept = async (o) => {
    await base44.entities.Order.update(o.id, { status: 'accepted', accepted_at: new Date().toISOString() });
    toast({ title: 'Order accepted' });
    refresh();
  };
  const reject = async (o) => {
    const reason = prompt('Reason for rejection?') || 'Restaurant unable to fulfill';
    await base44.entities.Order.update(o.id, { status: 'rejected', rejection_reason: reason });
    toast({ title: 'Order rejected' });
    refresh();
  };
  const advance = async (o, value) => {
    await base44.entities.Order.update(o.id, { status: value });
    refresh();
  };
  const assign = async (o, driver) => {
    await base44.entities.Order.update(o.id, { driver_email: driver.email, driver_name: driver.full_name });
    toast({ title: `Assigned to ${driver.full_name}` });
    refresh();
  };

  if (!restaurant) return null;

  const buckets = {
    new: orders.filter(o => o.status === 'pending'),
    active: orders.filter(o => ['accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way'].includes(o.status)),
    completed: orders.filter(o => ['delivered', 'rejected', 'cancelled'].includes(o.status)),
  };

  return (
    <div className="p-6 sm:p-8 max-w-6xl">
      <h1 className="font-display text-3xl font-semibold mb-6">Orders</h1>

      <Tabs defaultValue="new">
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
                    drivers={drivers}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}