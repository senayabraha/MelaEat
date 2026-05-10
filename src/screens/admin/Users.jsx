import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { melaeat } from '@/api/apiClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';

export default function AdminUsers() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users-full'],
    queryFn: () => melaeat.entities.User.list('-created_date', 500),
  });

  const setRole = async (user, role) => {
    await melaeat.entities.User.update(user.id, { role });
    qc.invalidateQueries({ queryKey: ['admin-users-full'] });
    toast({ title: 'Role updated' });
  };

  const setDriverApproval = async (user, driver_approval_status) => {
    await melaeat.entities.User.update(user.id, { driver_approval_status });
    qc.invalidateQueries({ queryKey: ['admin-users-full'] });
    toast({ title: 'Driver approval updated' });
  };

  return (
    <div className="p-6 sm:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Users create their own accounts from the sign up screen. Use this page to review accounts and change roles after signup.
        </p>
      </div>
      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        {users.length === 0 && (
          <div className="p-6">
            <p className="font-medium">No users yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Ask team members to sign up first, then return here to assign roles.</p>
            <Button asChild className="mt-4">
              <Link to="/signup">Go to signup</Link>
            </Button>
          </div>
        )}
        {users.map((user) => (
          <div key={user.id} className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
              {(user.full_name || 'U').charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{user.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <Select value={user.role} onValueChange={(value) => setRole(user, value)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="restaurant">Restaurant</SelectItem>
                <SelectItem value="driver">Driver</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            {user.role === 'driver' && (
              <Select
                value={user.driver_approval_status || 'pending'}
                onValueChange={(value) => setDriverApproval(user, value)}
              >
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
