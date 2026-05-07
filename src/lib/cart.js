import { useEffect, useState, useCallback } from 'react';

const KEY = 'melaeat_cart_v1';

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { restaurant_id: null, restaurant_name: null, items: [] };
  } catch {
    return { restaurant_id: null, restaurant_name: null, items: [] };
  }
}

function write(cart) {
  localStorage.setItem(KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event('melaeat-cart-update'));
}

export function useCart() {
  const [cart, setCart] = useState(read());

  useEffect(() => {
    const handler = () => setCart(read());
    window.addEventListener('melaeat-cart-update', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('melaeat-cart-update', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const addItem = useCallback((restaurant, item, quantity = 1, selected_options = [], notes = '') => {
    const current = read();
    let next = current;
    if (current.restaurant_id && current.restaurant_id !== restaurant.id) {
      if (!confirm(`Your cart has items from ${current.restaurant_name}. Clear it to order from ${restaurant.name}?`)) {
        return false;
      }
      next = { restaurant_id: restaurant.id, restaurant_name: restaurant.name, items: [] };
    } else if (!current.restaurant_id) {
      next = { restaurant_id: restaurant.id, restaurant_name: restaurant.name, items: [] };
    }
    const optionsTotal = (selected_options || []).reduce((s, o) => s + (o.price_delta || 0), 0);
    const unit = item.price + optionsTotal;
    next = {
      ...next,
      items: [
        ...next.items,
        {
          line_id: `${item.id}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
          menu_item_id: item.id,
          name: item.name,
          image_url: item.image_url,
          quantity,
          unit_price: unit,
          base_price: item.price,
          selected_options,
          line_total: unit * quantity,
          notes,
        },
      ],
    };
    write(next);
    return true;
  }, []);

  const updateQuantity = useCallback((line_id, quantity) => {
    const current = read();
    const items = current.items
      .map((it) => (it.line_id === line_id ? { ...it, quantity, line_total: it.unit_price * quantity } : it))
      .filter((it) => it.quantity > 0);
    write({ ...current, items, restaurant_id: items.length ? current.restaurant_id : null, restaurant_name: items.length ? current.restaurant_name : null });
  }, []);

  const removeItem = useCallback((line_id) => {
    const current = read();
    const items = current.items.filter((it) => it.line_id !== line_id);
    write({ ...current, items, restaurant_id: items.length ? current.restaurant_id : null, restaurant_name: items.length ? current.restaurant_name : null });
  }, []);

  const clear = useCallback(() => {
    write({ restaurant_id: null, restaurant_name: null, items: [] });
  }, []);

  const subtotal = cart.items.reduce((s, it) => s + (it.line_total || 0), 0);
  const itemCount = cart.items.reduce((s, it) => s + it.quantity, 0);

  return { cart, addItem, updateQuantity, removeItem, clear, subtotal, itemCount };
}