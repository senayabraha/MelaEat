import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { melaeat } from '@/api/apiClient';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { formatETB } from '@/lib/format';

export default function DriverEarnings() {
  const { user } = useOutletContext();

  const { data: orders = [] } = useQuery({
    queryKey: ['driver-earnings', user.email],
    queryFn: () => melaeat.entities.Order.filter({ driver_email: user.email, status: 'delivered' }, '-created_date', 500),
  });

  const stats = useMemo(() => {
    const last14 = Array.from({ length: 14 }).map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i)); d.setHours(0,0,0,0);
      const dn = new Date(d); dn.setDate(dn.getDate() + 1);
      const dayOrders = orders.filter(o => new Date(o.created_date) >= d && new Date(o.created_date) < dn);
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        earnings: dayOrders.reduce((s, o) => s + (o.delivery_fee || 0), 0),
      };
    });
    const total = orders.reduce((s, o) => s + (o.delivery_fee || 0), 0);
    const week = orders.filter(o => new Date(o.created_date) > new Date(Date.now() - 7*24*60*60*1000));
    return { last14, total, weekEarnings: week.reduce((s,o) => s+(o.delivery_fee||0),0), weekCount: week.length };
  }, [orders]);

  return (
    <div className="p-6 sm:p-8 max-w-5xl">
      <h1 className="font-display text-3xl font-semibold mb-8">Earnings</h1>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Stat label="Lifetime earnings" value={formatETB(stats.total)} highlight />
        <Stat label="This week" value={formatETB(stats.weekEarnings)} />
        <Stat label="Deliveries this week" value={stats.weekCount} />
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="font-display text-xl font-semibold mb-4">Last 14 days</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.last14}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Bar dataKey="earnings" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
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