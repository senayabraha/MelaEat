import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { melaeat } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminRestaurants() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', owner_email: '', city: 'Addis Ababa' });
  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ['admin-restaurants-full'],
    queryFn: () => melaeat.entities.Restaurant.list('-created_date', 500),
  });

  const updateStatus = async (r, status) => {
    await melaeat.entities.Restaurant.update(r.id, { status });
    qc.invalidateQueries({ queryKey: ['admin-restaurants-full'] });
  };

  const create = async () => {
    if (!form.name.trim() || !form.owner_email.trim()) return;
    await melaeat.entities.Restaurant.create({
      name: form.name.trim(),
      owner_email: form.owner_email.trim().toLowerCase(),
      city: form.city.trim() || 'Addis Ababa',
      status: 'pending',
    });
    setShowCreate(false);
    setForm({ name: '', owner_email: '', city: 'Addis Ababa' });
    qc.invalidateQueries({ queryKey: ['admin-restaurants-full'] });
  };

  return (
    <div className="p-6 sm:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-semibold">Restaurants</h1>
        <Button onClick={() => setShowCreate(true)}>Add restaurant</Button>
      </div>
      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        {isLoading && (
          <div className="p-6 space-y-3">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}
        {!isLoading && restaurants.length === 0 && (
          <div className="p-6">
            <p className="font-medium">No restaurants yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Add your first restaurant to start onboarding partners.</p>
            <Button className="mt-4" onClick={() => setShowCreate(true)}>Add restaurant</Button>
          </div>
        )}
        {restaurants.map((r) => (
          <div key={r.id} className="p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.owner_email}  |  {r.city}</p>
            </div>
            <Select value={r.status} onValueChange={(v) => updateStatus(r, v)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add restaurant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Restaurant name</Label>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <div>
              <Label className="mb-2 block">Owner email</Label>
              <Input value={form.owner_email} onChange={(event) => setForm({ ...form, owner_email: event.target.value })} />
            </div>
            <div>
              <Label className="mb-2 block">City</Label>
              <Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={create} disabled={!form.name.trim() || !form.owner_email.trim()}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
