"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ShieldAlert } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Authentication failed.");
        return;
      }
      router.replace(next);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Driver</Label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          autoComplete="username"
          required
          className="h-11"
          placeholder="e.g. ativich"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pw">Passphrase</Label>
        <Input
          id="pw"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="h-11 font-mono tracking-[0.2em]"
        />
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
        disabled={submitting || !name || !password}
      >
        {submitting ? "Checking pass…" : "Sign on"}
        <ArrowRight className="h-4 w-4" />
      </Button>
      <p className="pt-1 text-center text-[10px] uppercase tracking-[0.18em] text-muted">
        Hold a paddock pass?{" "}
        <Link
          href="/signup"
          className="text-signal hover:text-signal-strong"
        >
          Redeem it
        </Link>
      </p>
    </form>
  );
}
