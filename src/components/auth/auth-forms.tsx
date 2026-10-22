"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";
import {
  requestPasswordResetAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Errors = Record<string, string[] | undefined>;

function useAuthForm<T>(action: (input: Record<string, string>) => Promise<ActionResult<T>>) {
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Errors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ActionResult<T> | null>(null);

  const submit = (event: React.FormEvent<HTMLFormElement>, extra: Record<string, string> = {}) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      try {
        const res = await action({ ...data, ...extra });
        setResult(res ?? null);
        if (res && !res.ok) {
          setErrors(res.fieldErrors ?? {});
          if (!res.fieldErrors) setFormError(res.error);
        }
      } catch (error) {
        // redirect() throws a special error that Next handles; anything else is a real failure.
        if (error && typeof error === "object" && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) {
          throw error;
        }
        setFormError(navigator.onLine ? "Something went wrong. Please try again." : "You're offline. Connect to sign in.");
      }
    });
  };
  return { pending, errors, formError, result, submit };
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-critical-soft px-3 py-2.5 text-sm text-critical">
      {message}
    </p>
  );
}

export function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const { pending, errors, formError, submit } = useAuthForm(signInAction);
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => submit(e, { next: next ?? "/" })} noValidate>
      {linkError ? <FormError message="That link is invalid or has expired. Please try again." /> : null}
      <FormError message={formError} />
      <Field label="Email" htmlFor="email" required error={errors.email}>
        <Input {...fieldA11y("email", errors.email)} name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        required
        error={errors.password}
        action={
          <Link href="/forgot-password" className="text-[13px] font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        }
      >
        <Input {...fieldA11y("password", errors.password)} name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
        Sign in
      </Button>
    </form>
  );
}

export function SignupForm() {
  const { pending, errors, formError, result, submit } = useAuthForm(signUpAction);
  if (result?.ok) {
    return (
      <div className="rounded-xl bg-primary-soft px-4 py-5 text-center text-sm text-primary-soft-foreground" role="status">
        <p className="font-medium">Check your inbox</p>
        <p className="mt-1">We sent you a link to confirm your email. Open it on this device to continue.</p>
      </div>
    );
  }
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => submit(e)} noValidate>
      <FormError message={formError} />
      <Field label="Your name" htmlFor="displayName" error={errors.displayName}>
        <Input {...fieldA11y("displayName", errors.displayName)} name="displayName" autoComplete="name" />
      </Field>
      <Field label="Email" htmlFor="email" required error={errors.email}>
        <Input {...fieldA11y("email", errors.email)} name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Field label="Password" htmlFor="password" required error={errors.password} hint="At least 8 characters, with a letter and a number.">
        <Input {...fieldA11y("password", errors.password, true)} name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
        Create account
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const { pending, errors, formError, result, submit } = useAuthForm(requestPasswordResetAction);
  if (result?.ok) {
    return (
      <p className="rounded-xl bg-primary-soft px-4 py-4 text-center text-sm text-primary-soft-foreground" role="status">
        {result.message}
      </p>
    );
  }
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => submit(e)} noValidate>
      <FormError message={formError} />
      <Field label="Email" htmlFor="email" required error={errors.email}>
        <Input {...fieldA11y("email", errors.email)} name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Button type="submit" size="lg" loading={pending} className="w-full">
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const { pending, errors, formError, result, submit } = useAuthForm(updatePasswordAction);
  React.useEffect(() => {
    if (result?.ok) {
      toast.success("Password updated");
      router.push("/");
    }
  }, [result, router]);
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => submit(e)} noValidate>
      <FormError message={formError} />
      <Field label="New password" htmlFor="password" required error={errors.password} hint="At least 8 characters, with a letter and a number.">
        <Input {...fieldA11y("password", errors.password, true)} name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" required error={errors.confirm}>
        <Input {...fieldA11y("confirm", errors.confirm)} name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" size="lg" loading={pending} className="w-full">
        Update password
      </Button>
    </form>
  );
}
