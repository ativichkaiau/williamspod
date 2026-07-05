import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { BrandLockup } from "@/components/brand/williamspod-logo";

export const metadata = { title: "WilliamsPod — Driver sign-on" };

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-grid p-6">
      <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-50" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-signal/8 blur-3xl" />

      <div className="relative w-full max-w-md pop-in">
        <BrandLockup className="mb-8" />

        <div className="panel-deep p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="eyebrow">Driver sign-on</p>
              <h1 className="mt-1 display-lg text-foreground">
                Take the <span className="race-lean text-signal">wheel</span>
              </h1>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-muted">
              <span className="dot text-good" />
              <span>online</span>
            </div>
          </div>

          <Suspense>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.24em] text-muted">
          Wind tunnel before the race
        </p>
      </div>
    </div>
  );
}
