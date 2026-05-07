export function formatETB(amount) {
  const n = Number(amount || 0);
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ETB`;
}

export function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function generateOrderNumber() {
  const t = Date.now().toString().slice(-6);
  const r = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `ME-${t}${r}`;
}

export function isOpenNow(restaurant) {
  if (!restaurant) return false;
  if (restaurant.is_open_manual === false) return false;
  return true;
}

export function statusLabel(status) {
  const map = {
    pending: 'Pending',
    accepted: 'Accepted',
    rejected: 'Rejected',
    preparing: 'Preparing',
    ready_for_pickup: 'Ready for pickup',
    picked_up: 'Picked up',
    on_the_way: 'On the way',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  };
  return map[status] || status;
}

export function statusColor(status) {
  const map = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    accepted: 'bg-blue-100 text-blue-800 border-blue-200',
    preparing: 'bg-blue-100 text-blue-800 border-blue-200',
    ready_for_pickup: 'bg-purple-100 text-purple-800 border-purple-200',
    picked_up: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    on_the_way: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    rejected: 'bg-red-100 text-red-800 border-red-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
  };
  return map[status] || 'bg-muted text-muted-foreground border-border';
}