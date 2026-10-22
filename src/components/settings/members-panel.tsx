"use client";

import { Copy, Mail, UserMinus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";
import { inviteMemberAction, removeMemberAction, revokeInvitationAction, updateMemberRoleAction } from "@/lib/actions/household";
import { formatRelativeTime } from "@/lib/domain/format";
import type { HouseholdRole, InvitationRow, MemberRow } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { initialsOf } from "@/components/layout/user-menu";

const ROLE_HELP: Record<HouseholdRole, string> = {
  owner: "Full control, including members and settings",
  editor: "Can add, change and use items",
  viewer: "Can look but not change inventory",
};

export function MembersPanel({
  members,
  invitations,
  currentUserId,
  isOwner,
}: {
  members: MemberRow[];
  invitations: InvitationRow[];
  currentUserId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"editor" | "viewer">("editor");
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState<MemberRow | null>(null);

  const run = <T,>(fn: () => Promise<ActionResult<T>>, onOk?: (data: T) => void) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      setErrors({});
      if (result.message) toast.success(result.message);
      onOk?.(result.data);
      router.refresh();
    });

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invitation link copied");
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <ul className="divide-y divide-border rounded-xl border border-border">
        {members.map((m) => {
          const self = m.user_id === currentUserId;
          return (
            <li key={m.user_id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground">
                  {initialsOf(m.profile?.display_name ?? null, m.profile?.email ?? null)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {m.profile?.display_name || m.profile?.email || "Member"} {self ? <span className="text-muted-foreground">(you)</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{m.profile?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isOwner && !self ? (
                  <>
                    <label htmlFor={`role-${m.user_id}`} className="sr-only">
                      Role for {m.profile?.email}
                    </label>
                    <NativeSelect
                      id={`role-${m.user_id}`}
                      value={m.role}
                      disabled={pending}
                      onChange={(e) => run(() => updateMemberRoleAction({ userId: m.user_id, role: e.target.value }))}
                      className="h-10 w-32 text-sm sm:h-9"
                    >
                      <option value="owner">Owner</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </NativeSelect>
                    <Button variant="ghost" size="icon-sm" aria-label={`Remove ${m.profile?.email ?? "member"}`} onClick={() => setRemoving(m)}>
                      <UserMinus />
                    </Button>
                  </>
                ) : (
                  <Badge tone={m.role === "owner" ? "primary" : "neutral"} title={ROLE_HELP[m.role]}>
                    {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                  </Badge>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {isOwner ? (
        <div className="rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold">Invite someone</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Creates a private link valid for 7 days. Send it yourself — it only works for the email address you enter.
          </p>
          <form
            className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              run(() => inviteMemberAction({ email, role }), (data) => {
                setInviteUrl(data.url);
                setEmail("");
              });
            }}
          >
            <Field label="Email" htmlFor="invite-email" required error={errors.email} className="flex-1">
              <Input {...fieldA11y("invite-email", errors.email)} type="email" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" autoComplete="off" />
            </Field>
            <Field label="Role" htmlFor="invite-role" required>
              <NativeSelect id="invite-role" value={role} onChange={(e) => setRole(e.target.value as "editor" | "viewer")}>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </NativeSelect>
            </Field>
            <Button type="submit" loading={pending}>
              {pending ? null : <Mail />} Create invite
            </Button>
          </form>
          {inviteUrl ? (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary-soft p-2 pl-3">
              <code className="min-w-0 flex-1 truncate text-xs text-primary-soft-foreground">{inviteUrl}</code>
              <Button size="sm" variant="secondary" onClick={() => void copy(inviteUrl)}>
                <Copy /> Copy
              </Button>
            </div>
          ) : null}
          {invitations.length ? (
            <ul className="mt-4 divide-y divide-border border-t border-border">
              {invitations.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.role} · sent {formatRelativeTime(inv.created_at)}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => run(() => revokeInvitationAction(inv.id))} disabled={pending}>
                    <X /> Revoke
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove member?"
        description={`${removing?.profile?.email ?? "This person"} will immediately lose access to this household.`}
        confirmLabel="Remove"
        destructive
        pending={pending}
        onConfirm={() => removing && run(() => removeMemberAction(removing.user_id), () => setRemoving(null))}
      />
    </div>
  );
}
