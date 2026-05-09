import { createClient } from '@supabase/supabase-js';
import { normalizeSupabaseUrl } from '@/lib/supabase/url';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const storageBucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'restaurant-assets';

const normalizedSupabaseUrl = normalizeSupabaseUrl(supabaseUrl);
export const isSupabaseConfigured = Boolean(normalizedSupabaseUrl && supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Supabase calls will fail until .env.local is configured.');
}

if (supabaseUrl && normalizedSupabaseUrl && supabaseUrl !== normalizedSupabaseUrl) {
  console.warn('NEXT_PUBLIC_SUPABASE_URL should be only the project origin. Using normalized Supabase URL:', normalizedSupabaseUrl);
}

export const supabase = createClient(normalizedSupabaseUrl || 'https://example.supabase.co', supabaseAnonKey || 'missing-key');

export const authNetworkMetrics = {
  sessionReads: 0,
  userReads: 0,
  profileReads: 0,
  refreshes: 0,
  coalescedUserReads: 0,
  coalescedTokenReads: 0,
};

let currentUserCache = null;
let currentUserPromise = null;
let currentUserPromiseId = null;
let accessTokenPromise = null;

const tables = {
  User: 'profiles',
  Restaurant: 'restaurants',
  MenuCategory: 'menu_categories',
  MenuItem: 'menu_items',
  Order: 'orders',
  Promotion: 'promotions',
  ChatMessage: 'chat_messages',
  IssueReport: 'issue_reports',
  OrderStatusEvent: 'order_status_events',
};

const mapAuthUser = (authUser, profile = {}) => ({
  id: authUser.id,
  email: authUser.email,
  full_name: profile.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
  role: profile.role || authUser.user_metadata?.role || 'customer',
  ...profile,
});

const clearAuthCache = () => {
  currentUserCache = null;
  currentUserPromise = null;
  currentUserPromiseId = null;
  accessTokenPromise = null;
};

const ensureProfile = async (authUser) => {
  authNetworkMetrics.profileReads += 1;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (error) throw error;
  if (profile) return mapAuthUser(authUser, profile);

  // Always insert with role='user'. The role is finalised by the server-side
  // /api/profile/complete-role endpoint (admin-only validation, no client trust).
  // This blocks privilege escalation via crafted user_metadata.role values.
  const payload = {
    id: authUser.id,
    email: authUser.email,
    full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
    role: 'user',
  };
  const { data, error: insertError } = await supabase
    .from('profiles')
    .insert(payload)
    .select()
    .single();

  if (insertError) throw insertError;
  return mapAuthUser(authUser, data);
};

const getMappedUser = async (authUser) => {
  if (!authUser) throw new Error('Authentication required');
  if (currentUserCache?.id === authUser.id) return currentUserCache;

  if (currentUserPromise && currentUserPromiseId === authUser.id) {
    authNetworkMetrics.coalescedUserReads += 1;
    return currentUserPromise;
  }

  currentUserPromiseId = authUser.id;
  currentUserPromise = ensureProfile(authUser)
    .then((mappedUser) => {
      currentUserCache = mappedUser;
      try {
        if (typeof window !== 'undefined' && mappedUser?.role && mappedUser.role !== 'user') {
          window.localStorage?.setItem('melaeat:lastRole', mappedUser.role);
        }
      } catch {}
      return mappedUser;
    })
    .finally(() => {
      currentUserPromise = null;
      currentUserPromiseId = null;
    });

  return currentUserPromise;
};

const getCurrentUser = async (authUser) => {
  if (authUser) return getMappedUser(authUser);

  authNetworkMetrics.userReads += 1;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return getMappedUser(data.user);
};

const loadSessionAccessToken = async () => {
  authNetworkMetrics.sessionReads += 1;

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;

  if (session?.access_token) {
    return session.access_token;
  }

  const {
    data: { session: refreshedSession },
    error: refreshError,
  } = await supabase.auth.refreshSession();
  authNetworkMetrics.refreshes += 1;

  if (refreshError) throw refreshError;

  if (!refreshedSession?.access_token) {
    throw new Error('Authentication required');
  }

  return refreshedSession.access_token;
};

const getSessionAccessToken = async () => {
  if (accessTokenPromise) {
    authNetworkMetrics.coalescedTokenReads += 1;
    return accessTokenPromise;
  }

  accessTokenPromise = loadSessionAccessToken()
    .finally(() => {
      accessTokenPromise = null;
    });

  return accessTokenPromise;
};

const getApiErrorMessage = (payload, fallback) => {
  if (typeof payload?.message === 'string') return payload.message;
  if (typeof payload?.error === 'string') return payload.error;
  if (typeof payload?.error?.message === 'string') return payload.error.message;
  return fallback;
};

const authFetch = async (url, options = {}) => {
  const requestWithToken = async (accessToken) =>
    fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });

  const firstToken = await getSessionAccessToken();
  let response = await requestWithToken(firstToken);

  if (response.status !== 401) {
    return response;
  }

  const {
    data: { session: refreshedSession },
    error: refreshError,
  } = await supabase.auth.refreshSession();
  authNetworkMetrics.refreshes += 1;

  if (refreshError || !refreshedSession?.access_token) {
    return response;
  }

  response = await requestWithToken(refreshedSession.access_token);
  return response;
};

const applySort = (query, sort) => {
  if (!sort) return query;
  const descending = sort.startsWith('-');
  const column = descending ? sort.slice(1) : sort;
  return query.order(column, { ascending: !descending });
};

const applyFilters = (query, filters = {}) =>
  Object.entries(filters).reduce((q, [key, value]) => {
    if (Array.isArray(value)) return q.in(key, value);
    if (value === null) return q.is(key, null);
    return q.eq(key, value);
  }, query);

const entity = (name) => {
  const table = tables[name];

  return {
    async list(sort = '-created_date', limit = 100) {
      let query = supabase.from(table).select('*');
      query = applySort(query, sort);
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async filter(filters = {}, sort = '-created_date', limit = 100) {
      let query = applyFilters(supabase.from(table).select('*'), filters);
      query = applySort(query, sort);
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async create(payload) {
      const { data, error } = await supabase.from(table).insert(payload).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, payload) {
      const { data, error } = await supabase
        .from(table)
        .update({ ...payload, updated_date: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    subscribe(callback) {
      const channel = supabase
        .channel(`${table}-changes`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
          callback({
            event: payload.eventType,
            id: payload.new?.id || payload.old?.id,
            data: payload.new,
            oldData: payload.old,
          });
        })
        .subscribe();

      return () => supabase.removeChannel(channel);
    },
  };
};

export const base44 = {
  auth: {
    async isAuthenticated() {
      authNetworkMetrics.sessionReads += 1;
      const { data } = await supabase.auth.getSession();
      return !!data.session;
    },

    me: getCurrentUser,

    fromSession(session) {
      return getCurrentUser(session?.user);
    },

    clearCache: clearAuthCache,

    getNetworkMetrics() {
      return { ...authNetworkMetrics };
    },

    async updateMe(patch) {
      const user = await getCurrentUser();
      const { data, error } = await supabase
        .from('profiles')
        .update({ ...patch, updated_date: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single();
      if (error) throw error;
      currentUserCache = { ...user, ...data };
      return currentUserCache;
    },

    redirectToLogin(returnTo = window.location.href, role) {
      const stored = typeof window !== 'undefined' ? window.localStorage?.getItem('melaeat:lastRole') : null;
      const cachedRole = currentUserCache?.role;
      const candidate = role || cachedRole || stored || 'customer';
      const loginRole = ['customer', 'restaurant', 'driver', 'admin'].includes(candidate) ? candidate : 'customer';
      const redirect = encodeURIComponent(returnTo);
      window.location.href = `/login/${loginRole}?redirect=${redirect}`;
    },

    async logout(role) {
      const stored = typeof window !== 'undefined' ? window.localStorage?.getItem('melaeat:lastRole') : null;
      const cachedRole = currentUserCache?.role;
      const candidate = role || cachedRole || stored || 'customer';
      const loginRole = ['customer', 'restaurant', 'driver', 'admin'].includes(candidate) ? candidate : 'customer';
      await supabase.auth.signOut();
      clearAuthCache();
      try { window.localStorage?.removeItem('melaeat:lastRole'); } catch {}
      window.location.href = `/login/${loginRole}`;
    },
  },

  users: {
    async completeRole(role) {
      const response = await authFetch('/api/profile/complete-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Failed to complete role' }));
        throw new Error(getApiErrorMessage(payload, 'Failed to complete role'));
      }

      const { profile } = await response.json();
      return profile;
    },

    async setupRestaurant({ name }) {
      const response = await authFetch('/api/restaurant/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Failed to set up restaurant' }));
        throw new Error(getApiErrorMessage(payload, 'Failed to set up restaurant'));
      }

      return response.json();
    },
  },

  orders: {
    async create(payload) {
      const response = await authFetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: 'Failed to place order' }));
        throw new Error(getApiErrorMessage(result, 'Failed to place order'));
      }

      return response.json();
    },

    async action(orderId, payload) {
      const response = await authFetch(`/api/orders/${orderId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: 'Failed to update order' }));
        throw new Error(getApiErrorMessage(result, 'Failed to update order'));
      }

      return response.json();
    },

    async submitRating(orderId, payload) {
      const response = await authFetch(`/api/orders/${orderId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: 'Failed to save rating' }));
        throw new Error(getApiErrorMessage(result, 'Failed to save rating'));
      }

      return response.json();
    },
  },

  integrations: {
    Core: {
      async UploadFile({ file }) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
        const path = `${crypto.randomUUID()}-${safeName}`;
        const { error } = await supabase.storage.from(storageBucket).upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        });
        if (error) throw error;
        const { data } = supabase.storage.from(storageBucket).getPublicUrl(path);
        return { file_url: data.publicUrl };
      },
    },
  },

  entities: Object.fromEntries(Object.keys(tables).map((name) => [name, entity(name)])),
};
