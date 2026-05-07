import React from 'react';
import { Check } from 'lucide-react';
import { statusLabel } from '@/lib/format';

const FLOW = ['pending', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way', 'delivered'];

export default function OrderStatusTimeline({ status }) {
  if (status === 'rejected' || status === 'cancelled') {
    return (
      <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 text-center">
        <p className="font-medium text-destructive">{statusLabel(status)}</p>
      </div>
    );
  }
  const currentIndex = FLOW.indexOf(status);
  return (
    <div className="space-y-3">
      {FLOW.map((s, i) => {
        const done = i <= currentIndex;
        const active = i === currentIndex;
        return (
          <div key={s} className="flex items-center gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
              done ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground'
            }`}>
              {done ? <Check className="w-3.5 h-3.5" /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
            </div>
            <span className={`text-sm ${active ? 'font-semibold' : done ? 'text-foreground' : 'text-muted-foreground'}`}>
              {statusLabel(s)}
            </span>
            {active && (
              <span className="ml-auto text-xs font-medium text-primary">In progress</span>
            )}
          </div>
        );
      })}
    </div>
  );
}