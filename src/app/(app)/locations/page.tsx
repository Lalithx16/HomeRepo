import { MapPin } from "lucide-react";
import { listLocations, toLocationNodes } from "@/lib/data/catalog";
import { requireContext } from "@/lib/data/context";
import { buildLocationTree } from "@/lib/domain/locations";
import { Card } from "@/components/ui/card";
import { LocationManager } from "@/components/locations/location-manager";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Locations" };

export default async function LocationsPage() {
  const ctx = await requireContext();
  const locations = await listLocations(ctx);
  const nodes = toLocationNodes(locations);
  const tree = buildLocationTree(nodes);
  const all = nodes.map((n) => ({ id: n.id, parentId: n.parentId, name: n.name, kind: n.kind }));

  return (
    <>
      <PageHeader title="Locations" description="Rooms, storage areas, shelves and containers. Nest them to match your home." />
      {tree.length === 0 ? (
        <>
          <EmptyState icon={MapPin} title="No locations yet" description="Create a room like “Kitchen”, then add the pantry, fridge and shelves inside it." />
          <div className="mt-4">
            <LocationManager tree={tree} all={all} canEdit={ctx.canEdit} />
          </div>
        </>
      ) : (
        <Card className="p-2 sm:p-3">
          <LocationManager tree={tree} all={all} canEdit={ctx.canEdit} />
        </Card>
      )}
    </>
  );
}
