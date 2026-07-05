import Link from "next/link";
import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { lectures, questions } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Upload } from "lucide-react";
import { Configurator } from "./configurator";

export const metadata = { title: "Race entry — WilliamsPod" };
export const dynamic = "force-dynamic";

async function loadLectureChoices() {
  return db
    .select({
      id: lectures.id,
      name: lectures.name,
      slug: lectures.slug,
      subject: lectures.subject,
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
}

export default async function NewRunPage() {
  const lectureRows = await loadLectureChoices();
  const lectures = lectureRows.map((l) => ({
    id: l.id,
    name: l.name,
    slug: l.slug,
    subject: l.subject ?? null,
    count: Number(l.count ?? 0),
  }));
  const empty = lectures.every((l) => l.count === 0);

  return (
    <div className="space-y-8">
      <Link
        href="/run"
        className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.18em] text-muted hover:text-foreground"
      >
        <ChevronLeft className="h-3 w-3" /> Races
      </Link>

      <header>
        <div className="flex items-center gap-2">
          <span className="dot text-signal pod-pulse" />
          <p className="eyebrow">Race entry</p>
        </div>
        <h1 className="mt-2 display-lg text-foreground">
          Take your <span className="race-lean text-signal">grid slot</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-foreground-dim">
          Pick lectures, set a clock tighter than the real Exam Pod, choose how
          many questions. The pod runs parc-fermé lockdown: fullscreen where
          supported, leaving the app fires an integrity flag,{" "}
          <span className="text-bad">two flags and the stewards retire the car</span>.
        </p>
      </header>

      {empty ? (
        <div className="panel bg-grid flex flex-col items-center gap-3 py-14 text-center">
          <p className="text-sm text-muted">
            The garage is empty — deliver parts (.xlsx) first.
          </p>
          <Button asChild className="mt-2" variant="signal">
            <Link href="/upload">
              <Upload className="h-4 w-4" />
              Deliver parts
            </Link>
          </Button>
        </div>
      ) : (
        <Configurator lectures={lectures} />
      )}
    </div>
  );
}
