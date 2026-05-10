import React, { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { melaeat, supabase } from '@/api/apiClient';
import { Search, ArrowRight, MapPin, Store, Bike, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import RestaurantCard from '@/components/customer/RestaurantCard';
import CuisineFilter from '@/components/customer/CuisineFilter';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function Home() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [cuisine, setCuisine] = useState('all');

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(handle);
  }, [search]);

  const { data: restaurants = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['restaurants'],
    queryFn: () => melaeat.entities.Restaurant.filter({ status: 'approved' }, '-is_featured', 100),
  });

  // Cheap head-count to detect first-time customers. We don't need the rows.
  const { data: orderCount = null } = useQuery({
    queryKey: ['my-order-count', user?.email],
    enabled: !!user?.email,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('customer_email', user.email);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const isNewCustomer =
    !!user
    && (user.role === 'user' || user.role === 'customer')
    && orderCount === 0
    && (user.favorite_restaurant_ids || []).length === 0;

  // Extra search pass: match menu items by name/description, then union those restaurants
  // into the visible set so a search for "tibs" or "injera" finds the kitchens that serve them.
  const { data: menuMatchRestaurantIds = [] } = useQuery({
    queryKey: ['menu-search', debouncedSearch],
    enabled: debouncedSearch.length >= 2,
    queryFn: async () => {
      const term = debouncedSearch.replace(/[%,]/g, ' ');
      const { data, error } = await supabase
        .from('menu_items')
        .select('restaurant_id')
        .eq('in_stock', true)
        .or(`name.ilike.%${term}%,description.ilike.%${term}%`)
        .limit(200);
      if (error) throw error;
      const ids = new Set();
      for (const row of data || []) if (row.restaurant_id) ids.add(row.restaurant_id);
      return Array.from(ids);
    },
  });

  const filtered = useMemo(() => {
    const term = debouncedSearch.toLowerCase();
    const menuIds = new Set(menuMatchRestaurantIds);
    return restaurants.filter((r) => {
      const matchesSearch =
        !term ||
        r.name?.toLowerCase().includes(term) ||
        (r.cuisines || []).some((c) => c.toLowerCase().includes(term)) ||
        menuIds.has(r.id);
      const matchesCuisine = cuisine === 'all' || (r.cuisines || []).includes(cuisine);
      return matchesSearch && matchesCuisine;
    });
  }, [restaurants, debouncedSearch, cuisine, menuMatchRestaurantIds]);

  const featured = filtered.filter((r) => r.is_featured).slice(0, 3);
  const all = filtered.filter((r) => !featured.includes(r));

  // Stats reflect currently visible restaurants so numbers match what the user sees
  const openCount = filtered.filter((r) => r.is_open_manual !== false).length;
  const averageFee = filtered.length
    ? Math.round(filtered.reduce((sum, r) => sum + (r.delivery_fee || 0), 0) / filtered.length)
    : 0;

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 grain opacity-60" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary border border-border text-xs font-medium text-muted-foreground mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Now serving Addis Ababa & beyond
            </div>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight text-balance">
              Ethiopia&apos;s finest,
              <br />
              <span className="italic text-primary">delivered with care.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl text-balance">
              Discover beloved local kitchens and modern favorites - order in minutes, schedule for later, track every step.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-xl">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search restaurants or cuisines"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-12 pl-11 rounded-full bg-card border-border shadow-sm"
                />
              </div>
              <Link
                to="#restaurants"
                className="h-12 px-6 rounded-full bg-foreground text-background font-medium flex items-center justify-center gap-2 hover:opacity-90 transition"
              >
                Explore <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Addis Ababa delivery</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <Store className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{openCount} open now</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <Bike className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Avg. {averageFee} ETB delivery</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cuisine pills */}
      <section className="sticky top-16 z-30 bg-background/85 backdrop-blur-xl border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <CuisineFilter value={cuisine} onChange={setCuisine} />
        </div>
      </section>

      {isNewCustomer && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-6 py-5 sm:px-8 sm:py-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <div className="flex-1 min-w-0">
              <p className="font-display text-xl sm:text-2xl font-semibold">
                Welcome{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Three quick steps: pick a restaurant, drop a delivery pin, place your order. Saving a delivery location now makes every checkout faster.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button asChild className="rounded-full">
                <Link to="/addresses">Set delivery location</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="#restaurants">Browse restaurants</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Restaurants */}
      <section id="restaurants" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isError ? (
          <div className="text-center py-20 space-y-3">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="font-display text-2xl">Could not load restaurants</p>
            <p className="text-muted-foreground">Check your connection and try again.</p>
            <Button variant="outline" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/3] rounded-2xl bg-secondary mb-3" />
                <div className="h-4 bg-secondary rounded w-2/3 mb-2" />
                <div className="h-3 bg-secondary rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-display text-2xl mb-2">No restaurants found</p>
            <p className="text-muted-foreground">Try a different search or cuisine.</p>
          </div>
        ) : (
          <>
            {featured.length > 0 && (
              <div className="mb-14">
                <div className="flex items-end justify-between mb-6">
                  <div>
                    <h2 className="font-display text-3xl font-semibold">Featured this week</h2>
                    <p className="text-muted-foreground mt-1">Hand-picked kitchens worth the trip.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
                  {featured.map((r) => (
                    <RestaurantCard key={r.id} restaurant={r} />
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="font-display text-3xl font-semibold">All restaurants</h2>
                <p className="text-muted-foreground mt-1">{all.length} places ready to deliver.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
              {all.map((r) => (
                <RestaurantCard key={r.id} restaurant={r} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
