import { describe, expect, it } from "vitest";
import {
  addStockSchema,
  createItemSchema,
  householdSettingsSchema,
  locationSchema,
  signUpSchema,
  syncRequestSchema,
} from "@/lib/validation/schemas";

const uuid = "8b0f6c1e-3c2a-4d8e-9f3b-2a1c5d7e9f00";

describe("input validation", () => {
  it("accepts a minimal item and normalizes empty strings to null", () => {
    const parsed = createItemSchema.safeParse({ name: "  Rice ", unit: "kg", quantity: "2", locationId: uuid, brand: "", expiryDate: "" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Rice");
      expect(parsed.data.brand).toBeNull();
      expect(parsed.data.expiryDate).toBeNull();
      expect(parsed.data.quantity).toBe(2);
    }
  });

  it("rejects missing location, negative quantity, unknown units and bad dates", () => {
    expect(createItemSchema.safeParse({ name: "Rice", unit: "kg", quantity: "1", locationId: "" }).success).toBe(false);
    expect(createItemSchema.safeParse({ name: "Rice", unit: "kg", quantity: "-1", locationId: uuid }).success).toBe(false);
    expect(createItemSchema.safeParse({ name: "Rice", unit: "bushel", quantity: "1", locationId: uuid }).success).toBe(false);
    expect(createItemSchema.safeParse({ name: "Rice", unit: "kg", quantity: "1", locationId: uuid, expiryDate: "2026-02-30" }).success).toBe(false);
  });

  it("requires the restock target to be at least the minimum", () => {
    const bad = createItemSchema.safeParse({ name: "Rice", unit: "kg", quantity: "1", locationId: uuid, minQuantity: "3", targetQuantity: "2" });
    expect(bad.success).toBe(false);
  });

  it("rejects expiry before purchase", () => {
    const bad = createItemSchema.safeParse({
      name: "Milk",
      unit: "l",
      quantity: "1",
      locationId: uuid,
      purchaseDate: "2026-10-21",
      expiryDate: "2026-10-01",
    });
    expect(bad.success).toBe(false);
  });

  it("validates stock additions", () => {
    expect(addStockSchema.safeParse({ productId: uuid, locationId: uuid, quantity: 0, unit: "pcs" }).success).toBe(false);
    expect(addStockSchema.safeParse({ productId: uuid, locationId: uuid, quantity: "1,5", unit: "kg" }).success).toBe(true);
  });

  it("validates locations, household settings and passwords", () => {
    expect(locationSchema.safeParse({ name: "Pantry", kind: "storage", parentId: "" }).success).toBe(true);
    expect(locationSchema.safeParse({ name: "", kind: "storage" }).success).toBe(false);
    expect(householdSettingsSchema.safeParse({ name: "Home", timezone: "Mars/Base", currency: "usd", expiryWarningDays: 7, restockMultiplier: 2 }).success).toBe(false);
    expect(householdSettingsSchema.safeParse({ name: "Home", timezone: "Asia/Kolkata", currency: "inr", expiryWarningDays: "7", restockMultiplier: "2" }).success).toBe(true);
    expect(signUpSchema.safeParse({ email: "a@b.co", password: "password" }).success).toBe(false);
    expect(signUpSchema.safeParse({ email: "a@b.co", password: "passw0rd!" }).success).toBe(true);
  });

  it("validates offline sync payloads strictly", () => {
    const ok = {
      mutations: [
        {
          id: uuid,
          householdId: uuid,
          createdAt: "2026-10-21T10:00:00.000Z",
          payload: { type: "lot.adjust", lotId: uuid, productId: uuid, delta: -1, kind: "consume", unit: "pcs", label: "Eggs" },
        },
      ],
    };
    expect(syncRequestSchema.safeParse(ok).success).toBe(true);
    const zero = structuredClone(ok);
    zero.mutations[0]!.payload.delta = 0;
    expect(syncRequestSchema.safeParse(zero).success).toBe(false);
    expect(syncRequestSchema.safeParse({ mutations: [] }).success).toBe(false);
  });
});
