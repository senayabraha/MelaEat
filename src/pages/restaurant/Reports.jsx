import React, { useEffect, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { formatETB } from '@/lib/format';

export default function RestaurantReports() {
  const { user } = useOutletContext();
  const [restaurant, setRestaurant] = useState(null);

  useEffect(() => {
    (async () => {
      let res = await base44.entities.Restaurant.filter({ owner_email: user.email });
      if (res.length === 0 && user.restaurant_id) res = [await base44.entities.Restaurant.get(user.restaurant_id)];
      setRestaurant(res[0]);
    })();
  }, [user.email]);

  const { data: orders = [] } = useQuery({
    queryKey: ['rest-orders-reports', restaurant?.id],
    queryFn: () => base44.entities.Order.filter({ restaurant_id: restaurant.id }, '-created_date', 500),
    enabled: !!restaurant,
  });

  const stats = useMemo(() => {
    const delivered = orders.filter(o => o.status === 'delivered');
    const totalRevenue = delivered.reduce((s, o) => s + (o.total || 0), 0);
    const totalCommission = delivered.reduce((s, o) => s + (o.subtotal || 0) * (restaurant?.commission_rate || 0.15), 0);
    const netEarnings = totalRevenue - totalCommission - delivered.reduce((s, o) => s + (o.delivery_fee || 0), 0);

    const last14 = Array.from({ length: 14 }).map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i)); d.setHours(0,0,0,0);
      const dn = new Date(d); dn.setDate(dn.getDate() + 1);
      const dayOrders = delivered.filter(o => new Date(o.created_date) >= d && new Date(o.created_date) < dn);
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: dayOrders.reduce((s, o) => s + (o.total || 0), 0),
        orders: dayOrders.length,
      };
    });

    const itemCounts = {};
    delivered.forEach(o => o.items.forEach(it => { itemCounts[it.name] = (itemCounts[it.name] || 0) + it.quantity; }));
    const topItems = Object.entries(itemCounts).sort((a,b) => b[1]-a[1]).slice(0,5);

    return { totalRevenue, totalCommission, netEarnings, last14, topItems, totalOrders: delivered.length };
  }, [orders, restaurant]);

  if (!restaurant) return null;

  return (
    <div className="p-6 sm:p-8 max-w-6xl">
      <h1 className="font-display text-3xl font-semibold mb-8">Reports</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat label="Gross revenue" value={formatETB(stats.totalRevenue)} />
        <Stat label="Platform commission" value={formatETB(stats.totalCommission)} />
        <Stat label="Net earnings" value={formatETB(stats.netEarnings)} highlight />
        <Stat label="Delivered orders" value={stats.totalOrders} />
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 mb-6">
        <h2 className="font-display text-xl font-semibold mb-4">Last 14 days</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.last14}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="font-display text-xl font-semibold mb-4">Top selling items</h2>
        {stats.topItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not enough data yet.</p>
        ) : (
          <div className="space-y-2">
            {stats.topItems.map(([name, count]) => (
              <div key={name} className="flex justify-between py-2 border-b border-border last:border-0">
                <span>{name}</span>
                <span className="font-medium">{count} sold</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className={`rounded-2xl p-5 border ${highlight ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border'}`}>
      <p className={`text-xs font-medium ${highlight ? 'opacity-80' : 'text-muted-foreground'}`}>{label}</p>
      <p className="font-display text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}