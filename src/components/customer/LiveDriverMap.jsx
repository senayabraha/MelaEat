import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/api/apiClient';

// Driver marker uses a tinted version of the default Leaflet pin so we don't
// pull in another asset. The customer pin stays as the standard icon.
const driverIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      width:28px;height:28px;border-radius:9999px;
      background:#0a7d3a;color:#fff;
      display:flex;align-items:center;justify-content:center;
      font-size:14px;font-weight:700;
      box-shadow:0 0 0 4px rgba(10,125,58,0.18), 0 2px 6px rgba(0,0,0,0.25);
    ">D</div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const customerIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      width:24px;height:24px;border-radius:9999px;
      background:#111;color:#fff;
      display:flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:700;
      box-shadow:0 0 0 4px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.25);
    ">Y</div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    const valid = points.filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    if (valid.length === 0) return;
    if (valid.length === 1) {
      map.setView(valid[0], 15, { animate: true });
      return;
    }
    map.fitBounds(L.latLngBounds(valid), { padding: [40, 40], maxZoom: 16 });
  }, [points, map]);
  return null;
}

const formatAge = (updatedAt) => {
  if (!updatedAt) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
};

// Subscribes to driver_locations for a single driver and renders a small map
// with the customer's pin + the driver's live pin. RLS already restricts
// reads — this component does not gate on order status itself.
export default function LiveDriverMap({ driverEmail, customerLat, customerLng, height = 240 }) {
  const [location, setLocation] = useState(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!driverEmail) return undefined;

    let cancelled = false;

    const seed = async () => {
      const { data } = await supabase
        .from('driver_locations')
        .select('lat, lng, heading, accuracy, updated_at')
        .eq('driver_email', driverEmail)
        .maybeSingle();
      if (!cancelled && data) setLocation(data);
    };

    seed();

    const channel = supabase
      .channel(`driver-loc-${driverEmail}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_locations', filter: `driver_email=eq.${driverEmail}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setLocation(null);
            return;
          }
          if (payload.new) setLocation(payload.new);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [driverEmail]);

  // 1Hz tick keeps the "X seconds ago" label fresh.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const driverLatLng = location && Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng))
    ? [Number(location.lat), Number(location.lng)]
    : null;
  const customerLatLng = Number.isFinite(Number(customerLat)) && Number.isFinite(Number(customerLng))
    ? [Number(customerLat), Number(customerLng)]
    : null;

  // Center: prefer driver if known, else customer, else Addis Ababa.
  const center = driverLatLng || customerLatLng || [9.0320, 38.7469];

  return (
    <div className="rounded-2xl overflow-hidden border border-border" style={{ height }}>
      <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }} attributionControl={false}>
        <TileLayer
          attribution='(c) OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {customerLatLng && <Marker position={customerLatLng} icon={customerIcon}><Popup>Your delivery pin</Popup></Marker>}
        {driverLatLng && (
          <Marker position={driverLatLng} icon={driverIcon}>
            <Popup>Driver — updated {formatAge(location?.updated_at)}</Popup>
          </Marker>
        )}
        <FitBounds points={[driverLatLng, customerLatLng].filter(Boolean)} />
      </MapContainer>
    </div>
  );
}
