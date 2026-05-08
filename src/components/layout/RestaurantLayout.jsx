import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, BookOpen, Tag, BarChart3, Settings, User, LogOut } from 'lucide-react';
import DashboardSidebar from './DashboardSidebar';
import DashboardMobileNav from './DashboardMobileNav';
import { useAuth } from '@/lib/AuthContext';

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
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

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
