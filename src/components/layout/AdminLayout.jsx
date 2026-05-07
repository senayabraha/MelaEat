import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Store, Users, ClipboardList } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import DashboardSidebar from './DashboardSidebar';
import DashboardMobileNav from './DashboardMobileNav';

const ITEMS = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/restaurants', label: 'Restaurants', icon: Store },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
];

export default function AdminLayout() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then((u) => {
      if (u.role !== 'admin') { navigate('/'); return; }
      setUser(u);
    }).catch(() => base44.auth.redirectToLogin(window.location.href));
  }, [navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen flex bg-background">
      <DashboardSidebar items={ITEMS} title="Admin" user={user} />
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        <Outlet context={{ user }} />
      </main>
      <DashboardMobileNav items={ITEMS} />
    </div>
  );
}