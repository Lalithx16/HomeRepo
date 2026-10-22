import {
  BarChart3,
  Boxes,
  CalendarClock,
  ChefHat,
  House,
  MapPin,
  PackageMinus,
  Settings,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";

export type NavBadgeKey = "expiring" | "restock" | "shopping";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: NavBadgeKey;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: House },
  { href: "/inventory", label: "All inventory", icon: Boxes },
  { href: "/locations", label: "Locations", icon: MapPin },
  { href: "/expiring", label: "Expiring soon", icon: CalendarClock, badge: "expiring" },
  { href: "/low-stock", label: "Low stock", icon: PackageMinus, badge: "restock" },
  { href: "/recipes", label: "Recipes", icon: ChefHat },
  { href: "/shopping", label: "Shopping list", icon: ShoppingCart, badge: "shopping" },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export const SETTINGS_NAV: NavItem = { href: "/settings", label: "Settings", icon: Settings };

export const MOBILE_TABS: NavItem[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/recipes", label: "Recipes", icon: ChefHat },
  { href: "/shopping", label: "Shopping", icon: ShoppingCart, badge: "shopping" },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
