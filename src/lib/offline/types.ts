/** Changes that can be made while offline and synchronized later. */
export type MutationPayload =
  | {
      type: "lot.adjust";
      lotId: string;
      productId: string;
      /** Signed change in the lot's unit (negative = consume/discard). */
      delta: number;
      kind: "add" | "consume" | "discard";
      unit: string;
      label: string;
    }
  | {
      type: "shopping.toggle";
      itemId: string;
      checked: boolean;
      label: string;
    };

export type MutationStatus = "pending" | "syncing" | "failed";

export interface QueuedMutation {
  /** Client-generated UUID; doubles as the server idempotency key. */
  id: string;
  householdId: string;
  payload: MutationPayload;
  createdAt: string;
  status: MutationStatus;
  attempts: number;
  error?: string;
}

export type SyncResultStatus = "applied" | "duplicate" | "conflict" | "error";

export interface SyncResult {
  id: string;
  status: SyncResultStatus;
  message?: string;
}

export interface QueueStore {
  getAll(): Promise<QueuedMutation[]>;
  put(mutation: QueuedMutation): Promise<void>;
  delete(id: string): Promise<void>;
}

export class NetworkError extends Error {
  constructor(message = "Network unavailable") {
    super(message);
    this.name = "NetworkError";
  }
}

export class AuthError extends Error {
  constructor(message = "Your session has expired. Sign in again to sync.") {
    super(message);
    this.name = "AuthError";
  }
}

export type SyncTransport = (mutations: QueuedMutation[]) => Promise<SyncResult[]>;
