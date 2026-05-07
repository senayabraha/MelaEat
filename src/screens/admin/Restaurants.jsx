import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AdminRestaurants() {
  const qc = useQueryClient();
  const { data: restaurants = [] } = useQuery({
    queryKey: ['admin-restaurants-full'],
    queryFn: () => base44.entities.Restaurant.list('-created_date', 500),
  });

  const updateStatus = async (r, status) => {
    await base44.entities.Restaurant.update(r.id, { status });
    qc.invalidateQueries({ queryKey: ['admin-restaurants-full'] });
  };

  const create = async () => {
    const name = prompt('Restaurant name?');
    const ownerEmail = prompt('Owner email?');
    if (!name || !ownerEmail) return;
    await base44.entities.Restaurant.create({ name, owner_email: ownerEmail, city: 'Addis Ababa', status: 'approved' });
    qc.invalidateQueries({ queryKey: ['admin-restaurants-full'] });
  };

  return (
    <div className="p-6 sm:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-semibold">Restaurants</h1>
        <Button onClick={create}>Add restaurant</Button>
      </div>
      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        {restaurants.map(r => (
          <div key={r.id} className="p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.owner_email} · {r.city}</p>
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
    </div>
  );
}