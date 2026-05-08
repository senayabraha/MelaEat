# RLS Policy Matrix

## Orders

Read:

- Customer can read their own orders.
- Restaurant owner or linked restaurant profile can read orders for that restaurant.
- Assigned driver can read their assigned orders.
- Approved online drivers can read unassigned `ready_for_pickup` orders.
- Admin can read all orders.

Write:

- Direct authenticated `insert` and `update` policies are intentionally absent.
- Order creation goes through `create_order_atomic(...)`.
- Order status changes go through `apply_order_action(...)`.
- Admin delete remains available for emergency cleanup.

## Order Status Events

Read follows order participant access via `can_access_order(order_id)`.

Direct authenticated inserts are intentionally blocked. Audit events are written by `create_order_atomic(...)` and `apply_order_action(...)` in the same transaction as the order mutation.

## Promotions

Read:

- Active promotions are readable for customer promo lookup.
- Restaurant managers can read their restaurant promotions, including inactive ones.
- Admin can read all promotions.

Write:

- Admins can manage all promotions.
- Restaurant managers can manage promotions scoped to their restaurant.

## Profiles

Read:

- A user can read their own profile.
- Admin can read all profiles.
- Authenticated users can read driver profiles so restaurants can assign online drivers.

Sensitive profile fields (`role`, `restaurant_id`, `driver_approval_status`) are protected by `prevent_profile_sensitive_self_update`.

## Chat And Issues

Chat rows are readable/writable only by order participants, with inserts requiring `sender_email = current_user_email()`.

Issue reports are readable by the reporter, admin, or order participants. Inserts require the reporter email to match the current user.

## Backend Scope

The order action route uses a user-scoped Supabase client and calls only `apply_order_action(...)`. The order creation route still uses the service-role client for pricing orchestration and calls the narrow `create_order_atomic(...)` RPC for writes.

