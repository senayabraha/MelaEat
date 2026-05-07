import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const storageBucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'restaurant-assets';
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Supabase calls will fail until .env.local is configured.');
}

export const supabase = createClient(supabaseUrl || 'https://example.supabase.co', supabaseAnonKey || 'missing-key');

const tables = {
  User: 'profiles',
  Restaurant: 'restaurants',
  MenuCategory: 'menu_categories',
  MenuItem: 'menu_items',
  Order: 'orders',
  Promotion: 'promotions',
  ChatMessage: 'chat_messages',
  IssueReport: 'issue_reports',
};

const mapAuthUser = (authUser, profile = {}) => ({
  id: authUser.id,
  email: authUser.email,
  full_name: profile.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
  role: profile.role || authUser.user_metadata?.role || 'user',
  ...profile,
});

const ensureProfile = async (authUser) => {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (error) throw error;
  if (profile) return mapAuthUser(authUser, profile);

  const payload = {
    id: authUser.id,
    email: authUser.email,
    full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
    role: authUser.user_metadata?.role || 'user',
  };
  const { data, error: insertError } = await supabase
    .from('profiles')
    .insert(payload)
    .select()
    .single();

  if (insertError) throw insertError;
  return mapAuthUser(authUser, data);
};

const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Authentication required');
  return ensureProfile(data.user);
};

const getSessionAccessToken = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Authentication required');
  }

  return session.access_token;
};

const applySort = (query, sort) => {
  if (!sort) return query;
  const descending = sort.startsWith('-');
  const column = descending ? sort.slice(1) : sort;
  return query.order(column, { ascending: !descending });
};

const applyFilters = (query, filters = {}) =>
  Object.entries(filters).reduce((q, [key, value]) => q.eq(key, value), query);

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
      const { data } = await supabase.auth.getSession();
      return !!data.session;
    },

    me: getCurrentUser,

    async updateMe(patch) {
      const user = await getCurrentUser();
      const { data, error } = await supabase
        .from('profiles')
        .update({ ...patch, updated_date: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single();
      if (error) throw error;
      return { ...user, ...data };
    },

    redirectToLogin(returnTo = window.location.href) {
      const redirect = encodeURIComponent(returnTo);
      window.location.href = `/login?redirect=${redirect}`;
    },

    async logout() {
      await supabase.auth.signOut();
      window.location.href = '/';
    },
  },

  users: {
    async setupRestaurant({ name }) {
      const accessToken = await getSessionAccessToken();
      const response = await fetch('/api/restaurant/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Failed to set up restaurant' }));
        throw new Error(payload.error || 'Failed to set up restaurant');
      }

      return response.json();
    },
  },

  orders: {
    async submitRating(orderId, payload) {
      const accessToken = await getSessionAccessToken();
      const response = await fetch(`/api/orders/${orderId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: 'Failed to save rating' }));
        throw new Error(result.error || 'Failed to save rating');
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
