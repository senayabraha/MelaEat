import React from 'react';
import { Plus } from 'lucide-react';
import { formatETB } from '@/lib/format';

export default function MenuItemCard({ item, onAdd }) {
  const disabled = !item.in_stock;
  return (
    <button
      onClick={() => !disabled && onAdd(item)}
      disabled={disabled}
      className={`group text-left w-full bg-card border border-border rounded-2xl p-4 flex gap-4 transition-all ${
        disabled ? 'opacity-60' : 'hover:border-foreground/30 hover:shadow-sm'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-display font-semibold text-base truncate">{item.name}</h4>
          {item.is_featured && (
            <span className="text-[10px] font-semibold uppercase tracking-wider bg-accent/20 text-accent-foreground px-1.5 py-0.5 rounded">
              Popular
            </span>
          )}
        </div>
        {item.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{item.description}</p>
        )}
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{formatETB(item.price)}</span>
          {disabled && <span className="text-xs text-destructive font-medium">Out of stock</span>}
          {item.is_vegetarian && <span className="text-xs text-success font-medium">Veg</span>}
          {item.is_spicy && <span className="text-xs">🌶️</span>}
        </div>
      </div>
      <div className="relative shrink-0">
        <div className="w-24 h-24 rounded-xl overflow-hidden bg-secondary">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/10 to-accent/10" />
          )}
        </div>
        {!disabled && (
          <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
            <Plus className="w-4 h-4" />
          </div>
        )}
      </div>
    </button>
  );
}