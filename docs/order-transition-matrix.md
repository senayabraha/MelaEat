# Order Transition Matrix

The source of truth is `public.order_transition_rules`, enforced by `public.apply_order_action(...)`.

| Action | From | To | Actor | Extra guard |
| --- | --- | --- | --- | --- |
| `accept` | `pending` | `accepted` | Restaurant, admin | Actor must manage the restaurant |
| `reject` | `pending` | `rejected` | Restaurant, admin | Actor must manage the restaurant |
| `preparing` | `accepted` | `preparing` | Restaurant, admin | Actor must manage the restaurant |
| `ready_for_pickup` | `preparing` | `ready_for_pickup` | Restaurant, admin | Actor must manage the restaurant |
| `assign_driver` | `ready_for_pickup` | `ready_for_pickup` | Restaurant, admin | Order unassigned; target driver approved and online |
| `customer_cancel` | `pending` | `cancelled` | Customer, admin | Actor must be order customer or admin |
| `customer_cancel` | `accepted` | `cancelled` | Customer, admin | Actor must be order customer or admin |
| `driver_accept` | `ready_for_pickup` | `ready_for_pickup` | Driver | Order unassigned; actor approved and online |
| `picked_up` | `ready_for_pickup` | `picked_up` | Driver, admin | Assigned driver or admin |
| `on_the_way` | `picked_up` | `on_the_way` | Driver, admin | Assigned driver or admin |
| `delivered` | `on_the_way` | `delivered` | Driver, admin | Assigned driver or admin |

Compatibility action names stay unchanged for clients. The API still accepts the same `POST /api/orders/[id]/action` payloads, but the route delegates enforcement to the RPC.

The RPC writes `order_status_events` in the same transaction as the order update and uses `status` plus `driver_email` guards in the `UPDATE` predicate to detect stale assignment/status races.

