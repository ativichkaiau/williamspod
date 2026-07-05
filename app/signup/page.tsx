import { Suspense } from "react";
import { SignupForm } from "./signup-form";
import { BrandLockup } from "@/components/brand/williamspod-logo";

export const metadata = { title: "WilliamsPod — Paddock pass" };

export default function SignupPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-grid p-6">
      <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-50" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-signal/8 blur-3xl" />

      <div className="relative w-full max-w-md pop-in">
        <BrandLockup className="mb-8" />

        <div className="panel-deep p-8">
          <div className="mb-6">
            <p className="eyebrow">New driver</p>
            <h1 className="mt-1 display-lg text-foreground">
              Join the <span className="race-lean text-signal">team</span>
            </h1>
            <p className="mt-2 text-sm text-foreground-dim">
              A paddock pass from race control gets you in. Your stints, scores
              and weak-sector telemetry stay private to you.
            </p>
          </div>

          <Suspense>
            <SignupForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
