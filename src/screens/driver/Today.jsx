import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Switch } from '@/components/ui/switch';
import { Truck, DollarSign, Star, Package } from 'lucide-react';
import { formatETB } from '@/lib/format';
import { useToast } from '@/components/ui/use-toast';

export default function DriverToday() {
  const { user, refreshUser } = useOutletContext();
  const { toast } = useToast();
  const approved = !user.driver_approval_status || user.driver_approval_status === 'approved';
  const online = user.driver_status === 'online' || user.driver_status === 'on_delivery';

  const { data: orders = [] } = useQuery({
    queryKey: ['driver-history', user.email],
    queryFn: () => base44.entities.Order.filter({ driver_email: user.email, status: 'delivered' }, '-created_date', 200),
  });

  const today = new Date(); today.setHours(0,0,0,0);
  const todayDeliveries = orders.filter(o => new Date(o.created_date) >= today);
  const todayEarnings = todayDeliveries.reduce((s, o) => s + (o.delivery_fee || 0), 0);

  const toggle = async (v) => {
    if (!approved) {
      toast({ title: 'Your driver account is waiting for approval', variant: 'destructive' });
      return;
    }
    await base44.auth.updateMe({ driver_status: v ? 'online' : 'offline' });
    await refreshUser();
    toast({ title: v ? "You're online" : 'Going offline' });
  };

  return (
    <div className="p-6 sm:p-8 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <p className="text-sm text-muted-foreground">Hi {user.full_name?.split(' ')[0]}</p>
          <h1 className="font-display text-3xl font-semibold">Today</h1>
          {!approved && (
            <p className="text-sm text-muted-foreground mt-1">
              Driver approval status: {user.driver_approval_status || 'pending'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 bg-card border border-border rounded-full px-5 py-2.5">
          <span className={`w-2 h-2 rounded-full ${online ? 'bg-success' : 'bg-muted-foreground'}`} />
          <span className="text-sm font-medium">{online ? 'Online' : 'Offline'}</span>
          <Switch checked={online} onCheckedChange={toggle} disabled={!approved} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat icon={Package} label="Today's deliveries" value={todayDeliveries.length} />
        <Stat icon={DollarSign} label="Today's earnings" value={formatETB(todayEarnings)} highlight />
        <Stat icon={Truck} label="Total deliveries" value={user.driver_total_deliveries || 0} />
        <Stat icon={Star} label="Rating" value={(user.driver_rating || 5).toFixed(1)} />
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="font-display text-xl font-semibold mb-1">Recent deliveries</h2>
        {orders.slice(0, 5).length === 0 ? (
          <p className="text-sm text-muted-foreground mt-3">No deliveries yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {orders.slice(0, 5).map(o => (
              <div key={o.id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">{o.order_number}</p>
                  <p className="text-xs text-muted-foreground">{o.restaurant_name} to {o.customer_name}</p>
                </div>
                <p className="font-medium text-sm">{formatETB(o.delivery_fee || 0)}</p>
              </div>
            ))}
          </div>
        )}
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
