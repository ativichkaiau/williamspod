import { Suspense } from "react";
import { SignupForm } from "./signup-form";
import { BrandLockup } from "@/components/brand/williamspod-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = { title: "WilliamsPod — Sign up" };

export default function SignupPage() {
  return (
    <main className="auth-shell">
      <div aria-hidden="true" className="racing-stripes auth-stripes" />
      <ThemeToggle labeled className="absolute right-5 top-5 sm:right-8 sm:top-8" />

      <div className="relative w-full max-w-md pop-in">
        <BrandLockup className="mb-8" />

        <div className="panel-deep relative overflow-hidden p-6 sm:p-8">
          <div aria-hidden="true" className="track-hatch absolute inset-x-0 top-0 h-2" />
          <div className="mb-6">
            <p className="eyebrow">New account</p>
            <h1 className="mt-1 display-lg text-foreground">
              Create your <span className="race-lean text-signal">account</span>
            </h1>
            <p className="mt-2 text-sm text-foreground-dim">
              An invite code from an admin gets you in. Your tests, scores and
              weak-area analytics stay private to you.
            </p>
          </div>

          <Suspense>
            <SignupForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
