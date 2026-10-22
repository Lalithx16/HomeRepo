import { describe, expect, it } from "vitest";
import {
  buildLocationTree,
  flattenTree,
  getAncestors,
  getDescendantIds,
  locationPath,
  validParentOptions,
  wouldCreateCycle,
} from "@/lib/domain/locations";

const items = [
  { id: "home", parentId: null, name: "Home", kind: "room", productCount: 0 },
  { id: "kitchen", parentId: "home", name: "Kitchen", kind: "room", productCount: 1 },
  { id: "pantry", parentId: "kitchen", name: "Pantry", kind: "storage", productCount: 3 },
  { id: "shelf2", parentId: "pantry", name: "Shelf 2", kind: "shelf", productCount: 2 },
  { id: "boxA", parentId: "shelf2", name: "Container A", kind: "container", productCount: 4 },
  { id: "garage", parentId: null, name: "Garage", kind: "room", productCount: 5 },
];

describe("location hierarchy", () => {
  it("builds a tree with depth and rolled-up counts", () => {
    const roots = buildLocationTree(items);
    expect(roots.map((r) => r.name)).toEqual(["Garage", "Home"]);
    const home = roots.find((r) => r.id === "home")!;
    expect(home.totalProductCount).toBe(10);
    expect(flattenTree(roots).find((n) => n.id === "boxA")?.depth).toBe(4);
  });

  it("produces breadcrumbs and paths", () => {
    expect(getAncestors(items, "boxA").map((l) => l.name)).toEqual(["Home", "Kitchen", "Pantry", "Shelf 2", "Container A"]);
    expect(locationPath(items, "shelf2")).toBe("Home / Kitchen / Pantry / Shelf 2");
  });

  it("finds descendants including itself", () => {
    expect(getDescendantIds(items, "pantry").sort()).toEqual(["boxA", "pantry", "shelf2"]);
  });

  it("detects circular parent relationships", () => {
    expect(wouldCreateCycle(items, "kitchen", "boxA")).toBe(true);
    expect(wouldCreateCycle(items, "kitchen", "kitchen")).toBe(true);
    expect(wouldCreateCycle(items, "boxA", "garage")).toBe(false);
    expect(wouldCreateCycle(items, "boxA", null)).toBe(false);
  });

  it("excludes self and descendants from parent options", () => {
    const ids = validParentOptions(items, "pantry").map((o) => o.id);
    expect(ids).not.toContain("pantry");
    expect(ids).not.toContain("boxA");
    expect(ids).toContain("kitchen");
  });

  it("survives corrupted cyclic data without looping", () => {
    const bad = [
      { id: "a", parentId: "b", name: "A", kind: "room" },
      { id: "b", parentId: "a", name: "B", kind: "room" },
    ];
    expect(() => getAncestors(bad, "a")).not.toThrow();
    expect(getDescendantIds(bad, "a").sort()).toEqual(["a", "b"]);
  });
});
