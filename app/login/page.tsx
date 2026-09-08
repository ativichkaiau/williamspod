import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { BrandLockup } from "@/components/brand/williamspod-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = { title: "WilliamsPod — Sign in" };

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <div aria-hidden="true" className="racing-stripes auth-stripes" />
      <ThemeToggle labeled className="absolute right-5 top-5 sm:right-8 sm:top-8" />

      <div className="relative w-full max-w-md pop-in">
        <BrandLockup className="mb-8" />

        <div className="panel-deep relative overflow-hidden p-6 sm:p-8">
          <div aria-hidden="true" className="track-hatch absolute inset-x-0 top-0 h-2" />
          <div className="mb-6">
            <div>
              <p className="eyebrow">Sign in</p>
              <h1 className="mt-1 display-lg text-foreground">
                Welcome <span className="race-lean text-signal">back</span>
              </h1>
            </div>
          </div>

          <Suspense>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Practice under exam conditions
        </p>
      </div>
    </main>
  );
}
