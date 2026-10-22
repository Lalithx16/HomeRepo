import { cn } from "@/lib/utils";
import { IconTile } from "@/components/shared/icons";

/** Item photo (signed URL) or a tasteful category placeholder. */
export function ProductImage({
  src,
  icon,
  alt,
  size = "md",
  className,
}: {
  src?: string | null;
  icon: string | null;
  alt: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  if (!src) return <IconTile icon={icon} size={size} className={className} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cn(
        "shrink-0 rounded-lg bg-surface-muted object-cover",
        size === "sm" && "size-9",
        size === "md" && "size-11",
        size === "lg" && "size-14 rounded-xl",
        size === "xl" && "size-full rounded-xl",
        className,
      )}
    />
  );
}
