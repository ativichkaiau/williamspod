import { redirect } from "next/navigation";
import { UploadClient } from "./upload-client";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Upload — WilliamsPod" };

export default async function UploadPage() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/bank");
  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-2">
          <span className="dot text-signal" />
          <p className="eyebrow">Bank intake</p>
        </div>
        <h1 className="mt-2 display-lg text-foreground">Load question bank</h1>
        <p className="mt-2 max-w-2xl text-sm text-foreground-dim">
          Upload an <span className="font-mono text-foreground">.xlsx</span>. One
          sheet per lecture — the sheet name becomes the lecture name. Header row
          maps to the fields below.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <UploadClient />
        <div className="panel p-6 self-start">
          <p className="eyebrow">Sheet template</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-strong">
            Header row · case-insensitive
          </p>
          <ul className="mt-5 space-y-2.5 font-mono text-[11px]">
            <Field name="question" required>required</Field>
            <Field name="A, B, C, D, E" required>at least 2</Field>
            <Field name="correct" required>letter A-E or 1-based</Field>
            <Field name="explanation">shown in debrief</Field>
            <Field name="topic">enables weak-topic detection</Field>
            <Field name="difficulty">1-3 or easy/medium/hard</Field>
          </ul>
          <p className="mt-5 border-t border-border pt-4 text-[11px] leading-relaxed text-foreground-dim">
            Re-uploading the same sheet name <span className="text-foreground">merges</span>{" "}
            new rows by default. Use <span className="text-foreground">Replace</span>{" "}
            to wipe and reload that lecture.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  name,
  required,
  children,
}: {
  name: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className={required ? "text-signal" : "text-foreground"}>{name}</span>
      <span className="text-right text-[10px] uppercase tracking-[0.14em] text-muted">
        {children}
      </span>
    </li>
  );
}
