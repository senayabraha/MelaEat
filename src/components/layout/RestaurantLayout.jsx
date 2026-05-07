import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, BookOpen, Tag, BarChart3, Settings } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import DashboardSidebar from './DashboardSidebar';
import DashboardMobileNav from './DashboardMobileNav';

const ITEMS = [
  { to: '/restaurant', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/restaurant/orders', label: 'Orders', icon: ClipboardList },
  { to: '/restaurant/menu', label: 'Menu', icon: BookOpen },
  { to: '/restaurant/promotions', label: 'Promotions', icon: Tag },
  { to: '/restaurant/reports', label: 'Reports', icon: BarChart3 },
  { to: '/restaurant/settings', label: 'Settings', icon: Settings },
];

export default function RestaurantLayout() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then((u) => {
      if (u.role !== 'restaurant' && u.role !== 'admin') {
        navigate('/');
        return;
      }
      setUser(u);
    }).catch(() => base44.auth.redirectToLogin(window.location.href));
  }, [navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen flex bg-background">
      <DashboardSidebar items={ITEMS} title="Restaurant" user={user} />
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        <Outlet context={{ user }} />
      </main>
      <DashboardMobileNav items={ITEMS.slice(0, 5)} />
    </div>
  );
}