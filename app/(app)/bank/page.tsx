import Link from "next/link";
import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { lectures, questions } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, BookOpen, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bank — WilliamsPod" };

async function loadLectures() {
  const rows = await db
    .select({
      id: lectures.id,
      name: lectures.name,
      slug: lectures.slug,
      subject: lectures.subject,
      orderIndex: lectures.orderIndex,
      updatedAt: lectures.updatedAt,
      count: count(questions.id),
    })
    .from(lectures)
    .leftJoin(
      questions,
      and(eq(questions.lectureId, lectures.id), isNull(questions.archivedAt)),
    )
    .where(isNull(lectures.archivedAt))
    .groupBy(lectures.id)
    .orderBy(lectures.orderIndex, lectures.name);
  return rows;
}

const UNGROUPED = "Other";

function ltNumber(name: string): number {
  const m = name.match(/^LT(\d+)/);
  return m ? Number(m[1]) : 9999;
}

export default async function BankPage() {
  const rows = await loadLectures();
  const total = rows.reduce((s, r) => s + Number(r.count ?? 0), 0);

  // Group by subject.
  const groups = new Map<
    string,
    typeof rows
  >();
  for (const r of rows) {
    const key = r.subject?.trim() || UNGROUPED;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  // Sort lectures within a group by LT number, then name.
  for (const arr of groups.values()) {
    arr.sort((a, b) => {
      const an = ltNumber(a.name);
      const bn = ltNumber(b.name);
      if (an !== bn) return an - bn;
      return a.name.localeCompare(b.name);
    });
  }

  // Subject order: alphabetical, but "Other" last.
  const groupOrder = Array.from(groups.keys()).sort((a, b) => {
    if (a === UNGROUPED) return 1;
    if (b === UNGROUPED) return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="dot text-signal" />
            <p className="eyebrow">Question bank</p>
          </div>
          <h1 className="mt-2 display-lg text-foreground">Lectures</h1>
          <p className="mt-2 text-sm text-foreground-dim">
            <span className="digit text-foreground">{rows.length}</span> lecture
            {rows.length === 1 ? "" : "s"} ·{" "}
            <span className="digit text-foreground">{total}</span> question
            {total === 1 ? "" : "s"} loaded · grouped into{" "}
            <span className="digit text-foreground">{groupOrder.length}</span>{" "}
            subject{groupOrder.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/upload">
            <Upload className="h-4 w-4" />
            Load more
          </Link>
        </Button>
      </header>

      {rows.length === 0 ? (
        <div className="panel bg-grid flex flex-col items-center gap-3 py-14 text-center">
          <BookOpen className="h-8 w-8 text-muted" />
          <p className="text-sm text-muted">No lectures yet.</p>
          <Button asChild variant="signal" className="mt-2">
            <Link href="/upload">
              <Upload className="h-4 w-4" />
              Upload Excel
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupOrder.map((subject) => {
            const items = groups.get(subject)!;
            const subTotal = items.reduce(
              (s, r) => s + Number(r.count ?? 0),
              0,
            );
            return (
              <section key={subject} className="space-y-2.5">
                <div className="flex items-baseline justify-between border-b border-border/70 pb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`dot ${
                        subject === UNGROUPED ? "text-muted" : "text-signal"
                      }`}
                    />
                    <h2
                      className={`text-[11px] font-bold uppercase tracking-[0.22em] ${
                        subject === UNGROUPED
                          ? "text-muted"
                          : "text-foreground-dim"
                      }`}
                    >
                      {subject}
                    </h2>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                    {items.length} lec ·{" "}
                    <span className="digit text-foreground-dim">{subTotal}</span>{" "}
                    Q
                  </span>
                </div>
                <ul className="panel divide-y divide-border overflow-hidden">
                  {items.map((r, i) => (
                    <li key={r.id}>
                      <Link
                        href={`/bank/${r.id}`}
                        className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2"
                      >
                        <span className="digit w-8 text-xs text-muted">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold text-foreground">
                            {r.name}
                          </div>
                          <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                            {r.slug}
                          </div>
                        </div>
                        <Badge tone="neutral">{Number(r.count ?? 0)} Q</Badge>
                        <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
