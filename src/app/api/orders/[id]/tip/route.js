import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { apiError, readJsonBody, validationError } from '@/lib/api/responses';
import { tipUpdateRequestSchema, orderIdParamSchema } from '@/lib/orders/validation';

const getBearerToken = (request) => {
  const authHeader = request.headers.get('authorization') || '';
  const [, token] = authHeader.split(' ');
  return token || null;
};

// Lets a customer add (or change) a tip post-delivery. Only valid for the
// customer's own delivered orders. Adjusts orders.total to keep the column
// consistent with subtotal + delivery - discount + tip.
export async function POST(request, { params }) {
  try {
    const admin = getSupabaseAdmin();
    const token = getBearerToken(request);
    if (!token) {
      return apiError('AUTH_REQUIRED', 'Authentication required', { status: 401 });
    }

    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(token);

    if (userError || !user) {
      return apiError('INVALID_SESSION', 'Invalid session', { status: 401 });
    }

    const parsedId = orderIdParamSchema.safeParse(params.id);
    if (!parsedId.success) {
      return apiError('VALIDATION_ERROR', 'Invalid order id.', { status: 400 });
    }

    const json = await readJsonBody(request);
    if (!json.ok) return json.response;

    const parsedBody = tipUpdateRequestSchema.safeParse(json.data);
    if (!parsedBody.success) return validationError(parsedBody.error);

    const tipAmount = Number(parsedBody.data.tip_amount);

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, customer_email, status, subtotal, delivery_fee, discount, tip_amount, total')
      .eq('id', params.id)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return apiError('ORDER_NOT_FOUND', 'Order not found', { status: 404 });

    if (order.customer_email !== user.email) {
      return apiError('TIP_FORBIDDEN', 'You can only tip on your own orders.', { status: 403 });
    }

    if (order.status !== 'delivered') {
      return apiError('TIP_NOT_ALLOWED', 'Tips can only be added to delivered orders.', { status: 400 });
    }

    const newTotal = Math.max(
      0,
      Number(order.subtotal || 0)
        + Number(order.delivery_fee || 0)
        - Number(order.discount || 0)
        + tipAmount,
    );

    const { data: updated, error: updateError } = await admin
      .from('orders')
      .update({
        tip_amount: tipAmount,
        tip_added_at: tipAmount > 0 ? new Date().toISOString() : null,
        total: newTotal,
        updated_date: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ order: updated });
  } catch (error) {
    console.error('Tip update failed:', error);
    return apiError('TIP_UPDATE_FAILED', 'Failed to update tip', { status: 500 });
  }
}
