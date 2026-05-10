import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

const DISMISS_KEY = 'melaeat:notifPromptDismissed';

export default function NotificationPermissionBanner() {
  const { user } = useAuth();
  const [permission, setPermission] = useState(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported',
  );
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return window.localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!('Notification' in window)) return;
    setPermission(Notification.permission);
  }, []);

  if (!user) return null;
  if (permission !== 'default') return null;
  if (dismissed) return null;

  const request = async () => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
    } catch {
      setPermission('denied');
    }
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // localStorage can be blocked; the banner just won't be remembered.
    }
  };

  return (
    <div className="bg-primary/5 border-b border-primary/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center gap-3">
        <Bell className="w-4 h-4 text-primary shrink-0" />
        <p className="text-sm text-foreground/90 flex-1">
          Get notified the moment your order is accepted, ready, and on the way.
        </p>
        <Button size="sm" className="rounded-full" onClick={request}>
          Turn on
        </Button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
