"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ShieldAlert, CheckCircle2 } from "lucide-react";

type CheckState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok" }
  | { kind: "error"; reason: string };

export function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const presetCode = params.get("code") ?? "";

  const [code, setCode] = useState(presetCode);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [check, setCheck] = useState<CheckState>({ kind: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live-validate code.
  useEffect(() => {
    const clean = code.trim().toUpperCase();
    let checkingTimer: ReturnType<typeof setTimeout> | null = null;
    if (clean.length < 4) {
      const idleTimer = setTimeout(() => setCheck({ kind: "idle" }), 0);
      return () => clearTimeout(idleTimer);
    }
    checkingTimer = setTimeout(() => setCheck({ kind: "checking" }), 0);
    const validateTimer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/auth/check-invite?code=${encodeURIComponent(clean)}`,
        );
        const j = (await res.json()) as { status: string };
        if (j.status === "valid") setCheck({ kind: "ok" });
        else setCheck({ kind: "error", reason: j.status });
      } catch {
        setCheck({ kind: "error", reason: "network" });
      }
    }, 350);
    return () => {
      if (checkingTimer) clearTimeout(checkingTimer);
      clearTimeout(validateTimer);
    };
  }, [code]);

  const passwordsMatch = password.length > 0 && password === confirm;
  const passwordsLongEnough = password.length >= 6;
  const canSubmit =
    !submitting &&
    check.kind === "ok" &&
    name.trim().length >= 2 &&
    passwordsLongEnough &&
    passwordsMatch;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          password,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Signup failed.");
        return;
      }
      router.replace("/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="code">Invite code</Label>
        <div className="relative">
          <Input
            id="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoComplete="off"
            autoCapitalize="characters"
            required
            placeholder="XXXX-XXXX"
            className="h-11 pr-9 font-mono tracking-[0.18em]"
          />
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            {check.kind === "checking" && (
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                …
              </span>
            )}
            {check.kind === "ok" && <CheckCircle2 className="h-4 w-4 text-good" />}
            {check.kind === "error" && (
              <ShieldAlert className="h-4 w-4 text-bad" />
            )}
          </div>
        </div>
        {check.kind === "error" && (
          <p className="text-[10px] uppercase tracking-[0.14em] text-bad">
            Pass {check.reason === "network" ? "could not be verified" : check.reason}.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="username"
          required
          minLength={2}
          maxLength={40}
          className="h-11"
          placeholder="What your friends call you"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="pw">Choose a passphrase</Label>
        <Input
          id="pw"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={6}
          className="h-11 font-mono tracking-[0.2em]"
        />
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
          ≥ 6 characters. You can&apos;t reset it without admin help.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pw2">Confirm passphrase</Label>
        <Input
          id="pw2"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
          minLength={6}
          className="h-11 font-mono tracking-[0.2em]"
        />
        {confirm && !passwordsMatch && (
          <p className="text-[10px] uppercase tracking-[0.14em] text-bad">
            Doesn&apos;t match.
          </p>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-bad/40 bg-bad-soft p-3 text-xs">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 text-bad" />
          <p className="uppercase tracking-[0.14em] text-bad">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        variant="signal"
        size="lg"
        className="w-full"
        disabled={!canSubmit}
      >
        {submitting ? "Creating account…" : "Create account"}
        <ArrowRight className="h-4 w-4" />
      </Button>

      <p className="text-center text-[10px] uppercase tracking-[0.18em] text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-signal hover:text-signal-strong">
          Sign on
        </Link>
      </p>
    </form>
  );
}
