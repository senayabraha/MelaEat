import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Truck, History, Wallet, User, Settings, LogOut } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import DashboardSidebar from './DashboardSidebar';
import DashboardMobileNav from './DashboardMobileNav';

const ITEMS = [
  { to: '/driver', label: 'Today', icon: LayoutDashboard, end: true },
  { to: '/driver/active', label: 'Active', icon: Truck },
  { to: '/driver/history', label: 'History', icon: History },
  { to: '/driver/earnings', label: 'Earnings', icon: Wallet },
  { to: '/driver/profile', label: 'Profile', icon: User },
  { to: '/driver/settings', label: 'Settings', icon: Settings },
];

export default function DriverLayout() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then((u) => {
      if (u.role !== 'driver' && u.role !== 'admin') {
        navigate('/');
        return;
      }
      setUser(u);
    }).catch(() => base44.auth.redirectToLogin(window.location.href, 'driver'));
  }, [navigate]);

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
        <Outlet context={{ user, refreshUser: async () => setUser(await base44.auth.me()) }} />
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
