import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, BookOpen, Tag, BarChart3, Settings, User, LogOut } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import DashboardSidebar from './DashboardSidebar';
import DashboardMobileNav from './DashboardMobileNav';

const ITEMS = [
  { to: '/restaurant', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/restaurant/orders', label: 'Orders', icon: ClipboardList },
  { to: '/restaurant/menu', label: 'Menu', icon: BookOpen },
  { to: '/restaurant/promotions', label: 'Promotions', icon: Tag },
  { to: '/restaurant/reports', label: 'Reports', icon: BarChart3 },
  { to: '/restaurant/profile', label: 'Profile', icon: User },
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
    }).catch(() => base44.auth.redirectToLogin(window.location.href, 'restaurant'));
  }, [navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen flex bg-background">
      <DashboardSidebar items={ITEMS} title="Restaurant" user={user} logoutRole="restaurant" />
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        <Outlet context={{ user }} />
      </main>
      <DashboardMobileNav items={[
        { to: '/restaurant', label: 'Home', icon: LayoutDashboard, end: true },
        { to: '/restaurant/orders', label: 'Orders', icon: ClipboardList },
        { to: '/restaurant/menu', label: 'Menu', icon: BookOpen },
        { to: '/restaurant/profile', label: 'Profile', icon: User },
        { to: '/restaurant/settings', label: 'Settings', icon: Settings },
        { label: 'Logout', icon: LogOut, action: () => navigate('/logout/restaurant') },
      ]} />
    </div>
  );
}
