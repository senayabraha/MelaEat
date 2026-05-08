import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/api/base44Client';
import Logo from '@/components/layout/Logo';

const allowedRoles = new Set(['customer', 'restaurant', 'driver', 'admin']);

export default function Logout() {
  const { role: routeRole } = useParams();
  const navigate = useNavigate();
  const role = allowedRoles.has(routeRole) ? routeRole : 'customer';

  useEffect(() => {
    let active = true;

    supabase.auth.signOut().finally(() => {
      if (active) navigate(`/login/${role}`, { replace: true });
    });

    return () => {
      active = false;
    };
  }, [navigate, role]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <Logo />
        </div>
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground mt-4">Signing out...</p>
      </div>
    </div>
  );
}
