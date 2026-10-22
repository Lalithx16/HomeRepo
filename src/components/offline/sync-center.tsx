"use client";

import { AlertTriangle, CloudOff, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import * as React from "react";
import { formatRelativeTime } from "@/lib/domain/format";
import { formatQuantity } from "@/lib/domain/units";
import type { QueuedMutation } from "@/lib/offline/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useOffline } from "./offline-provider";

function describe(m: QueuedMutation): string {
  const p = m.payload;
  if (p.type === "lot.adjust") {
    const verb = p.kind === "add" ? "Add" : p.kind === "discard" ? "Discard" : "Use";
    return `${verb} ${formatQuantity(Math.abs(p.delta), p.unit)} · ${p.label}`;
  }
  return `${p.checked ? "Check off" : "Uncheck"} ${p.label}`;
}

/** Header indicator + dialog showing offline state, pending and failed changes. */
export function SyncCenter({ className }: { className?: string }) {
  const { online, syncing, items, durable, syncNow, retry, discard } = useOffline();
  const [open, setOpen] = React.useState(false);
  const pending = items.filter((m) => m.status !== "failed");
  const failed = items.filter((m) => m.status === "failed");

  let label: string | null = null;
  let Icon = RefreshCw;
  let tone = "text-muted-foreground";
  if (failed.length > 0) {
    label = `${failed.length} failed`;
    Icon = AlertTriangle;
    tone = "text-critical bg-critical-soft";
  } else if (!online) {
    label = pending.length > 0 ? `Offline · ${pending.length} pending` : "Offline";
    Icon = CloudOff;
    tone = "text-warning bg-warning-soft";
  } else if (pending.length > 0 || syncing) {
    label = pending.length > 0 ? `Syncing ${pending.length}` : "Syncing";
    Icon = RefreshCw;
    tone = "text-info bg-info-soft";
  }

  if (!label) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
          tone,
          className,
        )}
        aria-label={`Sync status: ${label}. Open details`}
      >
        <Icon className={cn("size-3.5", Icon === RefreshCw && (syncing || pending.length > 0) && online && "animate-spin")} aria-hidden />
        <span>{label}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Sync status"
          description={
            online
              ? "Changes made on this device are sent to your household automatically."
              : "You're offline. Quantity and shopping-list changes are saved on this device and will sync when you reconnect."
          }
        >
          {!durable ? (
            <p className="mb-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
              This browser blocks offline storage, so unsynced changes will be lost if you close the app.
            </p>
          ) : null}
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Everything is up to date.</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {[...failed, ...pending].map((m) => (
                <li key={m.id} className="flex items-start gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{describe(m)}</p>
                    <p className={cn("mt-0.5 text-xs", m.status === "failed" ? "text-critical" : "text-muted-foreground")}>
                      {m.status === "failed"
                        ? `Not synced — ${m.error ?? "needs attention"}`
                        : m.status === "syncing"
                          ? "Syncing…"
                          : `Pending · saved ${formatRelativeTime(m.createdAt)}`}
                    </p>
                  </div>
                  {m.status === "failed" ? (
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon-sm" variant="ghost" aria-label="Retry" onClick={() => void retry(m.id)} disabled={!online}>
                        <RotateCcw />
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label="Discard change" onClick={() => void discard(m.id)}>
                        <Trash2 />
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex justify-end">
            <Button variant="secondary" onClick={() => void syncNow()} disabled={!online || syncing} loading={syncing}>
              Sync now
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function OfflineBanner() {
  const { online } = useOffline();
  if (online) return null;
  return (
    <div role="status" className="border-b border-border bg-warning-soft px-4 py-2 text-center text-[13px] text-warning">
      <CloudOff className="mr-1.5 inline size-3.5 align-[-2px]" aria-hidden />
      You&apos;re offline. You may be seeing saved data — quantity and shopping changes will sync when you reconnect.
    </div>
  );
}
