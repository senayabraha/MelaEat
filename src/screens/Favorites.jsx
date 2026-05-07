import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import RestaurantCard from '@/components/customer/RestaurantCard';
import { Button } from '@/components/ui/button';

export default function Favorites() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin(window.location.href));
  }, []);

  const ids = user?.favorite_restaurant_ids || [];

  const { data: restaurants = [] } = useQuery({
    queryKey: ['favorites', ids],
    queryFn: async () => {
      if (ids.length === 0) return [];
      const all = await base44.entities.Restaurant.filter({ status: 'approved' }, '-created_date', 200);
      return all.filter((r) => ids.includes(r.id));
    },
    enabled: !!user,
  });

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-display text-3xl font-semibold mb-8">Your favorites</h1>
      {restaurants.length === 0 ? (
        <div className="text-center py-20">
          <p className="font-display text-2xl mb-2">No favorites yet</p>
          <p className="text-muted-foreground mb-6">Tap the heart on any restaurant to save it here.</p>
          <Button asChild className="rounded-full"><Link to="/">Browse restaurants</Link></Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
          {restaurants.map((r) => <RestaurantCard key={r.id} restaurant={r} />)}
        </div>
      )}
    </div>
  );
}