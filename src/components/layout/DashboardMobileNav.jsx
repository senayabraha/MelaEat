import React from 'react';
import { NavLink } from 'react-router-dom';

export default function DashboardMobileNav({ items }) {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((it) => {
          if (it.action) {
            return (
              <button
                key={it.label}
                type="button"
                onClick={it.action}
                className="flex flex-col items-center gap-1 py-2.5 text-xs text-muted-foreground"
              >
                <it.icon className="w-5 h-5" />
                <span>{it.label}</span>
              </button>
            );
          }

          return (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-xs ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`
              }
            >
              <it.icon className="w-5 h-5" />
              <span>{it.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
