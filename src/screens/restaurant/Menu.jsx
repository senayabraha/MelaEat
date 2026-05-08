import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import MenuItemForm from '@/components/restaurant/MenuItemForm';
import { formatETB } from '@/lib/format';
import { useToast } from '@/components/ui/use-toast';
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

export default function RestaurantMenu() {
  const { user } = useOutletContext();
  const [restaurant, setRestaurant] = useState(null);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      let res = await base44.entities.Restaurant.filter({ owner_email: user.email });
      if (res.length === 0 && user.restaurant_id) res = [await base44.entities.Restaurant.get(user.restaurant_id)];
      setRestaurant(res[0]);
    })();
  }, [user.email]);

  const { data: categories = [] } = useQuery({
    queryKey: ['rest-cats', restaurant?.id],
    queryFn: () => base44.entities.MenuCategory.filter({ restaurant_id: restaurant.id }, 'sort_order'),
    enabled: !!restaurant,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['rest-items', restaurant?.id],
    queryFn: () => base44.entities.MenuItem.filter({ restaurant_id: restaurant.id }, 'sort_order'),
    enabled: !!restaurant,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['rest-cats'] });
    qc.invalidateQueries({ queryKey: ['rest-items'] });
  };

  const addCategory = async () => {
    if (!newCategory.trim()) return;
    await base44.entities.MenuCategory.create({ restaurant_id: restaurant.id, name: newCategory.trim(), sort_order: categories.length });
    setNewCategory('');
    refresh();
  };
  const deleteCategory = async (c) => {
    const its = items.filter(i => i.category_id === c.id);
    await Promise.all(its.map(i => base44.entities.MenuItem.delete(i.id)));
    await base44.entities.MenuCategory.delete(c.id);
    setDeleteTarget(null);
    refresh();
  };
  const toggleStock = async (it) => {
    await base44.entities.MenuItem.update(it.id, { in_stock: !it.in_stock });
    refresh();
    toast({ title: it.in_stock ? 'Marked out of stock' : 'Marked in stock' });
  };
  const setCategoryStock = async (categoryId, inStock) => {
    const cItems = items.filter(i => i.category_id === categoryId);
    await Promise.all(cItems.map((it) => base44.entities.MenuItem.update(it.id, { in_stock: inStock })));
    refresh();
    toast({ title: inStock ? 'Category marked in stock' : 'Category marked out of stock' });
  };
  const deleteItem = async (it) => {
    await base44.entities.MenuItem.delete(it.id);
    setDeleteTarget(null);
    refresh();
  };

  if (!restaurant) return null;

  return (
    <div className="p-6 sm:p-8 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <h1 className="font-display text-3xl font-semibold">Menu</h1>
        <Button onClick={() => { setEditing(null); setOpen(true); }} disabled={categories.length === 0}>
          <Plus className="w-4 h-4 mr-1" /> New item
        </Button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 mb-6">
        <h2 className="font-medium mb-3">Categories</h2>
        {categories.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-4 mb-4">
            <p className="font-medium">No categories yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Add a category first, then create menu items.</p>
          </div>
        )}
        <div className="flex gap-2 flex-wrap mb-3">
          {categories.map(c => (
            <div key={c.id} className="flex items-center gap-2 bg-secondary rounded-full pl-3 pr-1.5 py-1">
              <span className="text-sm">{c.name}</span>
              <button onClick={() => setDeleteTarget({ type: 'category', value: c })} className="w-5 h-5 rounded-full hover:bg-destructive/20 flex items-center justify-center">
                <Trash2 className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 max-w-sm">
          <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category name" />
          <Button variant="outline" onClick={addCategory}>Add</Button>
        </div>
      </div>

      {categories.map((c) => {
        const cItems = items.filter(i => i.category_id === c.id);
        return (
          <div key={c.id} className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="font-display text-xl font-semibold">{c.name}</h3>
              {cItems.length > 0 && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCategoryStock(c.id, true)}>All in stock</Button>
                  <Button variant="outline" size="sm" onClick={() => setCategoryStock(c.id, false)}>All out</Button>
                </div>
              )}
            </div>
            <div className="bg-card border border-border rounded-2xl divide-y divide-border">
              {cItems.length === 0 && (
                <div className="p-5">
                  <p className="text-sm text-muted-foreground">No items in this category.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => {
                      setEditing({ category_id: c.id });
                      setOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add first item
                  </Button>
                </div>
              )}
              {cItems.map(it => (
                <div key={it.id} className="p-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-lg bg-secondary overflow-hidden shrink-0">
                    {it.image_url && <img src={it.image_url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{it.name}</p>
                    <p className="text-sm text-muted-foreground">{formatETB(it.price)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-secondary">
                      <Switch checked={!!it.in_stock} onCheckedChange={() => toggleStock(it)} />
                      <span className="text-xs">{it.in_stock ? 'In' : 'Out'}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(it); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ type: 'item', value: it })}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <MenuItemForm
        open={open}
        onClose={() => setOpen(false)}
        onSave={refresh}
        item={editing}
        categories={categories}
        restaurantId={restaurant.id}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.type === 'category' ? 'category' : 'item'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'category'
                ? `This will delete "${deleteTarget.value.name}" and all menu items inside it.`
                : `This will delete "${deleteTarget?.value.name}" from your menu.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget?.type === 'category') deleteCategory(deleteTarget.value);
                if (deleteTarget?.type === 'item') deleteItem(deleteTarget.value);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
