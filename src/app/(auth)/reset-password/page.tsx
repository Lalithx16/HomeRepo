import { ResetPasswordForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">You&apos;ll stay signed in on this device.</p>
      <ResetPasswordForm />
    </>
  );
}
