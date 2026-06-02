import { notFound } from "next/navigation";
import Link from "next/link";
import { eq, and, isNull, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { lectures, questions } from "@/lib/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft } from "lucide-react";
import { LectureToolbar } from "./toolbar";
import { QuestionEditor } from "./question-editor";

export const dynamic = "force-dynamic";

export default async function LecturePage(
  props: { params: Promise<{ lectureId: string }> },
) {
  const { lectureId } = await props.params;
  const [lec] = await db.select().from(lectures).where(eq(lectures.id, lectureId));
  if (!lec) notFound();

  const qs = await db
    .select()
    .from(questions)
    .where(
      and(eq(questions.lectureId, lectureId), isNull(questions.archivedAt)),
    )
    .orderBy(asc(questions.createdAt));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/bank"
          className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-muted hover:text-foreground"
        >
          <ChevronLeft className="h-3 w-3" /> Bank
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Lecture</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{lec.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {qs.length} question{qs.length === 1 ? "" : "s"} · slug{" "}
            <span className="font-mono text-foreground">{lec.slug}</span>
          </p>
        </div>
        <LectureToolbar lectureId={lec.id} name={lec.name} />
      </header>

      {qs.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted">
            No questions in this lecture.
          </CardContent>
        </Card>
      ) : (
        <ol className="space-y-3">
          {qs.map((q, i) => (
            <li key={q.id}>
              <QuestionEditor index={i + 1} question={q} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
