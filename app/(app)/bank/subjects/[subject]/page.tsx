import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  compareLectures,
  loadBankLectures,
  subjectFromRoute,
  subjectLabel,
} from "@/lib/bank";
import { ChevronLeft, ChevronRight, LibraryBig } from "lucide-react";

export const dynamic = "force-dynamic";

type SubjectPageProps = {
  params: Promise<{ subject: string }>;
};

export async function generateMetadata({ params }: SubjectPageProps) {
  const { subject } = await params;
  return {
    title: `${subjectLabel(subjectFromRoute(subject))} — Bank — WilliamsPod`,
  };
}

export default async function SubjectPage({ params }: SubjectPageProps) {
  const { subject } = await params;
  const selectedSubject = subjectFromRoute(subject);
  const label = subjectLabel(selectedSubject);
  const rows = (await loadBankLectures())
    .filter((lecture) => subjectLabel(lecture.subject) === label)
    .sort(compareLectures);

  if (rows.length === 0) notFound();

  const total = rows.reduce((sum, row) => sum + Number(row.count ?? 0), 0);

  return (
    <div className="space-y-8">
      <Link
        href="/bank"
        className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-3 w-3" /> Subjects
      </Link>

      <header>
        <div className="flex items-center gap-2">
          <span className="dot text-signal" />
          <p className="eyebrow">Question bank · Subject</p>
        </div>
        <h1 className="mt-2 display-lg text-foreground">{label}</h1>
        <p className="mt-2 text-sm text-foreground-dim">
          <span className="digit text-foreground">{rows.length}</span> lecture
          {rows.length === 1 ? "" : "s"} ·{" "}
          <span className="digit text-foreground">{total}</span> question
          {total === 1 ? "" : "s"}
        </p>
      </header>

      <ul className="panel divide-y divide-border overflow-hidden">
        {rows.map((lecture, index) => (
          <li key={lecture.id}>
            <Link
              href={`/bank/${lecture.id}`}
              className="group flex min-h-18 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2 sm:gap-4 sm:px-5"
            >
              <span className="digit w-7 shrink-0 text-xs text-muted sm:w-8">
                {String(index + 1).padStart(2, "0")}
              </span>
              <LibraryBig className="h-4 w-4 shrink-0 text-signal" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-foreground">
                  {lecture.name}
                </div>
                <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  {lecture.slug}
                </div>
              </div>
              <Badge tone="neutral" className="shrink-0 whitespace-nowrap">
                {Number(lecture.count ?? 0)} Q
              </Badge>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
