import { z } from 'zod';

const optionalTrimmedString = (maxLength) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (value == null ? '' : value.trim()))
    .pipe(z.string().max(maxLength));

const optionalReason = optionalTrimmedString(500).optional();

const promoCodeSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed.toUpperCase() : undefined;
  })
  .pipe(
    z
      .string()
      .min(3)
      .max(32)
      .regex(/^[A-Z0-9_-]+$/, 'Promo code can only contain letters, numbers, underscores, or dashes.')
      .optional()
  );

const isoDateTimeSchema = z
  .union([z.string().datetime({ offset: true }), z.null(), z.undefined()])
  .transform((value) => value || undefined);

const coordinateSchema = (min, max, label) =>
  z
    .number({ invalid_type_error: `${label} must be a number.` })
    .finite(`${label} must be finite.`)
    .min(min, `${label} is outside the supported range.`)
    .max(max, `${label} is outside the supported range.`);

const selectedOptionSchema = z
  .object({
    group_name: z.string().trim().min(1).max(80),
    choice_name: z.string().trim().min(1).max(80),
  })
  .strict();

const orderItemSchema = z
  .object({
    menu_item_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(99),
    selected_options: z.array(selectedOptionSchema).max(20).optional().default([]),
    notes: optionalTrimmedString(500).optional().default(''),
  })
  .strict();

export const createOrderRequestSchema = z
  .object({
    restaurant_id: z.string().uuid(),
    customer_phone: z.string().trim().min(5).max(32),
    items: z.array(orderItemSchema).min(1).max(100),
    promo_code: promoCodeSchema,
    payment_method: z.enum(['cash', 'telebirr', 'card']).default('cash'),
    delivery_lat: coordinateSchema(-90, 90, 'delivery_lat'),
    delivery_lng: coordinateSchema(-180, 180, 'delivery_lng'),
    delivery_address_text: optionalTrimmedString(240).optional().default(''),
    delivery_notes: optionalTrimmedString(500).optional().default(''),
    is_scheduled: z.boolean().optional().default(false),
    scheduled_for: isoDateTimeSchema,
    idempotency_key: z.string().uuid().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.is_scheduled && !data.scheduled_for) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scheduled_for'],
        message: 'scheduled_for is required when is_scheduled is true.',
      });
    }
  });

const noExtraActionFields = (action) => z.object({ action: z.literal(action) }).strict();

export const orderActionRequestSchema = z.discriminatedUnion('action', [
  noExtraActionFields('accept'),
  z
    .object({
      action: z.literal('reject'),
      reason: optionalReason,
    })
    .strict(),
  z
    .object({
      action: z.literal('preparing'),
      estimated_ready_minutes: z.number().int().min(5).max(120).optional(),
    })
    .strict(),
  noExtraActionFields('ready_for_pickup'),
  z
    .object({
      action: z.literal('assign_driver'),
      driver_email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    })
    .strict(),
  z
    .object({
      action: z.literal('customer_cancel'),
      reason: optionalReason,
    })
    .strict(),
  noExtraActionFields('driver_accept'),
  noExtraActionFields('picked_up'),
  noExtraActionFields('on_the_way'),
  noExtraActionFields('delivered'),
]);

export const orderIdParamSchema = z.string().uuid();
