import { NextResponse } from 'next/server';
import { apiError, readJsonBody, validationError } from '@/lib/api/responses';
import { orderActionRequestSchema, orderIdParamSchema } from '@/lib/orders/validation';
import { getSupabaseUserClient } from '@/lib/supabase/user';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const getBearerToken = (request) => {
  const authHeader = request.headers.get('authorization') || '';
  const [, token] = authHeader.split(' ');
  return token || null;
};

const rpcErrors = {
  AUTH_REQUIRED: { status: 401, message: 'Authentication required' },
  PROFILE_NOT_FOUND: { status: 404, message: 'Profile not found' },
  ORDER_NOT_FOUND: { status: 404, message: 'Order not found' },
  ORDER_FORBIDDEN: { status: 403, message: 'You cannot update this order.' },
  UNSUPPORTED_ORDER_ACTION: { status: 400, message: 'Unsupported order action.' },
  INVALID_STATUS_TRANSITION: { status: 400, message: 'This order cannot move to that status right now.' },
  ORDER_UPDATE_CONFLICT: { status: 409, message: 'This order changed before your update. Please refresh and try again.' },
  DELIVERY_UNAVAILABLE: { status: 400, message: 'This delivery is no longer available.' },
  DRIVER_NOT_FOUND: { status: 404, message: 'Driver not found.' },
  DRIVER_NOT_APPROVED: { status: 400, message: 'Driver is not approved yet.' },
  DRIVER_NOT_ONLINE: { status: 400, message: 'Driver must be online before assignment.' },
  PIN_REQUIRED: { status: 400, message: 'Enter the 4-digit code shown to the customer.' },
  PIN_MISMATCH: { status: 400, message: 'That code does not match. Ask the customer to read it again.' },
  PIN_LOCKED: { status: 423, message: 'Too many failed attempts. Ask support or the restaurant for an override.' },
  PIN_OVERRIDE_FORBIDDEN: { status: 403, message: 'Only the restaurant or admin can override the delivery PIN.' },
  PIN_OVERRIDE_REASON_REQUIRED: { status: 400, message: 'Please give a reason (5+ chars) for overriding the PIN.' },
};

const mapRpcError = (error) => {
  const raw = `${error?.message || ''} ${error?.details || ''}`;
  const code = Object.keys(rpcErrors).find((candidate) => raw.includes(candidate));

  if (!code) return null;

  const mapped = rpcErrors[code];
  return apiError(code, mapped.message, { status: mapped.status });
};

export async function POST(request, { params }) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return apiError('AUTH_REQUIRED', 'Authentication required', { status: 401 });
    }

    const { id } = params;
    const parsedId = orderIdParamSchema.safeParse(id);
    if (!parsedId.success) {
      return apiError('VALIDATION_ERROR', 'Invalid order id.', {
        status: 400,
        details: [{ path: 'id', code: 'invalid_string', message: 'Order id must be a UUID.' }],
      });
    }

    const json = await readJsonBody(request);
    if (!json.ok) return json.response;

    const parsedBody = orderActionRequestSchema.safeParse(json.data);
    if (!parsedBody.success) return validationError(parsedBody.error);

    const body = parsedBody.data;
    const userClient = getSupabaseUserClient(token);

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return apiError('INVALID_SESSION', 'Invalid session', { status: 401 });
    }

    const { data: order, error: actionError } = await userClient.rpc('apply_order_action', {
      p_order_id: id,
      p_action: body.action,
      p_payload: body,
    });

    if (actionError) {
      // PIN mismatch must increment the attempt counter even though the RPC
      // raised — the bump can't live inside the rolled-back transaction.
      if (`${actionError.message || ''} ${actionError.details || ''}`.includes('PIN_MISMATCH')) {
        try {
          const admin = getSupabaseAdmin();
          await admin.rpc('increment_delivery_code_attempts', { p_order_id: id });
        } catch {
          // Swallow — the surfaced PIN error is what the driver needs to see.
        }
      }
      const mappedResponse = mapRpcError(actionError);
      if (mappedResponse) return mappedResponse;
      throw actionError;
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Order action failed:', error);
    return apiError('ORDER_ACTION_FAILED', 'Failed to update order', { status: 500 });
  }
}
