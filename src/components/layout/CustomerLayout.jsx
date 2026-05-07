import React from 'react';
import { Outlet } from 'react-router-dom';
import CustomerHeader from './CustomerHeader';

export default function CustomerLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <CustomerHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border/60 mt-16 py-10 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} MelaEat. Made for Ethiopia.
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground">For Restaurants</a>
            <a href="#" className="hover:text-foreground">For Drivers</a>
            <a href="#" className="hover:text-foreground">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}