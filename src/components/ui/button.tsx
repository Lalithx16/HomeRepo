import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[background-color,color,border-color,box-shadow,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-card hover:bg-primary-hover",
        secondary: "border border-border bg-surface text-foreground shadow-card hover:bg-surface-hover",
        soft: "bg-primary-soft text-primary-soft-foreground hover:brightness-[0.97] dark:hover:brightness-110",
        ghost: "text-foreground hover:bg-surface-muted",
        destructive: "bg-critical text-white hover:brightness-95 dark:text-[#1b0d0c]",
        "destructive-soft": "bg-critical-soft text-critical hover:brightness-[0.97] dark:hover:brightness-110",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        sm: "h-10 px-3 sm:h-8 sm:px-2.5 sm:text-[13px]",
        md: "h-11 px-4 sm:h-9 sm:px-3.5",
        lg: "h-12 px-5 text-[15px] sm:h-11",
        icon: "size-11 sm:size-9",
        "icon-sm": "size-10 sm:size-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, loading = false, disabled, children, type, ...props },
  ref,
) {
  if (asChild) {
    return (
      <Slot ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
        {children}
      </Slot>
    );
  }
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});
