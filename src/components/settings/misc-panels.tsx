"use client";

import { LogOut, Monitor, Moon, Sun, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import * as React from "react";
import { toast } from "sonner";
import { deleteHouseholdAction, removeMemberAction, updateProfileAction } from "@/lib/actions/household";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useOffline } from "@/components/offline/offline-provider";
import { clearCachedPages } from "@/components/offline/sw-register";

export function ProfileForm({ displayName, email }: { displayName: string | null; email: string | null }) {
  const router = useRouter();
  const [name, setName] = React.useState(displayName ?? "");
  const [pending, startTransition] = React.useTransition();
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateProfileAction(name);
          if (result.ok) {
            toast.success(result.message);
            router.refresh();
          } else toast.error(result.error);
        });
      }}
    >
      <Field label="Display name" htmlFor="profile-name" className="flex-1" hint={email ? `Signed in as ${email}` : undefined}>
        <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-describedby="profile-name-hint" />
      </Field>
      <Button type="submit" variant="secondary" loading={pending} className="sm:mb-6">
        Save
      </Button>
    </form>
  );
}

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
      {options.map((o) => {
        const active = mounted && (theme ?? "system") === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(o.value)}
            className={cn(
              "flex h-20 flex-col items-center justify-center gap-2 rounded-xl border text-sm transition-colors",
              active ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border hover:bg-surface-hover",
            )}
          >
            <o.icon className="size-5" aria-hidden />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function OfflinePanel() {
  const { items, online, durable, syncNow, syncing } = useOffline();
  const pending = items.filter((m) => m.status !== "failed").length;
  const failed = items.filter((m) => m.status === "failed").length;
  return (
    <div className="flex flex-col gap-3 text-sm">
      <dl className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-surface-muted p-3">
          <dt className="text-xs text-muted-foreground">Connection</dt>
          <dd className="mt-1 font-medium">{online ? "Online" : "Offline"}</dd>
        </div>
        <div className="rounded-lg bg-surface-muted p-3">
          <dt className="text-xs text-muted-foreground">Pending</dt>
          <dd className="tabular mt-1 font-medium">{pending}</dd>
        </div>
        <div className="rounded-lg bg-surface-muted p-3">
          <dt className="text-xs text-muted-foreground">Failed</dt>
          <dd className={cn("tabular mt-1 font-medium", failed && "text-critical")}>{failed}</dd>
        </div>
      </dl>
      <p className="text-muted-foreground">
        Pages you&apos;ve opened are saved for offline viewing. While offline you can change quantities and check off shopping items; those changes are
        stored on this device{durable ? "" : " (this browser blocks storage, so they won't survive closing the app)"} and sync automatically.
        Adding or editing items needs a connection.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void syncNow()} disabled={!online || syncing} loading={syncing}>
          Sync now
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            await clearCachedPages();
            toast.success("Saved pages cleared from this device");
          }}
        >
          Clear saved pages
        </Button>
      </div>
    </div>
  );
}

export function DangerZone({
  householdName,
  isOwner,
  userId,
  isLastOwner,
}: {
  householdName: string;
  isOwner: boolean;
  userId: string;
  isLastOwner: boolean;
}) {
  const router = useRouter();
  const [leaveOpen, setLeaveOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [confirmName, setConfirmName] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const leave = () =>
    startTransition(async () => {
      const result = await removeMemberAction(userId);
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.message);
      router.push("/");
      router.refresh();
    });
  const destroy = () =>
    startTransition(async () => {
      const result = await deleteHouseholdAction(confirmName);
      if (!result.ok) return void toast.error(result.error);
      await clearCachedPages();
      toast.success(result.message);
      router.push("/");
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Leave household</p>
          <p className="text-[13px] text-muted-foreground">
            {isLastOwner ? "You're the only owner. Make someone else an owner first." : "You'll lose access to its inventory."}
          </p>
        </div>
        <Button variant="destructive-soft" onClick={() => setLeaveOpen(true)} disabled={isLastOwner}>
          <LogOut /> Leave
        </Button>
      </div>
      {isOwner ? (
        <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Delete household</p>
            <p className="text-[13px] text-muted-foreground">Permanently deletes all items, locations, history and lists for everyone.</p>
          </div>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 /> Delete
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title={`Leave ${householdName}?`}
        description="You'll need a new invitation to rejoin."
        confirmLabel="Leave household"
        destructive
        pending={pending}
        onConfirm={leave}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o);
          if (!o) setConfirmName("");
        }}
        title={`Delete ${householdName}?`}
        description="This can't be undone. Type the household name to confirm."
        confirmLabel="Delete forever"
        destructive
        pending={pending || confirmName.trim() !== householdName}
        onConfirm={destroy}
      >
        <Input className="mt-4" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={householdName} aria-label="Household name" autoFocus />
      </ConfirmDialog>
    </div>
  );
}
