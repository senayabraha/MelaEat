import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import Logo from './Logo';
import { Button } from '@/components/ui/button';

export default function DashboardSidebar({ items, title, user, logoutRole = 'customer' }) {
  const navigate = useNavigate();

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-card sticky top-0 h-screen">
      <div className="p-5 border-b border-border">
        <Logo linkTo="/" />
        <div className="mt-3 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          {title}
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`
            }
          >
            <it.icon className="w-4 h-4" />
            {it.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-border">
        {user && (
          <div className="px-3 py-2 mb-2">
            <div className="text-sm font-medium truncate">{user.full_name}</div>
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
          </div>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground"
          size="sm"
          onClick={() => navigate(`/logout/${logoutRole}`)}
        >
          <LogOut className="w-4 h-4 mr-2" /> Sign out
        </Button>
      </div>
    </aside>
  );
}
