import { cn } from "@/lib/utils";

/** Homebase mark: a rounded house outline with a shelf line. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex size-8 items-center justify-center rounded-[10px] bg-primary text-primary-foreground", className)}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
        <path d="M8 14.5h8" />
      </svg>
    </span>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {compact ? null : <span className="text-[16px] font-semibold tracking-tight">Homebase</span>}
    </span>
  );
}
