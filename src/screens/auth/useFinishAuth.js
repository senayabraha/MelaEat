import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { melaeat, supabase } from '@/api/apiClient';

export const roleDestinations = {
  customer: '/browse',
  restaurant: '/restaurant',
  driver: '/driver',
  admin: '/admin',
};

export const roleLabels = {
  customer: 'customer',
  restaurant: 'restaurant partner',
  driver: 'driver',
  admin: 'admin',
};

export const useFinishAuth = ({ selectedRole, restaurantName = '', params }) => {
  const navigate = useNavigate();

  const redirectTo = useMemo(() => {
    const target = params.get('redirect');
    if (!target) return roleDestinations[selectedRole];
    try {
      const decoded = decodeURIComponent(target);
      if (typeof window !== 'undefined' && decoded.startsWith(window.location.origin)) {
        return decoded.replace(window.location.origin, '') || '/';
      }
      if (decoded.startsWith('/')) return decoded;
    } catch {}
    return roleDestinations[selectedRole];
  }, [params, selectedRole]);

  const hasRedirect = Boolean(params.get('redirect'));

  const finishAuth = async () => {
    const currentUser = await melaeat.auth.me();
    let role = currentUser.role === 'user' ? selectedRole : currentUser.role;

    if (currentUser.role === 'user') {
      if (selectedRole === 'admin') {
        await supabase.auth.signOut();
        throw new Error('Admin accounts must be assigned by an existing admin before sign in.');
      }
      const updated = await melaeat.users.completeRole(selectedRole);
      role = updated.role;
    }

    if (role !== selectedRole && !(selectedRole === 'customer' && role === 'admin')) {
      if (role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error(
          `This account is registered as a ${roleLabels[role] || role}. Please use the ${roleLabels[role] || role} login page.`
        );
      }
    }

    if (role === 'restaurant' && !currentUser.restaurant_id) {
      await melaeat.users.setupRestaurant({
        name: restaurantName.trim() || currentUser.full_name || 'New Restaurant',
      });
    }

    navigate(hasRedirect ? redirectTo : roleDestinations[role] || '/browse', { replace: true });
  };

  return { finishAuth };
};
