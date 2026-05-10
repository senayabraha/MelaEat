import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { melaeat } from '@/api/apiClient';
import { Star, Clock, MapPin, Bike, Heart, AlertCircle } from 'lucide-react';
import MenuItemCard from '@/components/customer/MenuItemCard';
import ItemDetailDialog from '@/components/customer/ItemDetailDialog';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useCart } from '@/lib/cart';
import { formatETB, isOpenNow } from '@/lib/format';
import { useToast } from '@/components/ui/use-toast';

export default function RestaurantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState(null);
  const [user, setUser] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [pendingAdd, setPendingAdd] = useState(null);
  const { cart, addItem, itemCount, subtotal } = useCart();
  const { toast } = useToast();

  useEffect(() => {
    melaeat.auth.isAuthenticated().then(async (a) => {
      if (a) {
        try {
          setUser(await melaeat.auth.me());
        } catch (error) {
          // Auth check failed — continue as unauthenticated visitor
          console.error('Auth check error:', error);
        }
      }
    });
  }, []);

  const { data: restaurant, isLoading, isError: restaurantError } = useQuery({
    queryKey: ['restaurant', id],
    queryFn: () => melaeat.entities.Restaurant.get(id),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', id],
    queryFn: () => melaeat.entities.MenuCategory.filter({ restaurant_id: id }, 'sort_order'),
    enabled: !!id,
  });

  const { data: items = [], isError: itemsError } = useQuery({
    queryKey: ['menu-items', id],
    queryFn: () => melaeat.entities.MenuItem.filter({ restaurant_id: id }, 'sort_order'),
    enabled: !!id,
  });

  const grouped = useMemo(() => {
    const map = {};
    categories.forEach((c) => { map[c.id] = { category: c, items: [] }; });
    items.forEach((it) => {
      if (map[it.category_id]) map[it.category_id].items.push(it);
    });
    return Object.values(map).filter((g) => g.items.length > 0);
  }, [categories, items]);

  useEffect(() => {
    if (!activeCategory && grouped[0]) setActiveCategory(grouped[0].category.id);
  }, [grouped, activeCategory]);

  const isFavorite = user?.favorite_restaurant_ids?.includes(id);
  const open = isOpenNow(restaurant);

  const toggleFavorite = async () => {
    if (!user) {
      melaeat.auth.redirectToLogin(window.location.href);
      return;
    }
    const current = user.favorite_restaurant_ids || [];
    const next = isFavorite ? current.filter((x) => x !== id) : [...current, id];
    try {
      await melaeat.auth.updateMe({ favorite_restaurant_ids: next });
      setUser({ ...user, favorite_restaurant_ids: next });
    } catch (error) {
      toast({ title: 'Could not update favorites', description: error.message, variant: 'destructive' });
    }
  };

  const handleAddItem = (item) => setActiveItem(item);

  const handleConfirmAdd = ({ quantity, notes, selected_options }) => {
    const ok = addItem(restaurant, activeItem, quantity, selected_options, notes);
    if (ok === 'different_restaurant') {
      setPendingAdd({ item: activeItem, quantity, notes, selected_options });
      return;
    }
    if (ok) {
      toast({ title: 'Added to cart', description: activeItem.name });
    }
    setActiveItem(null);
  };

  const replaceCartAndAdd = () => {
    if (!pendingAdd) return;
    const ok = addItem(
      restaurant,
      pendingAdd.item,
      pendingAdd.quantity,
      pendingAdd.selected_options,
      pendingAdd.notes,
      { replaceExisting: true }
    );
    if (ok) {
      toast({ title: 'Cart updated', description: pendingAdd.item.name });
    }
    setPendingAdd(null);
    setActiveItem(null);
  };

  if (isLoading || !restaurant) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="aspect-[16/6] bg-secondary rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (restaurantError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
        <p className="font-display text-2xl">Could not load restaurant</p>
        <Button variant="outline" onClick={() => navigate('/browse')}>Back to browse</Button>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Hero */}
      <div className="relative h-64 sm:h-80 bg-secondary overflow-hidden">
        {restaurant.cover_image_url && (
          <img src={restaurant.cover_image_url} alt={restaurant.name} className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative">
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {!open && (
                  <span className="text-xs font-semibold uppercase tracking-wider bg-destructive/10 text-destructive px-2 py-1 rounded">
                    Currently closed
                  </span>
                )}
                {(restaurant.cuisines || []).slice(0, 3).map((c) => (
                  <span key={c} className="text-xs font-medium text-muted-foreground">{c}</span>
                ))}
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">{restaurant.name}</h1>
              {restaurant.description && (
                <p className="text-muted-foreground max-w-2xl">{restaurant.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-sm">
                {restaurant.rating > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Star className="w-4 h-4 fill-accent text-accent" />
                    <span className="font-medium">{restaurant.rating.toFixed(1)}</span>
                    <span className="text-muted-foreground">({restaurant.total_ratings})</span>
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-4 h-4" /> {restaurant.estimated_prep_minutes || 25} min
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Bike className="w-4 h-4" /> {formatETB(restaurant.delivery_fee || 0)} delivery
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="w-4 h-4" /> {restaurant.address_text || restaurant.city}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleFavorite}
              className="rounded-full shrink-0"
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-primary text-primary' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Category nav */}
        {grouped.length > 0 && (
          <div className="sticky top-16 z-20 bg-background/85 backdrop-blur-xl py-3 my-6 -mx-4 sm:-mx-0 px-4 sm:px-0">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {grouped.map((g) => (
                <button
                  key={g.category.id}
                  onClick={() => {
                    setActiveCategory(g.category.id);
                    document.getElementById(`cat-${g.category.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition ${
                    activeCategory === g.category.id
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-card border-border hover:border-foreground/40'
                  }`}
                >
                  {g.category.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Menu */}
        <div className="space-y-10 mt-6">
          {itemsError && (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-destructive" />
              <p>Could not load menu items. Please refresh the page.</p>
            </div>
          )}
          {!itemsError && grouped.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              This restaurant hasn&apos;t added menu items yet.
            </div>
          )}
          {grouped.map((g) => (
            <section key={g.category.id} id={`cat-${g.category.id}`} className="scroll-mt-32">
              <h2 className="font-display text-2xl font-semibold mb-4">{g.category.name}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {g.items.map((it) => (
                  <MenuItemCard key={it.id} item={it} onAdd={handleAddItem} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Floating cart button */}
      {itemCount > 0 && (
        <div className="fixed bottom-6 inset-x-0 z-30 flex justify-center px-4 pointer-events-none">
          <Button
            onClick={() => navigate('/cart')}
            className="pointer-events-auto h-12 px-6 rounded-full shadow-lg gap-3"
          >
            <span className="bg-primary-foreground/20 px-2 py-0.5 rounded-full text-xs font-semibold">{itemCount}</span>
            View cart
            <span className="opacity-80">{formatETB(subtotal)}</span>
          </Button>
        </div>
      )}

      <ItemDetailDialog
        item={activeItem}
        open={!!activeItem}
        onClose={() => setActiveItem(null)}
        onAdd={handleConfirmAdd}
      />

      <AlertDialog open={!!pendingAdd} onOpenChange={(open) => !open && setPendingAdd(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your cart?</AlertDialogTitle>
            <AlertDialogDescription>
              Your cart has items from {cart.restaurant_name}. Clear it to order from {restaurant.name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep cart</AlertDialogCancel>
            <AlertDialogAction onClick={replaceCartAndAdd}>Replace cart</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
