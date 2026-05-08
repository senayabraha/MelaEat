# ADR 0001: Order State Ownership

Date: 2026-05-08

## Status

Accepted

## Context

Order creation and fulfillment touch customer checkout, restaurant prep, driver assignment, delivery completion, payment settlement, promo accounting, and audit history. Some rules are workflow decisions that need request context and user identity. Other rules are data invariants that must hold even if two actors act at nearly the same time.

## Decision

The API owns order workflow orchestration:

- Authenticated actor validation and role checks.
- Request shape validation before any database writes.
- Pricing, promo lookup, and delivery fee calculation.
- Explicit status transition intent, such as `preparing`, `ready_for_pickup`, `driver_accept`, and `delivered`.
- Audit event creation in `order_status_events`.
- Stable API error responses for clients.

The database owns durable invariants:

- Order status, payment status, profile role, and driver status check constraints.
- RLS policies for table-level access.
- Insert/update triggers for automatic acceptance and cash settlement on delivery.
- Compare-and-update protection for races by matching the previous `status` and `driver_email`.
- Foreign keys and indexes for order, restaurant, profile, promotion, and event relationships.

## Consequences

The API can evolve client-facing behavior without requiring every workflow rule to be represented as a trigger. The database remains the final safety net for impossible states, stale writes, and concurrent assignment races.

Tests should cover both layers. Unit tests should validate API request contracts and transition inputs. Integration tests should exercise Supabase-backed writes, especially driver assignment and delivery completion races.

