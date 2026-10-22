import {
  Apple,
  Archive,
  Bean,
  Beef,
  Box,
  CakeSlice,
  Carrot,
  ChefHat,
  Citrus,
  Coffee,
  Cookie,
  CookingPot,
  Croissant,
  CupSoda,
  DoorOpen,
  Droplet,
  Egg,
  Fish,
  Inbox,
  Layers,
  Leaf,
  MapPin,
  Milk,
  Package,
  Pill,
  Pizza,
  Refrigerator,
  Salad,
  Sandwich,
  Snowflake,
  Soup,
  Sparkles,
  SprayCan,
  Utensils,
  Warehouse,
  Wheat,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Icon names stored in categories.icon / recipes.icon (kebab-case). */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  apple: Apple,
  archive: Archive,
  bean: Bean,
  beef: Beef,
  "cake-slice": CakeSlice,
  carrot: Carrot,
  "chef-hat": ChefHat,
  citrus: Citrus,
  coffee: Coffee,
  cookie: Cookie,
  "cooking-pot": CookingPot,
  croissant: Croissant,
  "cup-soda": CupSoda,
  droplet: Droplet,
  egg: Egg,
  fish: Fish,
  leaf: Leaf,
  milk: Milk,
  package: Package,
  pill: Pill,
  pizza: Pizza,
  salad: Salad,
  sandwich: Sandwich,
  snowflake: Snowflake,
  soup: Soup,
  sparkles: Sparkles,
  "spray-can": SprayCan,
  utensils: Utensils,
  wheat: Wheat,
  wine: Wine,
};

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS);

export function CategoryIcon({ icon, className }: { icon: string | null | undefined; className?: string }) {
  const Icon = (icon && CATEGORY_ICONS[icon]) || Package;
  return <Icon className={className} aria-hidden />;
}

/** Soft, tinted tile used as the image placeholder for items and recipes. */
export function IconTile({
  icon,
  size = "md",
  className,
}: {
  icon: string | null | undefined;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground",
        size === "sm" && "size-9 [&_svg]:size-4",
        size === "md" && "size-11 [&_svg]:size-5",
        size === "lg" && "size-14 rounded-xl [&_svg]:size-6",
        size === "xl" && "size-full rounded-xl [&_svg]:size-10",
        className,
      )}
    >
      <CategoryIcon icon={icon} />
    </div>
  );
}

export function locationIconFor(kind: string, name = ""): LucideIcon {
  const n = name.toLowerCase();
  if (n.includes("fridge") || n.includes("refrigerator")) return Refrigerator;
  if (n.includes("freezer")) return Snowflake;
  if (n.includes("pantry")) return Warehouse;
  switch (kind) {
    case "room":
      return DoorOpen;
    case "storage":
      return Archive;
    case "shelf":
      return Layers;
    case "drawer":
      return Inbox;
    case "container":
      return Box;
    default:
      return MapPin;
  }
}

export function LocationIcon({ kind, name, className }: { kind: string; name?: string; className?: string }) {
  const Icon = locationIconFor(kind, name);
  return <Icon className={className} aria-hidden />;
}
