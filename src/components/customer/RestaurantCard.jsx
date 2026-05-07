import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Clock, Bike } from 'lucide-react';
import { formatETB, isOpenNow } from '@/lib/format';

export default function RestaurantCard({ restaurant }) {
  const open = isOpenNow(restaurant);
  return (
    <Link
      to={`/restaurant/${restaurant.id}`}
      className="group block animate-fade-up"
    >
      <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-secondary mb-3">
        {restaurant.cover_image_url ? (
          <img
            src={restaurant.cover_image_url}
            alt={restaurant.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <span className="font-display text-4xl text-primary/40">{restaurant.name?.[0]}</span>
          </div>
        )}
        {!open && (
          <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px] flex items-center justify-center">
            <span className="bg-foreground text-background px-3 py-1 rounded-full text-xs font-semibold">
              Closed
            </span>
          </div>
        )}
        {restaurant.is_featured && open && (
          <div className="absolute top-3 left-3 bg-accent text-accent-foreground px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide">
            Featured
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-semibold text-lg leading-tight group-hover:text-primary transition-colors">
            {restaurant.name}
          </h3>
          {restaurant.rating > 0 && (
            <div className="flex items-center gap-1 text-sm shrink-0">
              <Star className="w-3.5 h-3.5 fill-accent text-accent" />
              <span className="font-medium">{restaurant.rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-1">
          {(restaurant.cuisines || []).slice(0, 3).join(' · ') || restaurant.description}
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {restaurant.estimated_prep_minutes || 25} min
          </span>
          <span className="flex items-center gap-1">
            <Bike className="w-3.5 h-3.5" />
            {formatETB(restaurant.delivery_fee || 0)}
          </span>
        </div>
      </div>
    </Link>
  );
}