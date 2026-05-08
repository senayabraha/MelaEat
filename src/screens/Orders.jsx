import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ChevronRight, Repeat } from 'lucide-react';
import { formatETB, statusLabel, statusColor, formatDate, paymentStatusLabel, paymentStatusColor } from '@/lib/format';
import { useCart } from '@/lib/cart';
import { useToast } from '@/components/ui/use-toast';

export default function Orders() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const { addItem, clear } = useCart();
  const { toast } = useToast();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin(window.location.href));
  }, []);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['my-orders', user?.email],
    queryFn: () => base44.entities.Order.filter({ customer_email: user.email }, '-created_date', 50),
    enabled: !!user,
  });

  const reorder = async (order) => {
    const restaurant = await base44.entities.Restaurant.get(order.restaurant_id);
    clear();
    for (const it of order.items) {
      const menuItem = { id: it.menu_item_id, name: it.name, price: it.unit_price - (it.selected_options || []).reduce((s, o) => s + (o.price_delta || 0), 0), image_url: '' };
      addItem(restaurant, menuItem, it.quantity, it.selected_options || [], it.notes || '');
    }
    toast({ title: 'Items added to cart' });
    navigate('/cart');
  };

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-display text-3xl font-semibold mb-8">Your orders</h1>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-secondary rounded-2xl animate-pulse" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20">
          <p className="font-display text-2xl mb-2">No orders yet</p>
          <p className="text-muted-foreground mb-6">Discover restaurants and place your first order.</p>
          <Button asChild className="rounded-full"><Link to="/">Browse restaurants</Link></Button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded border ${statusColor(o.status)}`}>{statusLabel(o.status)}</span>
                  <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded border ${paymentStatusColor(o.payment_status)}`}>{paymentStatusLabel(o.payment_status)}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(o.created_date)}</span>
                </div>
                <h3 className="font-display text-lg font-semibold truncate">{o.restaurant_name}</h3>
                <p className="text-sm text-muted-foreground truncate">
                  {o.items.length} item{o.items.length !== 1 ? 's' : ''}  |  {formatETB(o.total)}
                </p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => navigate(`/order/${o.id}`)}>
                  Details <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => reorder(o)}>
                  <Repeat className="w-3.5 h-3.5 mr-1" /> Reorder
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
