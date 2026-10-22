import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { IdbQueueStore } from "@/lib/offline/idb-store";
import type { QueuedMutation } from "@/lib/offline/types";

const mutation: QueuedMutation = {
  id: "abc",
  householdId: "h1",
  payload: { type: "shopping.toggle", itemId: "s1", checked: true, label: "Milk" },
  createdAt: "2026-10-21T10:00:00.000Z",
  status: "pending",
  attempts: 0,
};

describe("IndexedDB queue store", () => {
  it("persists mutations across store instances (simulated reload)", async () => {
    const first = new IdbQueueStore();
    await first.put(mutation);
    const second = new IdbQueueStore();
    expect(await second.getAll()).toEqual([mutation]);
    await second.delete("abc");
    expect(await new IdbQueueStore().getAll()).toEqual([]);
  });
});
