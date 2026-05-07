import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Tag } from 'lucide-react';

export default function RestaurantPromotions() {
  const { user } = useOutletContext();
  const [restaurant, setRestaurant] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  const qc = useQueryClient();

  useEffect(() => {
    (async () => {
      let res = await base44.entities.Restaurant.filter({ owner_email: user.email });
      if (res.length === 0 && user.restaurant_id) res = [await base44.entities.Restaurant.get(user.restaurant_id)];
      setRestaurant(res[0]);
    })();
  }, [user.email]);

  const { data: promos = [] } = useQuery({
    queryKey: ['rest-promos', restaurant?.id],
    queryFn: () => base44.entities.Promotion.filter({ restaurant_id: restaurant.id }, '-created_date'),
    enabled: !!restaurant,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['rest-promos'] });

  const create = async () => {
    await base44.entities.Promotion.create({ ...form, code: form.code.toUpperCase(), restaurant_id: restaurant.id, is_active: true });
    setOpen(false);
    setForm({});
    refresh();
  };

  const toggle = async (p) => {
    await base44.entities.Promotion.update(p.id, { is_active: !p.is_active });
    refresh();
  };

  const remove = async (p) => {
    if (!confirm('Delete promo?')) return;
    await base44.entities.Promotion.delete(p.id);
    refresh();
  };

  if (!restaurant) return null;

  return (
    <div className="p-6 sm:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl font-semibold">Promotions</h1>
        <Button onClick={() => { setForm({ discount_type: 'percentage', discount_value: 10 }); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> New promo
        </Button>
      </div>

      {promos.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl">
          <Tag className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-display text-xl mb-1">No promotions yet</p>
          <p className="text-muted-foreground text-sm">Create discount codes to attract more customers.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {promos.map(p => (
            <div key={p.id} className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-semibold bg-secondary px-2 py-0.5 rounded">{p.code}</span>
                  {!p.is_active && <span className="text-xs text-muted-foreground">(inactive)</span>}
                </div>
                <p className="text-sm">{p.title || '—'}</p>
                <p className="text-xs text-muted-foreground">
                  {p.discount_type === 'percentage' ? `${p.discount_value}% off` : p.discount_type === 'fixed' ? `${p.discount_value} ETB off` : 'Free delivery'}
                  {' · '} Used {p.times_used || 0} times
                </p>
              </div>
              <Switch checked={!!p.is_active} onCheckedChange={() => toggle(p)} />
              <Button variant="ghost" size="icon" onClick={() => remove(p)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New promotion</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Code</Label>
              <Input value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SAVE10" />
            </div>
            <div>
              <Label className="mb-2 block">Title</Label>
              <Input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="10% off your order" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-2 block">Type</Label>
                <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed amount</SelectItem>
                    <SelectItem value="free_delivery">Free delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">Value</Label>
                <Input type="number" value={form.discount_value || ''} onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Min. order (ETB)</Label>
              <Input type="number" value={form.min_order || ''} onChange={(e) => setForm({ ...form, min_order: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}