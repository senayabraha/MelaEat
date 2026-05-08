import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const getBearerToken = (request) => {
  const authHeader = request.headers.get('authorization') || '';
  const [, token] = authHeader.split(' ');
  return token || null;
};

export async function POST(request) {
  try {
    const admin = getSupabaseAdmin();
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { name } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Restaurant name is required' }, { status: 400 });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('restaurant_id, full_name, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (profile?.role && !['user', 'restaurant'].includes(profile.role)) {
      return NextResponse.json({ error: 'Only restaurant accounts can set up a restaurant profile' }, { status: 403 });
    }

    let restaurant = null;

    if (profile?.restaurant_id) {
      const { data } = await admin
        .from('restaurants')
        .select('*')
        .eq('id', profile.restaurant_id)
        .maybeSingle();
      restaurant = data;
    }

    if (!restaurant) {
      const { data } = await admin
        .from('restaurants')
        .select('*')
        .eq('owner_email', user.email)
        .maybeSingle();
      restaurant = data;
    }

    if (!restaurant) {
      const { data, error: createError } = await admin
        .from('restaurants')
        .insert({
          name: name.trim(),
          owner_email: user.email,
          city: 'Addis Ababa',
          description: `Managed by ${profile?.full_name || user.email}`,
          status: 'pending',
          is_open_manual: false,
        })
        .select()
        .single();

      if (createError) throw createError;
      restaurant = data;
    }

    const { error: updateProfileError } = await admin
      .from('profiles')
      .update({
        role: 'restaurant',
        restaurant_id: restaurant.id,
        updated_date: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateProfileError) throw updateProfileError;

    return NextResponse.json({ restaurant });
  } catch (error) {
    console.error('Restaurant setup failed:', error);
    return NextResponse.json({ error: error.message || 'Failed to set up restaurant' }, { status: 500 });
  }
}
