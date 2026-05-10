import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { statusLabel } from '@/lib/format';

const ACTIVE_STATUSES = new Set([
  'pending',
  'accepted',
  'preparing',
  'ready_for_pickup',
  'picked_up',
  'on_the_way',
]);

const TERMINAL_STATUSES = new Set(['delivered', 'cancelled', 'rejected']);

const STATUS_HEADLINE = {
  accepted: 'Order accepted',
  preparing: 'The kitchen is cooking',
  ready_for_pickup: 'Ready for pickup',
  picked_up: 'Driver picked up your order',
  on_the_way: 'Your order is on the way',
  delivered: 'Delivered — rate your experience',
  cancelled: 'Order cancelled',
  rejected: 'Order rejected',
};

function notify(order, prevStatus) {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (prevStatus === order.status) return;

  const headline = STATUS_HEADLINE[order.status] || statusLabel(order.status);
  const body = order.restaurant_name
    ? `${order.order_number} · ${order.restaurant_name}`
    : order.order_number;

  try {
    const n = new Notification(headline, {
      body,
      tag: `order-${order.id}`,
      renotify: true,
    });
    n.onclick = () => {
      window.focus();
      window.location.assign(`/order/${order.id}`);
      n.close();
    };
  } catch {
    // Some browsers throw when not invoked from a user gesture; safe to ignore.
  }
}

// Subscribes to realtime updates for every order this customer has and fires a
// system-level Notification on status transitions, so customers don't need to
// keep the OrderTracking page open to know what's happening.
export default function useOrderNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const lastStatusRef = useRef(new Map());

  useEffect(() => {
    if (!user?.email) return undefined;

    let cancelled = false;

    const seedAndSubscribe = async () => {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, status, order_number, restaurant_name, created_date')
        .eq('customer_email', user.email)
        .order('created_date', { ascending: false })
        .limit(20);

      if (cancelled) return null;
      if (error) return null;

      const seed = lastStatusRef.current;
      for (const o of orders || []) seed.set(o.id, o.status);

      const channel = supabase
        .channel(`customer-orders-${user.email}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `customer_email=eq.${user.email}`,
          },
          (payload) => {
            const next = payload.new;
            if (!next) return;
            const prev = lastStatusRef.current.get(next.id);
            lastStatusRef.current.set(next.id, next.status);

            // Only notify on real transitions for orders we already knew about,
            // and only for active or terminal status changes worth surfacing.
            if (prev === undefined) return;
            if (!ACTIVE_STATUSES.has(next.status) && !TERMINAL_STATUSES.has(next.status)) return;

            notify(next, prev);
            queryClient.invalidateQueries({ queryKey: ['my-orders', user.email] });
            queryClient.setQueryData(['order', next.id], (existing) =>
              existing ? { ...existing, ...next } : existing,
            );
          },
        )
        .subscribe();

      return channel;
    };

    const channelPromise = seedAndSubscribe();

    return () => {
      cancelled = true;
      channelPromise.then((channel) => {
        if (channel) supabase.removeChannel(channel);
      });
    };
  }, [user?.email, queryClient]);
}
