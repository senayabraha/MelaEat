import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import RestaurantCard from '@/components/customer/RestaurantCard';
import CuisineFilter from '@/components/customer/CuisineFilter';
import { Link } from 'react-router-dom';

export default function Home() {
  const [search, setSearch] = useState('');
  const [cuisine, setCuisine] = useState('all');

  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ['restaurants'],
    queryFn: () => base44.entities.Restaurant.filter({ status: 'approved' }, '-is_featured', 100),
  });

  const filtered = useMemo(() => {
    return restaurants.filter((r) => {
      const matchesSearch =
        !search ||
        r.name?.toLowerCase().includes(search.toLowerCase()) ||
        (r.cuisines || []).some((c) => c.toLowerCase().includes(search.toLowerCase()));
      const matchesCuisine = cuisine === 'all' || (r.cuisines || []).includes(cuisine);
      return matchesSearch && matchesCuisine;
    });
  }, [restaurants, search, cuisine]);

  const featured = filtered.filter((r) => r.is_featured).slice(0, 3);
  const all = filtered.filter((r) => !featured.includes(r));

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 grain opacity-60" />
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-32 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary border border-border text-xs font-medium text-muted-foreground mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Now serving Addis Ababa & beyond
            </div>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight text-balance">
              Ethiopia's finest,
              <br />
              <span className="italic text-primary">delivered with care.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl text-balance">
              Discover beloved local kitchens and modern favorites — order in minutes, schedule for later, track every step.
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
          </div>
        </div>
      </section>

      {/* Cuisine pills */}
      <section className="sticky top-16 z-30 bg-background/85 backdrop-blur-xl border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <CuisineFilter value={cuisine} onChange={setCuisine} />
        </div>
      </section>

      {/* Restaurants */}
      <section id="restaurants" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isLoading ? (
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