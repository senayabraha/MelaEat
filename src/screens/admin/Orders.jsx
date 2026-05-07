import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatETB, formatDate, statusLabel, statusColor } from '@/lib/format';

export default function AdminOrders() {
  const { data: orders = [] } = useQuery({
    queryKey: ['admin-all-orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 200),
  });

  return (
    <div className="p-6 sm:p-8 max-w-6xl">
      <h1 className="font-display text-3xl font-semibold mb-6">All orders</h1>
      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        {orders.map(o => (
          <div key={o.id} className="p-4 flex items-center gap-4">
            <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded border ${statusColor(o.status)}`}>{statusLabel(o.status)}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{o.order_number} · {o.restaurant_name}</p>
              <p className="text-xs text-muted-foreground">{o.customer_name} · {formatDate(o.created_date)}</p>
            </div>
            <p className="font-medium">{formatETB(o.total)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}