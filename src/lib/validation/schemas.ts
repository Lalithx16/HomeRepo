import { z } from "zod";
import { isIsoDate, isValidTimeZone } from "@/lib/domain/expiry";
import { UNIT_CODES } from "@/lib/domain/units";

/** Empty strings from forms become null. */
const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const trimmed = (max: number, label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

const optionalText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max, `Must be ${max} characters or fewer`).nullable().optional());

export const uuid = z.string().uuid("Invalid selection");
const optionalUuid = z.preprocess(emptyToNull, uuid.nullable().optional());

const optionalDate = z.preprocess(
  emptyToNull,
  z
    .string()
    .refine(isIsoDate, "Enter a valid date")
    .nullable()
    .optional(),
);

const number = (label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : Number(v.replace(",", "."))) : v),
    z
      .number({ required_error: `${label} is required`, invalid_type_error: `${label} must be a number` })
      .finite(`${label} must be a number`),
  );

const optionalNumber = (label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? null : Number(v.replace(",", "."))) : v),
    z.number({ invalid_type_error: `${label} must be a number` }).finite(`${label} must be a number`).nullable().optional(),
  );

const MAX_QTY = 1_000_000;

export const unitSchema = z.enum(UNIT_CODES, { errorMap: () => ({ message: "Choose a unit" }) });

export const ingredientKeySchema = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim().toLowerCase()) : v),
  z
    .string()
    .regex(/^[a-z0-9 ]{1,40}$/, "Use letters, numbers and spaces only")
    .nullable()
    .optional(),
);

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------
const itemBase = z.object({
  name: trimmed(120, "Name"),
  brand: optionalText(80),
  categoryId: optionalUuid,
  unit: unitSchema,
  minQuantity: optionalNumber("Minimum stock").pipe(
    z.number().min(0, "Minimum stock can't be negative").max(MAX_QTY).nullable().optional(),
  ),
  targetQuantity: optionalNumber("Restock target").pipe(
    z.number().min(0, "Restock target can't be negative").max(MAX_QTY).nullable().optional(),
  ),
  ingredientKey: ingredientKeySchema,
  notes: optionalText(2000),
});

const targetRefinement = <T extends { minQuantity?: number | null; targetQuantity?: number | null }>(v: T, ctx: z.RefinementCtx) => {
  if (v.targetQuantity != null && v.minQuantity == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["minQuantity"], message: "Set a minimum to use a restock target" });
  }
  if (v.targetQuantity != null && v.minQuantity != null && v.targetQuantity < v.minQuantity) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetQuantity"], message: "Target must be at least the minimum" });
  }
};

export const createItemSchema = itemBase
  .extend({
    quantity: number("Quantity").pipe(z.number().min(0, "Quantity can't be negative").max(MAX_QTY, "Quantity is too large")),
    locationId: z.preprocess(emptyToNull, uuid.nullable()).refine((v) => v !== null, "Choose a storage location"),
    expiryDate: optionalDate,
    purchaseDate: optionalDate,
    price: optionalNumber("Price").pipe(z.number().min(0, "Price can't be negative").max(10_000_000).nullable().optional()),
    existingProductId: optionalUuid,
    confirmDuplicate: z.preprocess((v) => v === true || v === "true", z.boolean()).optional(),
  })
  .superRefine(targetRefinement)
  .superRefine((v, ctx) => {
    if (v.expiryDate && v.purchaseDate && v.expiryDate < v.purchaseDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expiryDate"], message: "Expiry can't be before the purchase date" });
    }
  });
export type CreateItemInput = z.infer<typeof createItemSchema>;

export const updateProductSchema = itemBase
  .extend({
    productId: uuid,
    version: z.coerce.number().int().positive(),
    clearImage: z.preprocess((v) => v === true || v === "true", z.boolean()).optional(),
  })
  .superRefine(targetRefinement);
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const addStockSchema = z.object({
  productId: uuid,
  locationId: uuid,
  quantity: number("Quantity").pipe(z.number().positive("Quantity must be greater than zero").max(MAX_QTY)),
  unit: unitSchema,
  expiryDate: optionalDate,
  purchaseDate: optionalDate,
  price: optionalNumber("Price").pipe(z.number().min(0).max(10_000_000).nullable().optional()),
  note: optionalText(500),
});

export const adjustLotSchema = z.object({
  lotId: uuid,
  amount: number("Amount").pipe(z.number().positive("Amount must be greater than zero").max(MAX_QTY)),
  kind: z.enum(["add", "consume", "discard"]),
  note: optionalText(500),
});

export const setLotQuantitySchema = z.object({
  lotId: uuid,
  quantity: number("Quantity").pipe(z.number().min(0, "Quantity can't be negative").max(MAX_QTY)),
  version: z.coerce.number().int().positive().optional(),
  note: optionalText(500),
});

export const moveLotSchema = z.object({
  lotId: uuid,
  toLocationId: uuid,
  quantity: optionalNumber("Quantity").pipe(z.number().positive("Amount must be greater than zero").nullable().optional()),
  note: optionalText(500),
});

export const updateLotSchema = z
  .object({
    lotId: uuid,
    version: z.coerce.number().int().positive(),
    expiryDate: optionalDate,
    purchaseDate: optionalDate,
    notes: optionalText(500),
  })
  .superRefine((v, ctx) => {
    if (v.expiryDate && v.purchaseDate && v.expiryDate < v.purchaseDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expiryDate"], message: "Expiry can't be before the purchase date" });
    }
  });

export const consumeProductSchema = z.object({
  productId: uuid,
  quantity: number("Quantity").pipe(z.number().positive("Amount must be greater than zero").max(MAX_QTY)),
  unit: unitSchema,
  note: optionalText(500),
});

// ---------------------------------------------------------------------------
// Locations & categories
// ---------------------------------------------------------------------------
export const LOCATION_KINDS = ["room", "storage", "shelf", "drawer", "container", "other"] as const;

export const locationSchema = z.object({
  id: optionalUuid,
  name: trimmed(60, "Name"),
  kind: z.enum(LOCATION_KINDS),
  parentId: optionalUuid,
  notes: optionalText(500),
});
export type LocationInput = z.infer<typeof locationSchema>;

export const categorySchema = z.object({
  id: optionalUuid,
  name: trimmed(60, "Name"),
  icon: z
    .string()
    .regex(/^[a-z-]{1,40}$/)
    .default("package"),
  storeSection: optionalText(60),
});
export type CategoryInput = z.infer<typeof categorySchema>;

// ---------------------------------------------------------------------------
// Shopping
// ---------------------------------------------------------------------------
export const shoppingItemSchema = z.object({
  name: trimmed(120, "Item"),
  quantity: number("Quantity").pipe(z.number().positive("Quantity must be greater than zero").max(MAX_QTY)),
  unit: unitSchema,
  categoryId: optionalUuid,
  productId: optionalUuid,
  notes: optionalText(300),
});
export type ShoppingItemInput = z.infer<typeof shoppingItemSchema>;

export const updateShoppingItemSchema = shoppingItemSchema.omit({ productId: true }).extend({ id: uuid });

export const completeShoppingSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: uuid,
        locationId: uuid,
        expiryDate: optionalDate,
        price: optionalNumber("Price").pipe(z.number().min(0).max(10_000_000).nullable().optional()),
      }),
    )
    .min(1, "Select at least one item")
    .max(200),
});

// ---------------------------------------------------------------------------
// Household, members, ratings
// ---------------------------------------------------------------------------
export const householdSettingsSchema = z.object({
  name: trimmed(80, "Household name"),
  timezone: z.string().refine(isValidTimeZone, "Choose a valid time zone"),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code"),
  expiryWarningDays: number("Warning days").pipe(z.number().int("Use whole days").min(0).max(90)),
  restockMultiplier: number("Restock multiplier").pipe(z.number().min(1, "Use at least 1").max(10, "Use at most 10")),
});

export const createHouseholdSchema = z.object({
  name: trimmed(80, "Household name"),
  timezone: z.string().refine(isValidTimeZone, "Choose a valid time zone"),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code"),
  seedDefaults: z.preprocess((v) => v === true || v === "true" || v === "on", z.boolean()),
});

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  role: z.enum(["editor", "viewer"]),
});

export const memberRoleSchema = z.object({
  userId: uuid,
  role: z.enum(["owner", "editor", "viewer"]),
});

export const ratingSchema = z.object({
  targetId: uuid,
  target: z.enum(["product", "brand"]),
  rating: z.coerce.number().int().min(1, "Choose 1–5 stars").max(5),
  notes: optionalText(1000),
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export const signUpSchema = z.object({
  displayName: optionalText(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(72, "Use at most 72 characters")
    .regex(/[A-Za-z]/, "Include at least one letter")
    .regex(/[0-9]/, "Include at least one number"),
});

export const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

export const newPasswordSchema = z
  .object({
    password: signUpSchema.shape.password,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

// ---------------------------------------------------------------------------
// Offline sync
// ---------------------------------------------------------------------------
export const syncMutationSchema = z.object({
  id: uuid,
  householdId: uuid,
  createdAt: z.string().max(40),
  payload: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("lot.adjust"),
      lotId: uuid,
      productId: uuid,
      delta: z
        .number()
        .finite()
        .refine((v) => v !== 0, "Delta must not be zero")
        .refine((v) => Math.abs(v) <= MAX_QTY, "Delta too large"),
      kind: z.enum(["add", "consume", "discard"]),
      unit: unitSchema,
      label: z.string().max(200),
    }),
    z.object({
      type: z.literal("shopping.toggle"),
      itemId: uuid,
      checked: z.boolean(),
      label: z.string().max(200),
    }),
  ]),
});

export const syncRequestSchema = z.object({
  mutations: z.array(syncMutationSchema).min(1).max(50),
});

/** Flattens zod errors to { field: [messages] } for inline form display. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** Converts FormData to a plain object (files kept as File). */
export function formDataToObject(formData: FormData): Record<string, FormDataEntryValue> {
  const out: Record<string, FormDataEntryValue> = {};
  formData.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}
