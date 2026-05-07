import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Switch } from '@/components/ui/switch';
import { ClipboardList, DollarSign, Star, TrendingUp } from 'lucide-react';
import { formatETB } from '@/lib/format';
import { useToast } from '@/components/ui/use-toast';

export default function RestaurantOverview() {
  const { user } = useOutletContext();
  const [restaurant, setRestaurant] = useState(null);
  const { toast } = useToast();

  const loadRestaurant = async () => {
    let res = await base44.entities.Restaurant.filter({ owner_email: user.email });
    if (res.length === 0 && user.restaurant_id) {
      res = [await base44.entities.Restaurant.get(user.restaurant_id)];
    }
    setRestaurant(res[0] || null);
  };

  useEffect(() => { loadRestaurant(); }, [user.email]);

  const { data: orders = [] } = useQuery({
    queryKey: ['restaurant-orders', restaurant?.id],
    queryFn: () => base44.entities.Order.filter({ restaurant_id: restaurant.id }, '-created_date', 200),
    enabled: !!restaurant,
    refetchInterval: 10000,
  });

  if (!restaurant) {
    return (
      <div className="p-8 max-w-3xl">
        <h1 className="font-display text-3xl font-semibold mb-2">Welcome</h1>
        <p className="text-muted-foreground">No restaurant linked to your account yet. Finish setup or contact admin.</p>
      </div>
    );
  }

  if (restaurant.status !== 'approved') {
    return (
      <div className="p-8 max-w-3xl">
        <h1 className="font-display text-3xl font-semibold mb-2">{restaurant.name}</h1>
        <p className="text-muted-foreground">
          Your restaurant is {restaurant.status}. You can prepare your profile, menu, and settings while admin reviews it.
        </p>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOrders = orders.filter((o) => new Date(o.created_date) >= today);
  const todayRevenue = todayOrders.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.total || 0), 0);
  const activeOrders = orders.filter((o) => ['pending', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way'].includes(o.status));

  const toggleOpen = async (val) => {
    await base44.entities.Restaurant.update(restaurant.id, { is_open_manual: val });
    setRestaurant({ ...restaurant, is_open_manual: val });
    toast({ title: val ? 'Restaurant is now open' : 'Orders paused' });
  };

  return (
    <div className="p-6 sm:p-8 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="font-display text-3xl font-semibold">{restaurant.name}</h1>
        </div>
        <div className="flex items-center gap-3 bg-card border border-border rounded-full px-5 py-2.5">
          <span className={`w-2 h-2 rounded-full ${restaurant.is_open_manual ? 'bg-success' : 'bg-destructive'}`} />
          <span className="text-sm font-medium">{restaurant.is_open_manual ? 'Accepting orders' : 'Paused'}</span>
          <Switch checked={!!restaurant.is_open_manual} onCheckedChange={toggleOpen} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={ClipboardList} label="Today's orders" value={todayOrders.length} />
        <StatCard icon={DollarSign} label="Today's revenue" value={formatETB(todayRevenue)} />
        <StatCard icon={TrendingUp} label="Active now" value={activeOrders.length} highlight />
        <StatCard icon={Star} label="Rating" value={restaurant.rating?.toFixed(1) || '—'} />
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="font-display text-xl font-semibold mb-4">Recent orders</h2>
        {orders.slice(0, 6).length === 0 ? (
          <p className="text-muted-foreground text-sm">No orders yet.</p>
        ) : (
          <div className="space-y-2">
            {orders.slice(0, 6).map((o) => (
              <div key={o.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="font-medium text-sm">{o.order_number} · {o.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{o.items.length} items · {o.status}</p>
                </div>
                <p className="font-medium text-sm">{formatETB(o.total)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, highlight }) {
  return (
    <div className={`rounded-2xl p-5 border ${highlight ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border'}`}>
      <Icon className={`w-5 h-5 mb-3 ${highlight ? 'opacity-90' : 'text-muted-foreground'}`} />
      <p className={`text-xs font-medium ${highlight ? 'opacity-80' : 'text-muted-foreground'}`}>{label}</p>
      <p className="font-display text-2xl font-bold mt-0.5">{value}</p>
    </div>
  );
}
