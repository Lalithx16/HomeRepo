"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { IdbQueueStore } from "@/lib/offline/idb-store";
import { MemoryQueueStore, MutationQueue, pendingCheckedState, pendingDeltaForLot } from "@/lib/offline/queue";
import { AuthError, NetworkError, type MutationPayload, type QueuedMutation, type SyncResult } from "@/lib/offline/types";

interface OfflineContextValue {
  online: boolean;
  syncing: boolean;
  items: QueuedMutation[];
  durable: boolean;
  householdId: string;
  enqueue: (payload: MutationPayload) => Promise<void>;
  syncNow: () => Promise<void>;
  retry: (id: string) => Promise<void>;
  discard: (id: string) => Promise<void>;
  pendingDeltas: (lotId: string) => number[];
  hasFailedForLot: (lotId: string) => boolean;
  pendingChecked: (itemId: string) => boolean | null;
}

const OfflineContext = React.createContext<OfflineContextValue | null>(null);

async function transport(mutations: QueuedMutation[]): Promise<SyncResult[]> {
  let response: Response;
  try {
    response = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mutations }),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new NetworkError();
  }
  if (response.status === 401) throw new AuthError();
  if (response.status === 400 || response.status === 403) {
    // The server will never accept these as-is: surface them instead of retrying forever.
    return mutations.map((m) => ({ id: m.id, status: "conflict", message: "This change could not be applied." }));
  }
  if (!response.ok) throw new NetworkError(`Sync failed (${response.status})`);
  const body = (await response.json()) as { results?: SyncResult[] };
  return body.results ?? [];
}

export function OfflineProvider({ householdId, children }: { householdId: string; children: React.ReactNode }) {
  const router = useRouter();
  const [online, setOnline] = React.useState(true);
  const [items, setItems] = React.useState<QueuedMutation[]>([]);
  const [syncing, setSyncing] = React.useState(false);
  const [durable, setDurable] = React.useState(true);
  const queueRef = React.useRef<MutationQueue | null>(null);

  const syncNow = React.useCallback(async () => {
    const queue = queueRef.current;
    if (!queue || (typeof navigator !== "undefined" && !navigator.onLine)) return;
    setSyncing(true);
    try {
      const outcome = await queue.flush();
      if (outcome.applied > 0) router.refresh();
      if (outcome.authError) {
        toast.error("Your session expired", {
          description: "Sign in again to sync your saved changes. They're kept on this device.",
          action: { label: "Sign in", onClick: () => router.push("/login") },
        });
      }
      if (outcome.failed > 0) {
        toast.error(`${outcome.failed} ${outcome.failed === 1 ? "change" : "changes"} couldn't sync`, {
          description: "Open the sync status to review them.",
        });
      }
    } finally {
      setSyncing(false);
    }
  }, [router]);

  React.useEffect(() => {
    let store;
    try {
      store = new IdbQueueStore();
    } catch {
      store = new MemoryQueueStore();
      setDurable(false);
    }
    const queue = new MutationQueue(store, transport);
    queueRef.current = queue;
    const unsubscribe = queue.subscribe(setItems);
    void queue
      .recover()
      .then(() => queue.list())
      .then((list) => {
        setItems(list);
        if (navigator.onLine && list.some((m) => m.status === "pending")) void syncNow();
      })
      .catch(() => setDurable(false));
    return () => {
      unsubscribe();
    };
  }, [syncNow]);

  React.useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    const handleOnline = () => {
      setOnline(true);
      void syncNow();
    };
    const handleOffline = () => setOnline(false);
    const handleVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void syncNow();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [syncNow]);

  // Periodic retry while there is pending work (e.g. flaky connections).
  const hasPending = items.some((m) => m.status === "pending");
  React.useEffect(() => {
    if (!hasPending || !online) return;
    const timer = window.setInterval(() => void syncNow(), 20_000);
    return () => window.clearInterval(timer);
  }, [hasPending, online, syncNow]);

  const value = React.useMemo<OfflineContextValue>(
    () => ({
      online,
      syncing,
      items,
      durable,
      householdId,
      enqueue: async (payload) => {
        const queue = queueRef.current;
        if (!queue) throw new Error("Offline queue not ready");
        await queue.enqueue(householdId, payload);
        if (navigator.onLine) void syncNow();
      },
      syncNow,
      retry: async (id) => {
        await queueRef.current?.retry(id);
        await syncNow();
      },
      discard: async (id) => {
        await queueRef.current?.discard(id);
      },
      pendingDeltas: (lotId) => pendingDeltaForLot(items, lotId),
      hasFailedForLot: (lotId) =>
        items.some((m) => m.status === "failed" && m.payload.type === "lot.adjust" && m.payload.lotId === lotId),
      pendingChecked: (itemId) => pendingCheckedState(items, itemId),
    }),
    [online, syncing, items, durable, householdId, syncNow],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline(): OfflineContextValue {
  const ctx = React.useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used inside <OfflineProvider>");
  return ctx;
}
