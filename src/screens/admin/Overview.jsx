import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Store, Users, ClipboardList, DollarSign, ChevronRight } from 'lucide-react';
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

  // Build a map of restaurant_id → commission_rate for accurate per-restaurant rates
  const commissionRateById = Object.fromEntries(
    restaurants.map((r) => [r.id, r.commission_rate || 0.15])
  );

  const delivered = orders.filter((o) => o.status === 'delivered');
  const platformRevenue = delivered.reduce(
    (s, o) => s + (o.subtotal || 0) * (commissionRateById[o.restaurant_id] || 0.15),
    0
  );

  const pendingRestaurants = restaurants.filter((r) => r.status === 'pending');

  return (
    <div className="p-6 sm:p-8 max-w-6xl">
      <h1 className="font-display text-3xl font-semibold mb-8">Platform overview</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat icon={Store} label="Restaurants" value={restaurants.length} />
        <Stat icon={Users} label="Users" value={users.length} />
        <Stat icon={ClipboardList} label="Total orders" value={orders.length} />
        <Stat icon={DollarSign} label="Commission earned" value={formatETB(platformRevenue)} highlight />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-semibold">Pending restaurants</h2>
            {pendingRestaurants.length > 0 && (
              <Link to="/admin/restaurants" className="text-xs font-medium text-primary flex items-center gap-1 hover:underline">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
          {pendingRestaurants.length === 0 ? (
            <p className="text-sm text-muted-foreground">None pending.</p>
          ) : (
            pendingRestaurants.slice(0, 5).map((r) => (
              <div key={r.id} className="py-2 border-b border-border last:border-0 text-sm">
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">{r.owner_email}</p>
              </div>
            ))
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-semibold">Recent orders</h2>
            <Link to="/admin/orders" className="text-xs font-medium text-primary flex items-center gap-1 hover:underline">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {orders.slice(0, 5).map((o) => (
            <div key={o.id} className="py-2 border-b border-border last:border-0 flex justify-between text-sm">
              <span className="truncate">{o.order_number}</span>
              <span className="shrink-0 ml-2">{formatETB(o.total)}</span>
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
