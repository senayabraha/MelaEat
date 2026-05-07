import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

export default function AdminUsers() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users-full'],
    queryFn: () => base44.entities.User.list('-created_date', 500),
  });

  const setRole = async (u, role) => {
    await base44.entities.User.update(u.id, { role });
    qc.invalidateQueries({ queryKey: ['admin-users-full'] });
    toast({ title: 'Role updated' });
  };

  const invite = async () => {
    const email = prompt('Email to invite?');
    const role = prompt('Role (customer / restaurant / driver / admin)?', 'customer');
    if (!email || !role) return;
    await base44.users.inviteUser(email, role === 'admin' ? 'admin' : 'user');
    toast({ title: 'User invited' });
  };

  return (
    <div className="p-6 sm:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-semibold">Users</h1>
        <Button onClick={invite}>Invite user</Button>
      </div>
      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        {users.map(u => (
          <div key={u.id} className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
              {(u.full_name || 'U').charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{u.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
            </div>
            <Select value={u.role} onValueChange={(v) => setRole(u, v)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="restaurant">Restaurant</SelectItem>
                <SelectItem value="driver">Driver</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}