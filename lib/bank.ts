import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { lectures, questions } from "@/lib/db/schema";

export const UNGROUPED_SUBJECT_KEY = "_other";
export const UNGROUPED_SUBJECT_LABEL = "Other";

export async function loadBankLectures() {
  return db
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
}

export function subjectLabel(subject: string | null | undefined) {
  return subject?.trim() || UNGROUPED_SUBJECT_LABEL;
}

export function subjectHref(subject: string | null | undefined) {
  const key = subject?.trim() || UNGROUPED_SUBJECT_KEY;
  return `/bank/subjects/${encodeURIComponent(key)}`;
}

export function subjectFromRoute(value: string) {
  const subject = value.trim();
  return subject === UNGROUPED_SUBJECT_KEY || subject.length === 0
    ? null
    : subject;
}

export function compareLectures(
  a: { name: string; orderIndex: number },
  b: { name: string; orderIndex: number },
) {
  const aNumber = lectureNumber(a.name);
  const bNumber = lectureNumber(b.name);
  if (aNumber !== bNumber) return aNumber - bNumber;
  if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
  return a.name.localeCompare(b.name);
}

function lectureNumber(name: string) {
  const match = name.match(/^LT\s*(\d+)/i);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}
