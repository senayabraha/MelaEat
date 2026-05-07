import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Phone, MapPin, ExternalLink, AlertTriangle } from 'lucide-react';
import { formatETB, statusLabel, statusColor } from '@/lib/format';
import { useToast } from '@/components/ui/use-toast';
import OrderChat from '@/components/orders/OrderChat';

export default function DriverActive() {
  const { user } = useOutletContext();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [issueOrder, setIssueOrder] = React.useState(null);
  const [issueDescription, setIssueDescription] = React.useState('');

  // Available orders (ready, no driver yet)
  const { data: available = [] } = useQuery({
    queryKey: ['driver-available'],
    queryFn: async () => {
      const all = await base44.entities.Order.filter({ status: 'ready_for_pickup' }, '-created_date', 50);
      return all.filter(o => !o.driver_email);
    },
    refetchInterval: 8000,
    enabled: user.driver_status === 'online',
  });

  // Active orders for this driver
  const { data: active = [] } = useQuery({
    queryKey: ['driver-active', user.email],
    queryFn: async () => {
      const all = await base44.entities.Order.filter({ driver_email: user.email }, '-created_date', 20);
      return all.filter(o => ['ready_for_pickup', 'picked_up', 'on_the_way'].includes(o.status));
    },
    refetchInterval: 8000,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['driver-active'] });
    qc.invalidateQueries({ queryKey: ['driver-available'] });
  };

  const accept = async (o) => {
    await base44.orders.action(o.id, { action: 'driver_accept' });
    toast({ title: 'Delivery accepted' });
    refresh();
  };

  const updateStatus = async (o, status) => {
    await base44.orders.action(o.id, { action: status });
    refresh();
  };

  const reportIssue = async (o) => {
    setIssueOrder(o);
    setIssueDescription('');
  };

  const submitIssue = async () => {
    if (!issueDescription.trim() || !issueOrder) return;
    await base44.entities.IssueReport.create({
      order_id: issueOrder.id,
      reporter_email: user.email,
      reporter_role: 'driver',
      category: 'other',
      description: issueDescription.trim(),
    });
    setIssueOrder(null);
    toast({ title: 'Issue reported' });
  };

  return (
    <div className="p-6 sm:p-8 max-w-5xl">
      <h1 className="font-display text-3xl font-semibold mb-6">Active deliveries</h1>

      {active.length > 0 && (
        <div className="space-y-4 mb-10">
          {active.map(o => <ActiveCard key={o.id} order={o} onUpdateStatus={updateStatus} onReportIssue={reportIssue} />)}
        </div>
      )}

      <h2 className="font-display text-2xl font-semibold mb-4">Available pickups</h2>
      {user.driver_status !== 'online' && user.driver_status !== 'on_delivery' ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <p className="text-muted-foreground">Go online to see available deliveries.</p>
        </div>
      ) : available.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <p className="text-muted-foreground">No pickups available right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {available.map(o => (
            <div key={o.id} className="bg-card border border-border rounded-2xl p-5">
              <p className="font-medium">{o.restaurant_name}</p>
              <p className="text-sm text-muted-foreground mb-2">→ {o.delivery_address_text || 'Customer location'}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{formatETB(o.delivery_fee || 0)}</span>
                <Button size="sm" onClick={() => accept(o)}>Accept</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!issueOrder} onOpenChange={(open) => !open && setIssueOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report an issue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={issueDescription}
              onChange={(event) => setIssueDescription(event.target.value)}
              rows={4}
              placeholder="Describe what happened"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIssueOrder(null)}>Cancel</Button>
              <Button onClick={submitIssue} disabled={!issueDescription.trim()}>Submit issue</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActiveCard({ order, onUpdateStatus, onReportIssue }) {
  const next = (() => {
    if (order.status === 'ready_for_pickup') return { label: 'Picked up', value: 'picked_up' };
    if (order.status === 'picked_up') return { label: "I'm on the way", value: 'on_the_way' };
    if (order.status === 'on_the_way') return { label: 'Delivered', value: 'delivered' };
    return null;
  })();

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-border">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded border ${statusColor(order.status)}`}>{statusLabel(order.status)}</span>
            <h3 className="font-display text-lg font-semibold mt-2">{order.order_number}</h3>
          </div>
          <p className="text-lg font-semibold">{formatETB(order.delivery_fee || 0)}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <Stop title="Pickup" name={order.restaurant_name} address={order.restaurant_name} lat={null} />
          <Stop title="Drop-off" name={order.customer_name} phone={order.customer_phone} address={order.delivery_address_text} lat={order.delivery_lat} lng={order.delivery_lng} />
        </div>
      </div>
      <div className="p-4 flex flex-wrap gap-2">
        {next && <Button onClick={() => onUpdateStatus(order, next.value)} className="flex-1">{next.label}</Button>}
        <Button variant="outline" size="icon" onClick={() => window.open(`tel:${order.customer_phone}`)}><Phone className="w-4 h-4" /></Button>
        <Button variant="outline" size="icon" onClick={() => onReportIssue(order)}><AlertTriangle className="w-4 h-4" /></Button>
      </div>
      <div className="p-4 border-t border-border">
        <OrderChat orderId={order.id} currentRole="driver" recipientRole="customer" />
      </div>
    </div>
  );
}

function Stop({ title, name, phone, address, lat, lng }) {
  const mapsUrl = lat && lng ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : null;
  return (
    <div className="bg-secondary rounded-xl p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{title}</p>
      <p className="font-medium mt-1">{name}</p>
      {phone && <p className="text-xs text-muted-foreground">{phone}</p>}
      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" /> {address || '—'}</p>
      {mapsUrl && (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary font-medium flex items-center gap-1 mt-1.5">
          Navigate <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}
