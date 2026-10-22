import {
  AuthError,
  NetworkError,
  type MutationPayload,
  type QueueStore,
  type QueuedMutation,
  type SyncTransport,
} from "./types";

export interface FlushOutcome {
  applied: number;
  failed: number;
  remaining: number;
  networkError: boolean;
  authError: boolean;
}

export interface MutationQueueOptions {
  maxAttempts?: number;
  batchSize?: number;
  now?: () => Date;
  createId?: () => string;
}

type Listener = (items: QueuedMutation[]) => void;

/**
 * Durable queue of offline changes. Nothing is removed until the server has
 * confirmed it (applied/duplicate) or the user explicitly discards it.
 * Conflicts and repeated errors are kept as `failed` and surfaced in the UI.
 */
export class MutationQueue {
  private readonly store: QueueStore;
  private readonly transport: SyncTransport;
  private readonly maxAttempts: number;
  private readonly batchSize: number;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly listeners = new Set<Listener>();
  private flushing: Promise<FlushOutcome> | null = null;

  constructor(store: QueueStore, transport: SyncTransport, options: MutationQueueOptions = {}) {
    this.store = store;
    this.transport = transport;
    this.maxAttempts = options.maxAttempts ?? 5;
    this.batchSize = options.batchSize ?? 25;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? (() => crypto.randomUUID());
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async list(): Promise<QueuedMutation[]> {
    const items = await this.store.getAll();
    return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }

  private async emit(): Promise<void> {
    if (this.listeners.size === 0) return;
    const items = await this.list();
    for (const listener of this.listeners) listener(items);
  }

  async enqueue(householdId: string, payload: MutationPayload): Promise<QueuedMutation> {
    const mutation: QueuedMutation = {
      id: this.createId(),
      householdId,
      payload,
      createdAt: this.now().toISOString(),
      status: "pending",
      attempts: 0,
    };
    await this.store.put(mutation);
    await this.emit();
    return mutation;
  }

  async retry(id: string): Promise<void> {
    const item = (await this.store.getAll()).find((m) => m.id === id);
    if (!item) return;
    await this.store.put({ ...item, status: "pending", attempts: 0, error: undefined });
    await this.emit();
  }

  async discard(id: string): Promise<void> {
    await this.store.delete(id);
    await this.emit();
  }

  /** Recovers items left in "syncing" if the app was closed mid-sync. */
  async recover(): Promise<void> {
    const items = await this.store.getAll();
    await Promise.all(
      items.filter((m) => m.status === "syncing").map((m) => this.store.put({ ...m, status: "pending" })),
    );
    await this.emit();
  }

  flush(): Promise<FlushOutcome> {
    if (!this.flushing) {
      this.flushing = this.doFlush().finally(() => {
        this.flushing = null;
      });
    }
    return this.flushing;
  }

  private async doFlush(): Promise<FlushOutcome> {
    const outcome: FlushOutcome = { applied: 0, failed: 0, remaining: 0, networkError: false, authError: false };
    const pending = (await this.list()).filter((m) => m.status === "pending");

    for (let i = 0; i < pending.length; i += this.batchSize) {
      const batch = pending.slice(i, i + this.batchSize);
      await Promise.all(batch.map((m) => this.store.put({ ...m, status: "syncing" })));
      await this.emit();

      let results;
      try {
        results = await this.transport(batch);
      } catch (error) {
        await Promise.all(batch.map((m) => this.store.put({ ...m, status: "pending" })));
        if (error instanceof AuthError) outcome.authError = true;
        else if (error instanceof NetworkError) outcome.networkError = true;
        else outcome.networkError = true;
        break;
      }

      const byId = new Map(results.map((r) => [r.id, r]));
      for (const mutation of batch) {
        const result = byId.get(mutation.id);
        if (result && (result.status === "applied" || result.status === "duplicate")) {
          await this.store.delete(mutation.id);
          outcome.applied += 1;
        } else if (result && result.status === "conflict") {
          await this.store.put({ ...mutation, status: "failed", error: result.message ?? "Could not apply this change." });
          outcome.failed += 1;
        } else {
          const attempts = mutation.attempts + 1;
          const failed = attempts >= this.maxAttempts;
          await this.store.put({
            ...mutation,
            attempts,
            status: failed ? "failed" : "pending",
            error: result?.message ?? "The server did not confirm this change.",
          });
          if (failed) outcome.failed += 1;
        }
      }
      await this.emit();
    }

    outcome.remaining = (await this.store.getAll()).filter((m) => m.status !== "failed").length;
    await this.emit();
    return outcome;
  }
}

export class MemoryQueueStore implements QueueStore {
  private readonly items = new Map<string, QueuedMutation>();
  async getAll(): Promise<QueuedMutation[]> {
    return [...this.items.values()].map((m) => ({ ...m }));
  }
  async put(mutation: QueuedMutation): Promise<void> {
    this.items.set(mutation.id, { ...mutation });
  }
  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}

/** Sum of not-yet-confirmed deltas for a lot (used for optimistic display). */
export function pendingDeltaForLot(items: QueuedMutation[], lotId: string): number[] {
  return items
    .filter((m) => m.status !== "failed" && m.payload.type === "lot.adjust" && m.payload.lotId === lotId)
    .map((m) => (m.payload.type === "lot.adjust" ? m.payload.delta : 0));
}

/** Latest queued checked-state for a shopping item, if any. */
export function pendingCheckedState(items: QueuedMutation[], itemId: string): boolean | null {
  let state: boolean | null = null;
  for (const m of items) {
    if (m.status !== "failed" && m.payload.type === "shopping.toggle" && m.payload.itemId === itemId) {
      state = m.payload.checked;
    }
  }
  return state;
}
