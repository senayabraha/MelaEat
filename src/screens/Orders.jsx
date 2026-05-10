import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { melaeat, supabase } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronRight, Loader2, Repeat, Search, AlertCircle, Star } from 'lucide-react';
import { formatETB, statusLabel, statusColor, formatDate, paymentStatusLabel, paymentStatusColor } from '@/lib/format';
import { useCart } from '@/lib/cart';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

const ORDERS_PAGE_SIZE = 25;

export default function Orders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addItem, clear } = useCart();
  const { toast } = useToast();
  const [search, setSearch] = useState('');

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['my-orders', user?.email],
    enabled: !!user,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * ORDERS_PAGE_SIZE;
      const to = from + ORDERS_PAGE_SIZE - 1;
      const { data: rows, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_email', user.email)
        .order('created_date', { ascending: false })
        .range(from, to);
      if (error) throw error;
      return rows || [];
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === ORDERS_PAGE_SIZE ? allPages.length : undefined,
  });

  const orders = useMemo(() => (data?.pages || []).flat(), [data]);

  const filtered = orders.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.restaurant_name?.toLowerCase().includes(q) ||
      o.order_number?.toLowerCase().includes(q) ||
      o.status?.toLowerCase().includes(q)
    );
  });

  const reorder = async (order) => {
    try {
      const restaurant = await melaeat.entities.Restaurant.get(order.restaurant_id);
      clear();
      for (const it of order.items) {
        // unit_price already includes selected option price deltas — use it directly
        const menuItem = { id: it.menu_item_id, name: it.name, price: it.unit_price, image_url: it.image_url || '' };
        addItem(restaurant, menuItem, it.quantity, it.selected_options || [], it.notes || '');
      }
      toast({ title: 'Items added to cart' });
      navigate('/cart');
    } catch (error) {
      toast({ title: 'Could not reorder', description: error.message || 'Please try again.', variant: 'destructive' });
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-display text-3xl font-semibold mb-6">Your orders</h1>

      {isError ? (
        <div className="text-center py-20 space-y-3">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
          <p className="font-display text-xl">Could not load orders</p>
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-secondary rounded-2xl animate-pulse" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20">
          <p className="font-display text-2xl mb-2">No orders yet</p>
          <p className="text-muted-foreground mb-6">Discover restaurants and place your first order.</p>
          <Button asChild className="rounded-full"><Link to="/browse">Browse restaurants</Link></Button>
        </div>
      ) : (
        <>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by restaurant or status"
              className="pl-9"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No orders match that search.</p>
          ) : (
            <div className="space-y-3">
              {search.trim() && hasNextPage && (
                <p className="text-xs text-muted-foreground -mt-2 mb-2">
                  Searching loaded orders only. Load more below to extend the search.
                </p>
              )}
              {filtered.map((o) => {
                const deliveredAt = o.delivered_at ? new Date(o.delivered_at).getTime() : 0;
                const within48h = deliveredAt > 0 && Date.now() - deliveredAt < 48 * 60 * 60 * 1000;
                const needsRating = o.status === 'delivered' && within48h && !o.customer_rating_restaurant;
                return (
                  <div key={o.id} className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                      {needsRating ? (
                        <Button size="sm" onClick={() => navigate(`/order/${o.id}`)}>
                          <Star className="w-3.5 h-3.5 mr-1 fill-current" /> Rate
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => navigate(`/order/${o.id}`)}>
                          Details <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => reorder(o)}>
                        <Repeat className="w-3.5 h-3.5 mr-1" /> Reorder
                      </Button>
                    </div>
                  </div>
                );
              })}
              {hasNextPage && (
                <div className="pt-2 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading…
                      </>
                    ) : (
                      'Load more'
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
