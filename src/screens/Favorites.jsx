import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { melaeat } from '@/api/apiClient';
import RestaurantCard from '@/components/customer/RestaurantCard';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function Favorites() {
  const { user } = useAuth();

  const ids = user?.favorite_restaurant_ids || [];

  const { data: restaurants = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['favorites', ids],
    queryFn: async () => {
      if (ids.length === 0) return [];
      const all = await melaeat.entities.Restaurant.filter({ status: 'approved' }, '-created_date', 200);
      return all.filter((r) => ids.includes(r.id));
    },
    enabled: !!user,
  });

  if (!user) return null;

  if (isError) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
        <p className="font-display text-xl">Could not load favorites</p>
        <Button variant="outline" onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-display text-3xl font-semibold mb-8">Your favorites</h1>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[4/3] rounded-2xl bg-secondary mb-3" />
              <div className="h-4 bg-secondary rounded w-2/3 mb-2" />
              <div className="h-3 bg-secondary rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : restaurants.length === 0 ? (
        <div className="text-center py-20">
          <p className="font-display text-2xl mb-2">No favorites yet</p>
          <p className="text-muted-foreground mb-6">Tap the heart on any restaurant to save it here.</p>
          <Button asChild className="rounded-full"><Link to="/browse">Browse restaurants</Link></Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
          {restaurants.map((r) => <RestaurantCard key={r.id} restaurant={r} />)}
        </div>
      )}
    </div>
  );
}
