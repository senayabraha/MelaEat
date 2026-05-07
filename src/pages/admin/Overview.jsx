import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Store, Users, ClipboardList, DollarSign } from 'lucide-react';
import { formatETB } from '@/lib/format';

export default function AdminOverview() {
  const { data: restaurants = [] } = useQuery({
    queryKey: ['admin-restaurants'],
    queryFn: () => base44.entities.Restaurant.list('-created_date', 500),
  });
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => base44.entities.User.list('-created_date', 500),
  });
  const { data: orders = [] } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 500),
  });

  const delivered = orders.filter(o => o.status === 'delivered');
  const platformRevenue = delivered.reduce((s, o) => s + (o.subtotal || 0) * 0.15, 0);

  return (
    <div className="p-6 sm:p-8 max-w-6xl">
      <h1 className="font-display text-3xl font-semibold mb-8">Platform overview</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat icon={Store} label="Restaurants" value={restaurants.length} />
        <Stat icon={Users} label="Users" value={users.length} />
        <Stat icon={ClipboardList} label="Total orders" value={orders.length} />
        <Stat icon={DollarSign} label="Commission" value={formatETB(platformRevenue)} highlight />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold mb-4">Pending restaurants</h2>
          {restaurants.filter(r => r.status === 'pending').slice(0,5).length === 0 ? (
            <p className="text-sm text-muted-foreground">None.</p>
          ) : restaurants.filter(r => r.status === 'pending').slice(0,5).map(r => (
            <div key={r.id} className="py-2 border-b border-border last:border-0">{r.name}</div>
          ))}
        </div>
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold mb-4">Recent orders</h2>
          {orders.slice(0, 5).map(o => (
            <div key={o.id} className="py-2 border-b border-border last:border-0 flex justify-between text-sm">
              <span>{o.order_number}</span>
              <span>{formatETB(o.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, highlight }) {
  return (
    <div className={`rounded-2xl p-5 border ${highlight ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border'}`}>
      <Icon className={`w-5 h-5 mb-3 ${highlight ? 'opacity-90' : 'text-muted-foreground'}`} />
      <p className={`text-xs font-medium ${highlight ? 'opacity-80' : 'text-muted-foreground'}`}>{label}</p>
      <p className="font-display text-2xl font-bold mt-0.5">{value}</p>
    </div>
  );
}