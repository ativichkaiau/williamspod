"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CloudDownload, AlertTriangle, CheckCircle2 } from "lucide-react";

const DEFAULT_HUB = "https://williamshub.vercel.app";

type ImportResult = {
  ok: true;
  source: string;
  subject: string | null;
  lectures: number;
  questions: number;
  inserted: { lecture: string; count: number; mode: "created" | "merged" | "replaced" }[];
};
type SubjectSummary = { code: string; name: string; questions: number };

export function HubImportClient() {
  const router = useRouter();
  const [origin, setOrigin] = useState(DEFAULT_HUB);
  const [subject, setSubject] = useState("");
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function loadSubjects() {
    setLoadingSubjects(true);
    try {
      const res = await fetch(`${origin.replace(/\/+$/, "")}/api/question-bank?summary=1`);
      const json = await res.json();
      setSubjects(Array.isArray(json.subjects) ? json.subjects : []);
    } catch {
      setSubjects([]);
    } finally {
      setLoadingSubjects(false);
    }
  }

  useEffect(() => {
    void loadSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/import-hub", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ origin, subject: subject.trim() || undefined, mode }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? `Import failed (${res.status})`);
        return;
      }
      setResult(json as ImportResult);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import from WilliamsHub</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-foreground-dim">
          Pull the generated question bank from WilliamsHub straight into the Pod bank — arrives grouped by lecture.
        </p>

        <div className="space-y-2">
          <Label className="text-foreground">Hub URL</Label>
          <div className="flex gap-2">
            <Input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder={DEFAULT_HUB} />
            <Button variant="subtle" size="sm" onClick={loadSubjects} disabled={loadingSubjects}>
              {loadingSubjects ? "…" : "Refresh"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="hub-subject" className="text-foreground">
            Subject {subjects.length ? `· ${subjects.length} available` : ""}
          </Label>
          <Input
            id="hub-subject"
            list="hub-subjects"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Blank = whole bank · or e.g. HCVS-2"
            maxLength={40}
          />
          <datalist id="hub-subjects">
            {subjects.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name} · {s.questions} Q
              </option>
            ))}
          </datalist>
          <p className="text-[11px] text-muted">
            Leave blank to import everything (large). Pick a subject to import just that block.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Label className="text-foreground">Mode</Label>
          <div className="flex gap-2">
            <Button variant={mode === "merge" ? "subtle" : "ghost"} size="sm" onClick={() => setMode("merge")}>
              Merge
            </Button>
            <Button variant={mode === "replace" ? "subtle" : "ghost"} size="sm" onClick={() => setMode("replace")}>
              Replace
            </Button>
          </div>
          <p className="text-[11px] text-muted">
            {mode === "merge" ? "Append to matching lectures." : "Wipe matching lectures and reload."}
          </p>
        </div>

        <Button variant="signal" size="lg" disabled={busy} onClick={submit}>
          <CloudDownload className="mr-2 h-4 w-4" />
          {busy ? "Importing…" : "Import from Hub"}
        </Button>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-bad/40 bg-bad/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-bad" />
            <div>
              <p className="font-medium text-bad">Import failed</p>
              <p className="text-bad/80">{error}</p>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3 rounded-md border border-border bg-surface-2 p-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-good" />
              <span className="font-medium text-foreground">
                {result.questions} questions imported across {result.lectures} lecture
                {result.lectures === 1 ? "" : "s"}
                {result.subject ? ` · ${result.subject}` : ""}.
              </span>
            </div>
            {result.inserted.length > 0 && (
              <ul className="max-h-64 space-y-1.5 overflow-y-auto text-sm">
                {result.inserted.map((r) => (
                  <li
                    key={r.lecture}
                    className="flex items-center justify-between border-b border-border/60 py-1 last:border-0"
                  >
                    <span className="truncate pr-2 text-foreground">{r.lecture}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={r.mode === "created" ? "good" : r.mode === "replaced" ? "warn" : "signal"}>{r.mode}</Badge>
                      <span className="font-mono tabular text-muted">+{r.count}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
