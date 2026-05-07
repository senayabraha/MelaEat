import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bike, Clock, Store, Utensils } from 'lucide-react';
import Logo from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';

const roles = {
  customer: {
    label: 'Customer',
    title: 'Order favorite Ethiopian meals without the back-and-forth.',
    description: 'Browse nearby restaurants, build a cart, choose delivery details, and follow the order from kitchen to doorstep.',
    image: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?auto=format&fit=crop&w=1200&q=80',
    icon: Utensils,
    destination: '/browse',
  },
  restaurant: {
    label: 'Restaurant',
    title: 'Turn your kitchen into a delivery-ready business.',
    description: 'Manage your restaurant profile, menu, promotions, and live orders from one focused dashboard.',
    image: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80',
    icon: Store,
    destination: '/restaurant',
  },
  driver: {
    label: 'Driver',
    title: 'Earn by delivering orders across your city.',
    description: 'Go online, accept available pickups, navigate to customers, and track delivery earnings.',
    image: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=1200&q=80',
    icon: Bike,
    destination: '/driver',
  },
};

const partnerRoles = ['restaurant', 'driver'];

export default function Landing() {
  const [activeRole, setActiveRole] = useState('customer');
  const active = roles[activeRole];
  const Icon = active.icon;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo linkTo="/" />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to={`/login?role=${activeRole}`}>Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to={`/login?mode=signup&role=${activeRole}`}>Sign up</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.9fr] gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
                <Clock className="w-3.5 h-3.5" />
                Built for customers, restaurants, and drivers
              </div>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight max-w-3xl">
                MelaEat connects local food, delivery work, and restaurant growth.
              </h1>
              <p className="text-lg text-muted-foreground mt-5 max-w-2xl">
                Customers discover meals, restaurants manage orders, and drivers handle delivery in one shared platform.
              </p>

              <div className="mt-8 rounded-lg border border-border bg-card p-2 max-w-xl">
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(roles).map(([key, role]) => {
                    const RoleIcon = role.icon;
                    const selected = activeRole === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveRole(key)}
                        className={`h-12 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition ${
                          selected
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                        }`}
                      >
                        <RoleIcon className="w-4 h-4" />
                        <span>{role.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-display text-xl font-semibold">{active.title}</h2>
                      <p className="text-sm text-muted-foreground mt-1">{active.description}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col sm:flex-row gap-3">
                    <Button asChild className="flex-1">
                      <Link to={`/login?mode=signup&role=${activeRole}`}>
                        Continue as {active.label} <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="flex-1">
                      <Link to={`/login?role=${activeRole}`}>I already have an account</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative min-h-[420px] overflow-hidden rounded-lg border border-border bg-card">
              <img
                src={active.image}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/5" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <p className="text-sm uppercase tracking-wide text-white/75">Selected role</p>
                <p className="font-display text-3xl font-semibold mt-1">{active.label}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border/60 bg-secondary/35">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-6">
              <div>
                <h2 className="font-display text-3xl font-semibold">Partner with MelaEat</h2>
                <p className="text-muted-foreground mt-2 max-w-2xl">
                  Restaurants and drivers get dedicated tools for the work they do every day.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link to="/browse">Browse as a customer</Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {partnerRoles.map((key) => {
                const role = roles[key];
                const PartnerIcon = role.icon;
                return (
                  <div key={key} className="rounded-lg border border-border bg-card p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                        <PartnerIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-display text-xl font-semibold">{role.label}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button asChild size="sm">
                            <Link to={`/login?mode=signup&role=${key}`}>Start as {role.label}</Link>
                          </Button>
                          <Button asChild size="sm" variant="ghost">
                            <Link to={`/login?role=${key}`}>Sign in</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
