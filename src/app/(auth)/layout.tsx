import { Logo } from "@/components/shared/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10 pt-safe">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8">{children}</div>
        <p className="mt-6 text-center text-xs text-muted-foreground">Your household data is private to its members.</p>
      </div>
    </main>
  );
}
