import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "WilliamsPod — Auth" };

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-grid p-6">
      <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-50" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-signal/8 blur-3xl" />

      <div className="relative w-full max-w-md pop-in">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-signal/40 bg-signal/8 text-signal shadow-[inset_0_1px_0_0_rgba(45,212,241,0.25),0_0_24px_-4px_rgba(45,212,241,0.6)]">
            <span className="font-mono text-xs font-bold tracking-[0.2em]">WP</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-foreground">
              Williams<span className="text-signal">Pod</span>
            </span>
            <span className="mt-0.5 text-[9px] uppercase tracking-[0.24em] text-muted">
              authorization required
            </span>
          </div>
        </div>

        <div className="panel-deep p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="eyebrow">Pre-flight check</p>
              <h1 className="mt-1 display-lg text-foreground">
                Enter the pod
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
