import { describe, expect, it, vi } from "vitest";
import { MemoryQueueStore, MutationQueue, pendingCheckedState, pendingDeltaForLot } from "@/lib/offline/queue";
import { AuthError, NetworkError, type QueuedMutation, type SyncResult } from "@/lib/offline/types";

let counter = 0;
const createId = () => `m${++counter}`;
const adjust = (lotId: string, delta: number) =>
  ({ type: "lot.adjust", lotId, productId: "p", delta, kind: delta < 0 ? "consume" : "add", unit: "pcs", label: "Eggs" }) as const;

describe("offline mutation queue", () => {
  it("persists changes until the server confirms them", async () => {
    const store = new MemoryQueueStore();
    const transport = vi.fn(async (batch: QueuedMutation[]): Promise<SyncResult[]> =>
      batch.map((m) => ({ id: m.id, status: "applied" })),
    );
    const queue = new MutationQueue(store, transport, { createId });
    await queue.enqueue("h1", adjust("lot1", -1));
    await queue.enqueue("h1", adjust("lot1", -1));
    expect((await queue.list()).length).toBe(2);

    const outcome = await queue.flush();
    expect(outcome.applied).toBe(2);
    expect(outcome.remaining).toBe(0);
    expect(await queue.list()).toEqual([]);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("keeps everything pending when the network fails", async () => {
    const queue = new MutationQueue(new MemoryQueueStore(), async () => {
      throw new NetworkError();
    }, { createId });
    await queue.enqueue("h1", adjust("lot1", -1));
    const outcome = await queue.flush();
    expect(outcome.networkError).toBe(true);
    const items = await queue.list();
    expect(items).toHaveLength(1);
    expect(items[0]!.status).toBe("pending");
  });

  it("reports auth errors without dropping changes", async () => {
    const queue = new MutationQueue(new MemoryQueueStore(), async () => {
      throw new AuthError();
    }, { createId });
    await queue.enqueue("h1", adjust("lot1", 1));
    const outcome = await queue.flush();
    expect(outcome.authError).toBe(true);
    expect((await queue.list())[0]!.status).toBe("pending");
  });

  it("marks conflicts as failed and keeps them visible", async () => {
    const queue = new MutationQueue(
      new MemoryQueueStore(),
      async (batch) => batch.map((m) => ({ id: m.id, status: "conflict", message: "Only 1 pcs left." })),
      { createId },
    );
    await queue.enqueue("h1", adjust("lot1", -5));
    const outcome = await queue.flush();
    expect(outcome.failed).toBe(1);
    const [item] = await queue.list();
    expect(item!.status).toBe("failed");
    expect(item!.error).toBe("Only 1 pcs left.");
  });

  it("retries transient errors up to the limit, then fails visibly", async () => {
    const queue = new MutationQueue(
      new MemoryQueueStore(),
      async (batch) => batch.map((m) => ({ id: m.id, status: "error", message: "Temporary" })),
      { createId, maxAttempts: 2 },
    );
    await queue.enqueue("h1", adjust("lot1", 1));
    await queue.flush();
    expect((await queue.list())[0]!.status).toBe("pending");
    await queue.flush();
    expect((await queue.list())[0]!.status).toBe("failed");
  });

  it("treats duplicates (already applied) as success", async () => {
    const queue = new MutationQueue(
      new MemoryQueueStore(),
      async (batch) => batch.map((m) => ({ id: m.id, status: "duplicate" })),
      { createId },
    );
    await queue.enqueue("h1", adjust("lot1", 1));
    expect((await queue.flush()).applied).toBe(1);
  });

  it("supports retry and discard of failed items", async () => {
    let mode: SyncResult["status"] = "conflict";
    const queue = new MutationQueue(new MemoryQueueStore(), async (batch) => batch.map((m) => ({ id: m.id, status: mode })), {
      createId,
    });
    const a = await queue.enqueue("h1", adjust("lot1", -1));
    const b = await queue.enqueue("h1", adjust("lot2", -1));
    await queue.flush();
    await queue.discard(b.id);
    mode = "applied";
    await queue.retry(a.id);
    await queue.flush();
    expect(await queue.list()).toEqual([]);
  });

  it("does not run two flushes concurrently", async () => {
    let calls = 0;
    const queue = new MutationQueue(new MemoryQueueStore(), async (batch) => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 5));
      return batch.map((m) => ({ id: m.id, status: "applied" as const }));
    }, { createId });
    await queue.enqueue("h1", adjust("lot1", 1));
    await Promise.all([queue.flush(), queue.flush()]);
    expect(calls).toBe(1);
  });

  it("recovers items stuck in 'syncing' after a crash", async () => {
    const store = new MemoryQueueStore();
    await store.put({ id: "x", householdId: "h1", payload: adjust("lot1", 1), createdAt: "2026-01-01T00:00:00Z", status: "syncing", attempts: 0 });
    const queue = new MutationQueue(store, async () => [], { createId });
    await queue.recover();
    expect((await queue.list())[0]!.status).toBe("pending");
  });

  it("computes optimistic projections", async () => {
    const store = new MemoryQueueStore();
    const queue = new MutationQueue(store, async () => [], { createId });
    await queue.enqueue("h1", adjust("lot1", -1));
    await queue.enqueue("h1", adjust("lot1", 2));
    await queue.enqueue("h1", { type: "shopping.toggle", itemId: "s1", checked: true, label: "Milk" });
    await queue.enqueue("h1", { type: "shopping.toggle", itemId: "s1", checked: false, label: "Milk" });
    const items = await queue.list();
    expect(pendingDeltaForLot(items, "lot1")).toEqual([-1, 2]);
    expect(pendingCheckedState(items, "s1")).toBe(false);
    expect(pendingCheckedState(items, "other")).toBeNull();
  });
});
