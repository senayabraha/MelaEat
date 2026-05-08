# Order API Contract

## Error Format

Order APIs return errors as:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid request payload.",
  "details": [
    { "path": "items.0.quantity", "code": "too_small", "message": "Number must be greater than or equal to 1" }
  ]
}
```

`details` is optional and is intended for validation diagnostics. Clients should display `message` and may use `code` for specialized handling.

## `POST /api/orders`

Required fields:

- `restaurant_id`: UUID.
- `customer_phone`: 5 to 32 characters.
- `items`: 1 to 100 items. Each item needs `menu_item_id` UUID and integer `quantity` from 1 to 99.
- `payment_method`: `cash`, `telebirr`, or `card`.
- `delivery_lat`: number from -90 to 90.
- `delivery_lng`: number from -180 to 180.

Optional fields:

- `promo_code`: 3 to 32 characters, letters, numbers, `_`, or `-`.
- `selected_options`: option objects with `group_name` and `choice_name`.
- `delivery_address_text`: up to 240 characters.
- `delivery_notes`: up to 500 characters.
- `is_scheduled`: boolean.
- `scheduled_for`: ISO datetime with timezone, required when `is_scheduled` is true.
- `idempotency_key`: UUID. Reusing the same key for the same authenticated customer returns the original created order instead of creating a duplicate.

Promo codes are checked and redeemed inside the database transaction. Possible promo-specific error codes are `INVALID_PROMO_CODE`, `PROMO_NOT_APPLICABLE`, `PROMO_NOT_STARTED`, `PROMO_EXPIRED`, `PROMO_USAGE_LIMIT_REACHED`, and `PROMO_MIN_ORDER_NOT_MET`.

## `POST /api/orders/[id]/action`

`id` must be a UUID. Supported action payloads:

- `{ "action": "accept" }`
- `{ "action": "reject", "reason": "..." }`
- `{ "action": "preparing", "estimated_ready_minutes": 20 }`
- `{ "action": "ready_for_pickup" }`
- `{ "action": "assign_driver", "driver_email": "driver@example.com" }`
- `{ "action": "customer_cancel", "reason": "..." }`
- `{ "action": "driver_accept" }`
- `{ "action": "picked_up" }`
- `{ "action": "on_the_way" }`
- `{ "action": "delivered" }`
