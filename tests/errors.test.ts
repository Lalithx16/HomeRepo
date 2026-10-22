import { describe, expect, it } from "vitest";
import { mapDbError } from "@/lib/errors";

describe("database error mapping", () => {
  it("maps known function errors and prefers the safe DETAIL text", () => {
    expect(mapDbError({ message: "insufficient_quantity", details: "Only 2 pcs left." })).toEqual({
      code: "conflict",
      message: "Only 2 pcs left.",
    });
    expect(mapDbError({ message: "forbidden", details: null }).code).toBe("forbidden");
    expect(mapDbError({ message: "location_cycle" }).code).toBe("validation");
  });

  it("never leaks details for authentication failures", () => {
    expect(mapDbError({ message: "not_authenticated", details: "internal" }).message).toBe(
      "Your session has expired. Please sign in again.",
    );
  });

  it("maps Postgres error codes", () => {
    expect(mapDbError({ message: "duplicate key value", code: "23505" }).code).toBe("duplicate");
    expect(mapDbError({ message: "violates foreign key", code: "23503" }).code).toBe("conflict");
    expect(mapDbError({ message: "new row violates row-level security policy", code: "42501" }).code).toBe("forbidden");
  });

  it("hides unknown SQL errors behind a generic message", () => {
    const mapped = mapDbError({ message: 'relation "secret_table" does not exist', code: "42P01" });
    expect(mapped.code).toBe("unknown");
    expect(mapped.message.includes("secret_table")).toBe(false);
  });
});
