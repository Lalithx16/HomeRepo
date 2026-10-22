import { notFound, redirect } from "next/navigation";
import { listBrands, listCategories, listIngredientKeys, listLocations } from "@/lib/data/catalog";
import { requireContext } from "@/lib/data/context";
import { getProduct, getProductLots, signImageUrls } from "@/lib/data/inventory";
import { ItemForm } from "@/components/inventory/item-form";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Edit item" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, ctx] = await Promise.all([params, requireContext()]);
  if (!UUID.test(id)) notFound();
  if (!ctx.canEdit) redirect(`/inventory/${id}`);
  const product = await getProduct(ctx, id);
  if (!product) notFound();
  const [categories, locations, brands, ingredientKeys, lots, images] = await Promise.all([
    listCategories(ctx),
    listLocations(ctx),
    listBrands(ctx),
    listIngredientKeys(ctx),
    getProductLots(ctx, id),
    signImageUrls(ctx, [product.image_path]),
  ]);

  return (
    <>
      <PageHeader title={`Edit ${product.name}`} className="mx-auto max-w-3xl" />
      <ItemForm
        mode="edit"
        initial={{
          productId: product.id,
          version: product.version,
          name: product.name,
          brand: product.brand_name,
          categoryId: product.category_id,
          unit: product.default_unit,
          minQuantity: product.min_quantity,
          targetQuantity: product.target_quantity,
          ingredientKey: product.ingredient_key,
          notes: product.notes,
          imageUrl: product.image_path ? images[product.image_path] ?? null : null,
          lockedToUnit: lots.length > 0 ? product.default_unit : null,
        }}
        categories={categories}
        locations={locations.map((l) => ({ id: l.id, parentId: l.parent_id, name: l.name, kind: l.kind }))}
        brands={brands.map((b) => b.name)}
        ingredientKeys={ingredientKeys}
        currency={ctx.household.currency}
        today={ctx.today}
      />
    </>
  );
}
