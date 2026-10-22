import { listCategories } from "@/lib/data/catalog";
import { requireContext } from "@/lib/data/context";
import { listInvitations, listMembers } from "@/lib/data/members";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { CategoriesPanel } from "@/components/settings/categories-panel";
import { HouseholdSettingsForm } from "@/components/settings/household-settings-form";
import { LoadSampleButton } from "@/components/settings/load-sample-button";
import { MembersPanel } from "@/components/settings/members-panel";
import { DangerZone, OfflinePanel, ProfileForm, ThemeSelector } from "@/components/settings/misc-panels";

export const metadata = { title: "Settings" };

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-20">
      <CardHeader title={title} description={description} />
      <div className="p-4 sm:p-5">{children}</div>
    </Card>
  );
}

export default async function SettingsPage() {
  const ctx = await requireContext();
  const [members, invitations, categories] = await Promise.all([listMembers(ctx), listInvitations(ctx), listCategories(ctx)]);
  const isOwner = ctx.role === "owner";
  const owners = members.filter((m) => m.role === "owner").length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title="Settings" description={`${ctx.household.name} · you're ${ctx.role === "owner" ? "an owner" : `an ${ctx.role}`}`} />
      <Section id="household" title="Household" description="Applies to everyone in this household.">
        <HouseholdSettingsForm household={ctx.household} canEdit={isOwner} />
      </Section>
      <Section id="members" title="Members" description="Share your inventory with the people you live with.">
        <MembersPanel members={members} invitations={invitations} currentUserId={ctx.user.id} isOwner={isOwner} />
      </Section>
      <Section id="categories" title="Categories" description="Store sections group your shopping list.">
        <CategoriesPanel categories={categories} canEdit={ctx.canEdit} />
      </Section>
      <Section id="profile" title="Profile">
        <ProfileForm displayName={ctx.displayName} email={ctx.user.email} />
      </Section>
      <Section id="appearance" title="Appearance">
        <ThemeSelector />
      </Section>
      <Section id="offline" title="Offline & sync">
        <OfflinePanel />
      </Section>
      {ctx.canEdit ? (
        <Section id="sample" title="Sample data" description="Optional. Adds about 24 common kitchen items (some low or expiring) so you can explore. Skips items you already have.">
          <LoadSampleButton />
        </Section>
      ) : null}
      <Section id="danger" title="Danger zone">
        <DangerZone householdName={ctx.household.name} isOwner={isOwner} userId={ctx.user.id} isLastOwner={isOwner && owners <= 1} />
      </Section>
    </div>
  );
}
