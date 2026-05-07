import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { ShoppingBag, Truck, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';

const roles = [
  {
    key: 'customer',
    label: 'Customer',
    description: 'Browse restaurants and order food',
    icon: ShoppingBag,
    redirect: '/',
  },
  {
    key: 'restaurant',
    label: 'Restaurant Owner',
    description: 'Manage your restaurant, menu & orders',
    icon: Store,
    redirect: '/restaurant',
  },
  {
    key: 'driver',
    label: 'Delivery Driver',
    description: 'Accept and deliver orders',
    icon: Truck,
    redirect: '/driver',
  },
];

export default function RoleSelection() {
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { checkUserAuth } = useAuth();

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true);
    const role = roles.find((r) => r.key === selected);
    await base44.auth.updateMe({ role: role.key });
    // Refresh user in AuthContext so the redirect guard in App.jsx sees the new role
    await checkUserAuth();
    navigate(role.redirect);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl font-bold text-foreground mb-2">Welcome to MelaEat</h1>
          <p className="text-muted-foreground text-lg">How will you be using the platform?</p>
        </div>

        <div className="space-y-4 mb-8">
          {roles.map(({ key, label, description, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className={`w-full flex items-center gap-5 p-5 rounded-2xl border-2 transition-all text-left
                ${selected === key
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-secondary/50'
                }`}
            >
              <div className={`p-3 rounded-xl ${selected === key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold text-base">{label}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </button>
          ))}
        </div>

        <Button
          onClick={handleConfirm}
          disabled={!selected || loading}
          className="w-full h-12 text-base"
        >
          {loading ? 'Setting up your account...' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}
