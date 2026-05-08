import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/cart';
import { formatETB } from '@/lib/format';

export default function Cart() {
  const { cart, updateQuantity, removeItem, subtotal, itemCount } = useCart();
  const navigate = useNavigate();

  if (itemCount === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-5">
          <ShoppingBag className="w-7 h-7 text-muted-foreground" />
        </div>
        <h1 className="font-display text-3xl font-semibold mb-2">Your cart is empty</h1>
        <p className="text-muted-foreground mb-6">Discover restaurants and start your order.</p>
        <Button asChild className="rounded-full px-6">
          <Link to="/browse">Browse restaurants</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-display text-3xl font-semibold mb-1">Your cart</h1>
      <p className="text-muted-foreground mb-8">From {cart.restaurant_name}</p>

      <div className="space-y-3 mb-8">
        {cart.items.map((it) => (
          <div key={it.line_id} className="flex gap-4 bg-card border border-border rounded-2xl p-4">
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-secondary shrink-0">
              {it.image_url ? (
                <img src={it.image_url} alt={it.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/10 to-accent/10" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-medium">{it.name}</h4>
                <button onClick={() => removeItem(it.line_id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {(it.selected_options || []).length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {it.selected_options.map((o) => o.choice_name).join('  |  ')}
                </p>
              )}
              {it.notes && <p className="text-xs text-muted-foreground italic mt-1">"{it.notes}"</p>}
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2 border border-border rounded-full px-1 py-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(it.line_id, it.quantity - 1)}>
                    <Minus className="w-3.5 h-3.5" />
                  </Button>
                  <span className="text-sm font-medium w-5 text-center">{it.quantity}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(it.line_id, it.quantity + 1)}>
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <span className="font-medium">{formatETB(it.line_total)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatETB(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm mb-4 text-muted-foreground">
          <span>Delivery & fees</span>
          <span>Calculated at checkout</span>
        </div>
        <Button onClick={() => navigate('/checkout')} className="w-full h-12 rounded-full text-base">
          Continue to checkout  |  {formatETB(subtotal)}
        </Button>
      </div>
    </div>
  );
}
