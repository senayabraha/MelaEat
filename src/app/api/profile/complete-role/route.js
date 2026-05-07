import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const allowedRoles = new Set(['customer', 'restaurant', 'driver']);

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

    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { role } = await request.json();
    const selectedRole = String(role || '').trim();
    if (!allowedRoles.has(selectedRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    if (profile.role !== 'user') {
      return NextResponse.json({ error: 'Role has already been assigned' }, { status: 400 });
    }

    const { data: updatedProfile, error: updateError } = await admin
      .from('profiles')
      .update({
        role: selectedRole,
        driver_approval_status: selectedRole === 'driver' ? 'pending' : 'approved',
        updated_date: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ profile: updatedProfile });
  } catch (error) {
    console.error('Profile role completion failed:', error);
    return NextResponse.json({ error: error.message || 'Failed to complete profile role' }, { status: 500 });
  }
}
