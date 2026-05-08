import React from 'react';
import { Phone, MapPin, Clock, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatETB, statusLabel, statusColor, timeAgo, paymentStatusLabel, paymentStatusColor } from '@/lib/format';

export default function OrderTicket({ order, onAccept, onReject, onAdvance, onAssign, drivers = [] }) {
  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Order ${order.order_number}</title>
      <style>
        body{font-family:monospace;padding:20px;max-width:300px}
        h2{margin:0 0 8px}
        .row{display:flex;justify-content:space-between;margin:4px 0}
        .total{border-top:1px dashed #000;margin-top:8px;padding-top:8px;font-weight:bold}
      </style></head><body>
      <h2>${order.restaurant_name}</h2>
      <div>Order ${order.order_number}</div>
      <div>${new Date(order.created_date).toLocaleString()}</div>
      <hr>
      <div><b>${order.customer_name}</b></div>
      <div>${order.customer_phone}</div>
      <div>${order.delivery_address_text || ''}</div>
      <hr>
      ${order.items.map(it => `<div class="row"><span>${it.quantity}x ${it.name}</span><span>${it.line_total} ETB</span></div>`).join('')}
      <div class="row total"><span>TOTAL</span><span>${order.total} ETB</span></div>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  const next = (() => {
    if (order.status === 'preparing') return { label: 'Mark ready', value: 'ready_for_pickup' };
    return null;
  })();

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-border flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded border ${statusColor(order.status)}`}>{statusLabel(order.status)}</span>
            <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded border ${paymentStatusColor(order.payment_status)}`}>{paymentStatusLabel(order.payment_status)}</span>
            <span className="text-xs text-muted-foreground">{timeAgo(order.created_date)}</span>
          </div>
          <h3 className="font-display text-lg font-semibold">{order.order_number}</h3>
          <p className="text-sm text-muted-foreground">{order.customer_name}</p>
        </div>
        <Button size="icon" variant="outline" onClick={handlePrint}><Printer className="w-4 h-4" /></Button>
      </div>

      <div className="p-5 space-y-1.5 text-sm">
        {order.items.map((it, i) => (
          <div key={i} className="flex justify-between">
            <span><span className="font-medium">{it.quantity}x</span> {it.name}
              {(it.selected_options || []).length > 0 && (
                <span className="text-muted-foreground text-xs block ml-5">{it.selected_options.map(o => o.choice_name).join(', ')}</span>
              )}
              {it.notes && <span className="text-muted-foreground text-xs italic block ml-5">"{it.notes}"</span>}
            </span>
            <span>{formatETB(it.line_total)}</span>
          </div>
        ))}
        <div className="border-t border-border my-3" />
        <div className="flex justify-between font-semibold"><span>Total</span><span>{formatETB(order.total)}</span></div>
      </div>

      <div className="px-5 py-3 bg-secondary/40 text-xs text-muted-foreground space-y-1 border-t border-border">
        <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {order.customer_phone}</p>
        <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> {order.delivery_address_text || 'See pin'}</p>
        {order.is_scheduled && (
          <p className="flex items-center gap-2 text-primary font-medium"><Clock className="w-3.5 h-3.5" /> Scheduled: {new Date(order.scheduled_for).toLocaleString()}</p>
        )}
        {order.estimated_ready_at && (
          <p className="flex items-center gap-2 text-primary font-medium"><Clock className="w-3.5 h-3.5" /> Ready around {new Date(order.estimated_ready_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
        )}
      </div>

      <div className="p-4 border-t border-border flex flex-wrap gap-2">
        {order.status === 'pending' && (
          <>
            <Button size="sm" onClick={() => onAccept(order)} className="flex-1">Accept</Button>
            <Button size="sm" variant="outline" onClick={() => onReject(order)}>Reject</Button>
          </>
        )}
        {order.status === 'accepted' && (
          <div className="w-full">
            <p className="text-xs font-medium text-muted-foreground mb-2">Start prep with ready estimate</p>
            <div className="grid grid-cols-4 gap-2">
              {[10, 15, 20, 30].map((minutes) => (
                <Button
                  key={minutes}
                  size="sm"
                  variant="outline"
                  onClick={() => onAdvance(order, 'preparing', { estimated_ready_minutes: minutes })}
                >
                  {minutes}m
                </Button>
              ))}
            </div>
          </div>
        )}
        {next && (
          <Button size="sm" onClick={() => onAdvance(order, next.value)} className="flex-1">{next.label}</Button>
        )}
        {order.status === 'ready_for_pickup' && drivers.length > 0 && !order.driver_email && (
          <select
            onChange={(e) => e.target.value && onAssign(order, drivers.find(d => d.email === e.target.value))}
            className="flex-1 px-3 py-2 rounded-md border border-border bg-card text-sm"
            defaultValue=""
          >
            <option value="" disabled>Assign driver...</option>
            {drivers.map(d => <option key={d.email} value={d.email}>{d.full_name}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}
