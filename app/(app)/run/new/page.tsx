import Link from "next/link";
import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { lectures, questions } from "@/lib/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { Configurator } from "./configurator";

export const metadata = { title: "New run — WilliamsPod" };
export const dynamic = "force-dynamic";

async function loadLectureChoices() {
  return db
    .select({
      id: lectures.id,
      name: lectures.name,
      slug: lectures.slug,
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
    count: Number(l.count ?? 0),
  }));
  const empty = lectures.every((l) => l.count === 0);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/run"
          className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-muted hover:text-foreground"
        >
          <ChevronLeft className="h-3 w-3" /> Runs
        </Link>
      </div>
      <header>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
          Configure training run
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          New pod run
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Pick lectures, set a timer shorter than the real Exam Pod, choose how many
          questions. Pod runs use hard lockdown: fullscreen-required, tab-blur fires an
          integrity flag, two flags = auto-submit.
        </p>
      </header>

      {empty ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted">
            <p>No questions loaded. Upload an .xlsx first.</p>
            <Button asChild className="mt-4" variant="signal">
              <Link href="/upload">Upload bank</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Configurator lectures={lectures} />
      )}
    </div>
  );
}
