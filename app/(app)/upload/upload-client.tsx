"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UploadCloud, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type UploadResult = {
  ok: true;
  inserted: { lecture: string; count: number; mode: "created" | "merged" | "replaced" }[];
  warnings: { sheet: string; row: number; message: string }[];
};

export function UploadClient() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", mode);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? `Upload failed (${res.status})`);
        if (json.details) setResult({ ok: true, inserted: [], warnings: json.details });
        return;
      }
      setResult(json as UploadResult);
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
        <CardTitle>Intake</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) setFile(f);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed bg-surface-2 p-10 text-center transition-colors",
            dragOver
              ? "border-signal/70 bg-signal/5"
              : "border-border-strong hover:border-signal/50",
          )}
        >
          <UploadCloud className="h-7 w-7 text-muted" />
          <span className="text-sm text-foreground">
            {file ? file.name : "Drop .xlsx here or click to choose"}
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted">
            up to 20 MB
          </span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Label className="text-foreground">Mode</Label>
          <div className="flex gap-2">
            <Button
              variant={mode === "merge" ? "subtle" : "ghost"}
              size="sm"
              onClick={() => setMode("merge")}
            >
              Merge
            </Button>
            <Button
              variant={mode === "replace" ? "subtle" : "ghost"}
              size="sm"
              onClick={() => setMode("replace")}
            >
              Replace
            </Button>
          </div>
          <p className="text-[11px] text-muted">
            {mode === "merge"
              ? "Append rows to matching lectures; keep existing questions."
              : "Wipe matching lectures and reload from this file."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="signal"
            disabled={!file || busy}
            onClick={submit}
            size="lg"
          >
            {busy ? "Parsing…" : "Load into bank"}
          </Button>
          {file && !busy && (
            <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
              Clear
            </Button>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-bad/40 bg-bad/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-bad" />
            <div>
              <p className="font-medium text-bad">Upload failed</p>
              <p className="text-bad/80">{error}</p>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3 rounded-md border border-border bg-surface-2 p-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-good" />
              <span className="font-medium text-foreground">
                {result.inserted.reduce((s, x) => s + x.count, 0)} questions imported
                across {result.inserted.length} lecture
                {result.inserted.length === 1 ? "" : "s"}.
              </span>
            </div>
            {result.inserted.length > 0 && (
              <ul className="space-y-1.5 text-sm">
                {result.inserted.map((r) => (
                  <li
                    key={r.lecture}
                    className="flex items-center justify-between border-b border-border/60 py-1 last:border-0"
                  >
                    <span className="text-foreground">{r.lecture}</span>
                    <div className="flex items-center gap-2">
                      <Badge
                        tone={
                          r.mode === "created"
                            ? "good"
                            : r.mode === "replaced"
                              ? "warn"
                              : "signal"
                        }
                      >
                        {r.mode}
                      </Badge>
                      <span className="font-mono tabular text-muted">
                        +{r.count}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {result.warnings.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-warn">
                  {result.warnings.length} row warning
                  {result.warnings.length === 1 ? "" : "s"}
                </summary>
                <ul className="mt-2 space-y-1 font-mono">
                  {result.warnings.map((w, i) => (
                    <li key={i} className="text-muted">
                      <span className="text-foreground">{w.sheet}</span>:{w.row} —{" "}
                      {w.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
