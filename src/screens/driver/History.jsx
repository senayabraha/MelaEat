import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatETB, formatDate, statusLabel, statusColor } from '@/lib/format';

export default function DriverHistory() {
  const { user } = useOutletContext();

  const { data: orders = [] } = useQuery({
    queryKey: ['driver-all-history', user.email],
    queryFn: () => base44.entities.Order.filter({ driver_email: user.email }, '-created_date', 200),
  });

  return (
    <div className="p-6 sm:p-8 max-w-4xl">
      <h1 className="font-display text-3xl font-semibold mb-6">Trip history</h1>

      {orders.length === 0 ? (
        <p className="text-muted-foreground text-sm py-12 text-center">No trips yet.</p>
      ) : (
        <div className="space-y-2">
          {orders.map(o => (
            <div key={o.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded border ${statusColor(o.status)}`}>{statusLabel(o.status)}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(o.created_date)}</span>
                </div>
                <p className="font-medium text-sm truncate">{o.restaurant_name} to {o.customer_name}</p>
                {o.customer_rating_driver && (
                  <p className="text-xs text-muted-foreground">* {o.customer_rating_driver}/5</p>
                )}
              </div>
              <p className="font-medium">{formatETB(o.delivery_fee || 0)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
