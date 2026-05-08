import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Minus, Plus } from 'lucide-react';
import { formatETB } from '@/lib/format';

export default function ItemDetailDialog({ item, open, onClose, onAdd }) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selections, setSelections] = useState({});

  useEffect(() => {
    if (open) {
      setQuantity(1);
      setNotes('');
      setSelections({});
    }
  }, [open, item?.id]);

  const groups = item?.options || [];

  const toggleChoice = (groupName, choice, multi) => {
    setSelections((prev) => {
      const current = prev[groupName] || [];
      if (multi) {
        const exists = current.find((c) => c.name === choice.name);
        return { ...prev, [groupName]: exists ? current.filter((c) => c.name !== choice.name) : [...current, choice] };
      }
      return { ...prev, [groupName]: [choice] };
    });
  };

  const selectedFlat = useMemo(() => {
    const flat = [];
    Object.entries(selections).forEach(([groupName, choices]) => {
      choices.forEach((c) => flat.push({ group_name: groupName, choice_name: c.name, price_delta: c.price_delta || 0 }));
    });
    return flat;
  }, [selections]);

  const optionsTotal = selectedFlat.reduce((s, o) => s + (o.price_delta || 0), 0);
  const total = ((item?.price || 0) + optionsTotal) * quantity;

  const requiredOk = groups.every((g) => !g.required || (selections[g.group_name] || []).length > 0);

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">{item.name}</DialogTitle>
        {item.image_url && (
          <div className="aspect-[16/10] bg-secondary">
            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <h3 className="font-display text-2xl font-semibold mb-1">{item.name}</h3>
          {item.description && <p className="text-muted-foreground mb-4">{item.description}</p>}

          {groups.map((g) => (
            <div key={g.group_name} className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">{g.group_name}</h4>
                {g.required && <span className="text-xs text-primary font-medium">Required</span>}
              </div>
              <div className="space-y-2">
                {(g.choices || []).map((c) => {
                  const checked = (selections[g.group_name] || []).some((s) => s.name === c.name);
                  return (
                    <button
                      key={c.name}
                      onClick={() => toggleChoice(g.group_name, c, g.multi_select)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition ${
                        checked ? 'border-foreground bg-secondary' : 'border-border hover:border-foreground/30'
                      }`}
                    >
                      <span className="text-sm">{c.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {c.price_delta > 0 ? `+${formatETB(c.price_delta)}` : c.price_delta < 0 ? formatETB(c.price_delta) : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="mb-2">
            <h4 className="font-medium mb-2">Special instructions</h4>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any allergies or preferences?"
              className="resize-none"
              rows={2}
            />
          </div>
        </div>

        <div className="border-t border-border p-4 flex items-center justify-between gap-3 bg-card">
          <div className="flex items-center gap-3 border border-border rounded-full px-2 py-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setQuantity(Math.max(1, quantity - 1))}>
              <Minus className="w-4 h-4" />
            </Button>
            <span className="font-medium w-6 text-center">{quantity}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setQuantity(quantity + 1)}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <Button
            disabled={!requiredOk}
            onClick={() => onAdd({ quantity, notes, selected_options: selectedFlat })}
            className="flex-1 h-11 rounded-full"
          >
            Add to cart  |  {formatETB(total)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}