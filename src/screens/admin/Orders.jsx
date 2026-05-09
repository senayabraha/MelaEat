import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatETB, formatDate, statusLabel, statusColor, paymentStatusLabel } from '@/lib/format';

export default function AdminOrders() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [payment, setPayment] = useState('all');
  const { data: orders = [] } = useQuery({
    queryKey: ['admin-all-orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 200),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesSearch = !q || [
        order.order_number,
        order.restaurant_name,
        order.customer_name,
        order.customer_phone,
        order.customer_email,
      ].some((value) => String(value || '').toLowerCase().includes(q));
      const matchesStatus = status === 'all' || order.status === status;
      const matchesPayment = payment === 'all' || order.payment_status === payment;
      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [orders, payment, search, status]);

  return (
    <div className="p-6 sm:p-8 max-w-6xl">
      <h1 className="font-display text-3xl font-semibold mb-6">All orders</h1>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_200px] gap-3 mb-4">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order, customer, restaurant, phone" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            {['all', 'pending', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way', 'delivered', 'cancelled', 'rejected'].map((value) => (
              <SelectItem key={value} value={value}>{value === 'all' ? 'All statuses' : statusLabel(value)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={payment} onValueChange={setPayment}>
          <SelectTrigger><SelectValue placeholder="Payment" /></SelectTrigger>
          <SelectContent>
            {['all', 'cash_on_delivery', 'paid', 'pending', 'failed', 'refunded'].map((value) => (
              <SelectItem key={value} value={value}>{value === 'all' ? 'All payments' : paymentStatusLabel(value)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        {filtered.map((order) => (
          <div key={order.id} className="p-4 flex items-center gap-4">
            <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded border ${statusColor(order.status)}`}>{statusLabel(order.status)}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{order.order_number}  |  {order.restaurant_name}</p>
              <p className="text-xs text-muted-foreground">{order.customer_name}  |  {paymentStatusLabel(order.payment_status)}  |  {formatDate(order.created_date)}</p>
            </div>
            <p className="font-medium">{formatETB(order.total)}</p>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">No orders match those filters.</p>
        )}
      </div>
    </div>
  );
}
