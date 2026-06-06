"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Shield,
  Plus,
  Copy,
  Check,
  Archive,
  ArchiveRestore,
  ArrowUpCircle,
  ArrowDownCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type UserRow = {
  id: string;
  name: string;
  role: "admin" | "member";
  archived: boolean;
  attemptCount: number;
  createdAt: string;
  lastSeenAt: string | null;
};

type InviteRow = {
  id: string;
  code: string;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  revokedAt: string | null;
  status: "valid" | "used" | "revoked" | "expired";
};

export function AdminTools({
  adminId,
  users,
  invites,
}: {
  adminId: string;
  users: UserRow[];
  invites: InviteRow[];
}) {
  const router = useRouter();
  const totalRunners = users.filter((u) => !u.archived).length;
  const activeInvites = invites.filter((i) => i.status === "valid").length;

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-2">
          <span className="dot text-signal pod-pulse" />
          <p className="eyebrow">Operator console</p>
        </div>
        <h1 className="mt-2 display-lg text-foreground">Admin</h1>
        <p className="mt-2 text-sm text-foreground-dim">
          Generate invite codes, manage runners. Bank is shared; scores are private.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Active runners" value={String(totalRunners)} />
        <Stat label="Pending invites" value={String(activeInvites)} />
        <Stat
          label="Lifetime users"
          value={String(users.length)}
          tone={users.length > 0 ? undefined : "warn"}
        />
      </section>

      <InviteSection
        invites={invites}
        onChanged={() => router.refresh()}
      />

      <UserSection
        users={users}
        adminId={adminId}
        onChanged={() => router.refresh()}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

function InviteSection({
  invites,
  onChanged,
}: {
  invites: InviteRow[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [expiresDays, setExpiresDays] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signupUrl = useMemo(() => {
    if (!createdCode || typeof window === "undefined") return "";
    return `${window.location.origin}/signup?code=${encodeURIComponent(createdCode)}`;
  }, [createdCode]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (note.trim()) body.note = note.trim();
      const n = Number(expiresDays);
      if (Number.isFinite(n) && n > 0) body.expiresInDays = n;
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not generate invite.");
        return;
      }
      setCreatedCode(json.code);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!signupUrl) return;
    try {
      await navigator.clipboard.writeText(signupUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this invite? Anyone holding the code won't be able to use it.")) {
      return;
    }
    const res = await fetch(`/api/admin/invites/${id}`, { method: "DELETE" });
    if (res.ok) onChanged();
  }

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-signal" />
          <p className="eyebrow">Invites</p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            if (!o) {
              setNote("");
              setExpiresDays("");
              setCreatedCode(null);
              setCopied(false);
              setError(null);
            }
            setOpen(o);
          }}
        >
          <DialogTrigger asChild>
            <Button variant="signal" size="sm">
              <Plus className="h-3.5 w-3.5" />
              New invite
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate invite</DialogTitle>
              <DialogDescription>
                Hand the link or code to a friend. Single-use.
              </DialogDescription>
            </DialogHeader>

            {!createdCode ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Note (optional)</Label>
                  <Input
                    value={note}
                    maxLength={120}
                    placeholder='e.g. "for Aaron"'
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expires in days (optional)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={expiresDays}
                    placeholder="never"
                    onChange={(e) => setExpiresDays(e.target.value)}
                  />
                </div>
                {error && (
                  <p className="rounded-md border border-bad/40 bg-bad-soft p-3 text-xs text-bad">
                    {error}
                  </p>
                )}
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setOpen(false)}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                  <Button variant="signal" onClick={generate} disabled={busy}>
                    {busy ? "Generating…" : "Generate"}
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4 pop-in">
                <div>
                  <Label>Invite code</Label>
                  <div className="mt-1.5 rounded-md border border-signal/40 bg-signal-soft p-4 text-center">
                    <p className="digit text-3xl text-signal tracking-[0.18em]">
                      {createdCode}
                    </p>
                  </div>
                </div>
                <div>
                  <Label>Share link</Label>
                  <div className="mt-1.5 flex gap-2">
                    <Input
                      readOnly
                      value={signupUrl}
                      className="font-mono text-xs"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <Button variant="signal" onClick={copy} className="shrink-0">
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setOpen(false);
                    }}
                  >
                    Done
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {invites.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted">
          No invites yet. Generate one to add a friend.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {invites.map((i) => (
            <li
              key={i.id}
              className="flex items-center gap-4 px-5 py-3"
            >
              <div className="font-mono text-sm tabular tracking-[0.18em] text-foreground">
                {i.code}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {i.note && <span className="font-semibold text-foreground-dim">{i.note}</span>}
                  <InviteBadge status={i.status} />
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-muted">
                  Created {new Date(i.createdAt).toLocaleDateString()}
                  {i.expiresAt &&
                    ` · expires ${new Date(i.expiresAt).toLocaleDateString()}`}
                  {i.usedAt &&
                    ` · used ${new Date(i.usedAt).toLocaleDateString()}`}
                </div>
              </div>
              {i.status === "valid" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => revoke(i.id)}
                  className="hover:text-bad"
                  title="Revoke"
                  aria-label="Revoke invite"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function InviteBadge({ status }: { status: InviteRow["status"] }) {
  switch (status) {
    case "valid":
      return <Badge tone="good">valid</Badge>;
    case "used":
      return <Badge tone="neutral">used</Badge>;
    case "revoked":
      return <Badge tone="bad">revoked</Badge>;
    case "expired":
      return <Badge tone="warn">expired</Badge>;
  }
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

function UserSection({
  users,
  adminId,
  onChanged,
}: {
  users: UserRow[];
  adminId: string;
  onChanged: () => void;
}) {
  async function doAction(
    userId: string,
    action: "archive" | "unarchive" | "promote" | "demote",
    confirmText: string,
  ) {
    if (!confirm(confirmText)) return;
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) onChanged();
  }

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <p className="eyebrow">Runners</p>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          {users.length} total
        </span>
      </div>
      <ul className="divide-y divide-border">
        {users.map((u) => {
          const initial = u.name.charAt(0).toUpperCase();
          const self = u.id === adminId;
          return (
            <li
              key={u.id}
              className={cn(
                "flex items-center gap-4 px-5 py-3",
                u.archived && "opacity-50",
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-2 text-sm font-semibold text-foreground">
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-bold text-foreground">{u.name}</span>
                  {u.role === "admin" ? (
                    <Badge tone="signal">admin</Badge>
                  ) : (
                    <Badge tone="neutral">member</Badge>
                  )}
                  {u.archived && <Badge tone="bad">archived</Badge>}
                  {self && <Badge tone="warn">you</Badge>}
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-muted">
                  <span className="digit text-foreground-dim">{u.attemptCount}</span>{" "}
                  run{u.attemptCount === 1 ? "" : "s"}
                  {" · "}
                  joined {new Date(u.createdAt).toLocaleDateString()}
                  {u.lastSeenAt &&
                    ` · last seen ${new Date(u.lastSeenAt).toLocaleDateString()}`}
                </div>
              </div>
              {!self && (
                <div className="flex shrink-0 items-center gap-1">
                  {u.role === "admin" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Demote to member"
                      aria-label={`Demote ${u.name}`}
                      onClick={() =>
                        doAction(
                          u.id,
                          "demote",
                          `Demote ${u.name} from admin to member?`,
                        )
                      }
                    >
                      <ArrowDownCircle className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Promote to admin"
                      aria-label={`Promote ${u.name}`}
                      onClick={() =>
                        doAction(
                          u.id,
                          "promote",
                          `Promote ${u.name} to admin? They'll be able to edit the bank and manage users.`,
                        )
                      }
                    >
                      <ArrowUpCircle className="h-4 w-4" />
                    </Button>
                  )}
                  {u.archived ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Reactivate"
                      aria-label={`Reactivate ${u.name}`}
                      onClick={() =>
                        doAction(
                          u.id,
                          "unarchive",
                          `Reactivate ${u.name}? They'll be able to log in again.`,
                        )
                      }
                    >
                      <ArchiveRestore className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Archive"
                      aria-label={`Archive ${u.name}`}
                      className="hover:text-bad"
                      onClick={() =>
                        doAction(
                          u.id,
                          "archive",
                          `Archive ${u.name}? Their data stays but they can't log in.`,
                        )
                      }
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Stat tile
// ---------------------------------------------------------------------------

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn" | "bad" | "good";
}) {
  const color =
    tone === "warn"
      ? "text-warn"
      : tone === "bad"
        ? "text-bad"
        : tone === "good"
          ? "text-good"
          : "text-foreground";
  return (
    <div className="panel-flat p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      <div className={`mt-1 digit text-2xl ${color}`}>{value}</div>
    </div>
  );
}
