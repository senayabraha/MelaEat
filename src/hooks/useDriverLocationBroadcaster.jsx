import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';

const MIN_INTERVAL_MS = 7000;        // do not push more than once per ~7s
const ACTIVE_STATUSES = ['ready_for_pickup', 'picked_up', 'on_the_way'];

// Streams the driver's GPS into public.driver_locations while they have at
// least one active delivery. Throttled to ~1 push per 7s to avoid burning
// realtime quota and battery. Stops the moment there are no active orders,
// which mirrors the customer-side privacy guarantee (no broadcast outside
// of an active delivery window).
export default function useDriverLocationBroadcaster() {
  const { user } = useAuth();
  const lastPushRef = useRef(0);
  const watchIdRef = useRef(null);

  const isDriver = user?.role === 'driver';

  // Cheap head-count: do we have any active orders right now?
  const { data: activeCount = 0 } = useQuery({
    queryKey: ['driver-active-count', user?.email],
    enabled: !!user?.email && isDriver,
    refetchInterval: 30000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('driver_email', user.email)
        .in('status', ACTIVE_STATUSES);
      if (error) throw error;
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!isDriver || !user?.email) return undefined;
    if (activeCount === 0) return undefined;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return undefined;

    const upsert = async (position) => {
      const now = Date.now();
      if (now - lastPushRef.current < MIN_INTERVAL_MS) return;
      lastPushRef.current = now;

      const { latitude, longitude, heading, speed, accuracy } = position.coords;
      try {
        await supabase.from('driver_locations').upsert(
          {
            driver_email: user.email,
            lat: latitude,
            lng: longitude,
            heading: Number.isFinite(heading) ? heading : null,
            speed: Number.isFinite(speed) ? speed : null,
            accuracy: Number.isFinite(accuracy) ? accuracy : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'driver_email' },
        );
      } catch {
        // Fail soft — next watch tick will retry.
      }
    };

    const onError = () => {
      // Nothing useful to do here. Customer-side map will simply show the
      // last known position and "X ago" age.
    };

    watchIdRef.current = navigator.geolocation.watchPosition(upsert, onError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isDriver, user?.email, activeCount]);
}
