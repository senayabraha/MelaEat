import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Truck, History, Wallet, User, Settings, LogOut } from 'lucide-react';
import DashboardSidebar from './DashboardSidebar';
import DashboardMobileNav from './DashboardMobileNav';
import { useAuth } from '@/lib/AuthContext';

const ITEMS = [
  { to: '/driver', label: 'Today', icon: LayoutDashboard, end: true },
  { to: '/driver/active', label: 'Active', icon: Truck },
  { to: '/driver/history', label: 'History', icon: History },
  { to: '/driver/earnings', label: 'Earnings', icon: Wallet },
  { to: '/driver/profile', label: 'Profile', icon: User },
  { to: '/driver/settings', label: 'Settings', icon: Settings },
];

export default function DriverLayout() {
  const navigate = useNavigate();
  const { user, checkUserAuth } = useAuth();

  if (!user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      <DashboardSidebar items={ITEMS} title="Driver" user={user} logoutRole="driver" />
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        <Outlet context={{ user, refreshUser: checkUserAuth }} />
      </main>
      <DashboardMobileNav items={[
        { to: '/driver', label: 'Today', icon: LayoutDashboard, end: true },
        { to: '/driver/active', label: 'Active', icon: Truck },
        { to: '/driver/profile', label: 'Profile', icon: User },
        { to: '/driver/settings', label: 'Settings', icon: Settings },
        { label: 'Logout', icon: LogOut, action: () => navigate('/logout/driver') },
      ]} />
    </div>
  );
}
