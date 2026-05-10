import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import CustomerHeader from './CustomerHeader';
import NotificationPermissionBanner from '@/components/customer/NotificationPermissionBanner';
import useOrderNotifications from '@/hooks/useOrderNotifications';

export default function CustomerLayout() {
  useOrderNotifications();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <CustomerHeader />
      <NotificationPermissionBanner />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border/60 mt-16 py-10 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            (c) {new Date().getFullYear()} MelaEat. Made for Ethiopia.
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link to="/signup/restaurant" className="hover:text-foreground">For Restaurants</Link>
            <Link to="/signup/driver" className="hover:text-foreground">For Drivers</Link>
            <Link to="/orders" className="hover:text-foreground">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
