import { redirect } from "next/navigation";
import { listBrands, listCategories, listIngredientKeys, listLocations } from "@/lib/data/catalog";
import { requireContext } from "@/lib/data/context";
import { ItemForm } from "@/components/inventory/item-form";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Add item" };

export default async function NewItemPage({ searchParams }: { searchParams: Promise<{ name?: string; location?: string }> }) {
  const [ctx, params] = await Promise.all([requireContext(), searchParams]);
  if (!ctx.canEdit) redirect("/inventory");
  const [categories, locations, brands, ingredientKeys] = await Promise.all([
    listCategories(ctx),
    listLocations(ctx),
    listBrands(ctx),
    listIngredientKeys(ctx),
  ]);
  const defaultLocation =
    (params.location && locations.find((l) => l.id === params.location)?.id) ??
    locations.find((l) => l.name.toLowerCase() === "pantry")?.id ??
    null;

  return (
    <>
      <PageHeader title="Add item" description="Only the name, quantity and location are required. Everything else is optional." className="mx-auto max-w-3xl" />
      <ItemForm
        mode="create"
        initial={{ name: params.name?.slice(0, 120) ?? "" }}
        categories={categories}
        locations={locations.map((l) => ({ id: l.id, parentId: l.parent_id, name: l.name, kind: l.kind }))}
        brands={brands.map((b) => b.name)}
        ingredientKeys={ingredientKeys}
        defaultLocationId={defaultLocation}
        currency={ctx.household.currency}
        today={ctx.today}
      />
    </>
  );
}
