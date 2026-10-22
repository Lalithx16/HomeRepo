import * as React from "react";
import { cn } from "@/lib/utils";

export const fieldBase =
  "w-full rounded-lg border border-input bg-surface px-3 text-[15px] text-foreground shadow-card transition-colors placeholder:text-subtle-foreground hover:border-border-strong focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring/30 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-critical sm:text-sm";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, type = "text", ...props },
  ref,
) {
  return <input ref={ref} type={type} className={cn(fieldBase, "h-11 sm:h-10", className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(fieldBase, "min-h-20 resize-y py-2.5", className)} {...props} />;
  },
);

export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function NativeSelect({ className, children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(fieldBase, "h-11 cursor-pointer appearance-none pr-9 sm:h-10", className)}
          {...props}
        >
          {children}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  },
);
