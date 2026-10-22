import * as React from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string | string[];
  className?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

/** Label + control + hint/error with correct aria wiring. */
export function Field({ label, htmlFor, required, hint, error, className, children, action }: FieldProps) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex min-h-5 items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-foreground">
          {label}
          {required ? (
            <span className="ml-0.5 text-critical" aria-hidden>
              *
            </span>
          ) : (
            <span className="ml-1.5 font-normal text-muted-foreground">Optional</span>
          )}
          {required ? <span className="sr-only"> (required)</span> : null}
        </label>
        {action}
      </div>
      {children}
      {message ? (
        <p id={`${htmlFor}-error`} className="text-[13px] text-critical" role="alert">
          {message}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-[13px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Props to spread on an input inside <Field> for accessible errors. */
export function fieldA11y(id: string, error?: string | string[], hasHint = false) {
  const invalid = Boolean(error && (Array.isArray(error) ? error.length : true));
  return {
    id,
    "aria-invalid": invalid || undefined,
    "aria-describedby": invalid ? `${id}-error` : hasHint ? `${id}-hint` : undefined,
  };
}
