import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, LibraryBig, ChevronRight, FolderOpen } from "lucide-react";
import {
  loadBankLectures,
  subjectHref,
  subjectLabel,
  UNGROUPED_SUBJECT_LABEL,
} from "@/lib/bank";

export const dynamic = "force-dynamic";
export const metadata = { title: "Garage — WilliamsPod" };

export default async function BankPage() {
  const rows = await loadBankLectures();
  const total = rows.reduce((s, r) => s + Number(r.count ?? 0), 0);

  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = subjectLabel(r.subject);
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  const groupOrder = Array.from(groups.keys()).sort((a, b) => {
    if (a === UNGROUPED_SUBJECT_LABEL) return 1;
    if (b === UNGROUPED_SUBJECT_LABEL) return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="dot text-signal" />
            <p className="eyebrow">The garage</p>
          </div>
          <h1 className="mt-2 display-lg text-foreground">
            Garage <span className="race-lean text-signal">bays</span>
          </h1>
          <p className="mt-2 text-sm text-foreground-dim">
            <span className="digit text-foreground">{groupOrder.length}</span>{" "}
            subject{groupOrder.length === 1 ? "" : "s"} ·{" "}
            <span className="digit text-foreground">{rows.length}</span> lecture
            {rows.length === 1 ? "" : "s"} ·{" "}
            <span className="digit text-foreground">{total}</span> question
            {total === 1 ? "" : "s"}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/upload">
            <Upload className="h-4 w-4" />
            Deliver parts
          </Link>
        </Button>
      </header>

      {rows.length === 0 ? (
        <div className="panel bg-grid flex flex-col items-center gap-3 py-14 text-center">
          <LibraryBig className="h-8 w-8 text-muted" />
          <p className="text-sm text-muted">
            Empty bays — no subjects in the garage yet.
          </p>
          <Button asChild variant="signal" className="mt-2">
            <Link href="/upload">
              <Upload className="h-4 w-4" />
              Deliver parts
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="panel divide-y divide-border overflow-hidden">
          {groupOrder.map((subject, index) => {
            const items = groups.get(subject)!;
            const subTotal = items.reduce(
              (s, r) => s + Number(r.count ?? 0),
              0,
            );
            return (
              <li key={subject}>
                <Link
                  href={subjectHref(
                    subject === UNGROUPED_SUBJECT_LABEL ? null : subject,
                  )}
                  className="group flex min-h-20 items-center gap-3 px-4 py-4 transition-colors hover:bg-surface-2 sm:gap-4 sm:px-5"
                >
                  <span className="digit w-7 shrink-0 text-xs text-muted sm:w-8">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-2 text-signal shadow-[var(--clay-chip)]">
                    <FolderOpen className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-bold text-foreground">
                      {subject}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                      {items.length} lecture{items.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <Badge tone="neutral" className="shrink-0 whitespace-nowrap">
                    {subTotal} Q
                  </Badge>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
