// Map a WilliamsHub question-bank feed into WilliamsPod lectures.
// The Hub exposes GET /api/question-bank (per-module questions) and
// /search-index.json (module → title / subject / source). We group modules by
// their LECTURE (source, e.g. "L1 — Cardiac Arrhythmias") → one Pod lecture each.

import type { ParsedQuestion } from "./excel";

export interface HubQuestion {
  id?: string;
  stem: string;
  options: { id: string; text: string }[];
  answerId: string;
  explanation?: string;
  kind?: string;
  moduleId?: string;
}

export interface HubBankFeed {
  modules?: number;
  count?: number;
  bank: Record<string, HubQuestion[]>;
}

export interface HubIndexEntry {
  k: string; // 'm' | 'l' | 's'
  t: string; // title
  s?: string | null; // subject code
  id?: string; // module id
  sub?: string | null; // lecture (source) label, e.g. "L1 — Cardiac Arrhythmias"
}

export interface HubLecture {
  name: string; // Pod lecture name, e.g. "HCVS-2 · L1 — Cardiac Arrhythmias"
  subject: string | null; // subject code, e.g. "HCVS-2"
  questions: ParsedQuestion[];
}

function normalizeSubject(subject: string | null | undefined): string | null {
  const value = subject?.trim();
  return value ? value.toUpperCase() : null;
}

function subjectMatches(subject: string | null, filter: string | null): boolean {
  if (!filter) return true;
  return normalizeSubject(subject) === normalizeSubject(filter);
}

function toParsed(qs: HubQuestion[]): ParsedQuestion[] {
  const out: ParsedQuestion[] = [];
  for (const q of Array.isArray(qs) ? qs : []) {
    const choices = Array.isArray(q.options) ? q.options.map((o) => o.text) : [];
    if (choices.length < 2 || typeof q.stem !== "string") continue;
    const correctIndex = q.options.findIndex((o) => o.id === q.answerId);
    if (correctIndex < 0) continue;
    out.push({
      stem: q.stem,
      choices,
      correctIndex,
      explanation: typeof q.explanation === "string" ? q.explanation : null,
      topic: typeof q.kind === "string" ? q.kind : null,
      difficulty: null,
      rowNumber: out.length + 1,
    });
  }
  return out;
}

export function mapHubBank(
  feed: HubBankFeed,
  index: HubIndexEntry[],
  subjectFilter: string | null,
): HubLecture[] {
  const meta: Record<string, { title: string; subject: string | null; source: string | null }> = {};
  for (const e of Array.isArray(index) ? index : []) {
    if (e.k === "m" && e.id) meta[e.id] = { title: e.t, subject: e.s ?? null, source: e.sub ?? null };
  }

  // Group modules by their lecture (source).
  const groups = new Map<string, HubLecture>();
  for (const [moduleId, qs] of Object.entries(feed?.bank ?? {})) {
    const info = meta[moduleId];
    const subject = info?.subject ?? null;
    if (!subjectMatches(subject, subjectFilter)) continue;

    const source = info?.source ?? info?.title ?? moduleId.replace(/-/g, " ");
    const parsed = toParsed(qs);
    if (parsed.length === 0) continue;

    const key = `${normalizeSubject(subject) ?? ""}|${source}`;
    const name = subject ? `${subject} · ${source}` : source;
    const group = groups.get(key) ?? { name, subject, questions: [] };
    group.questions.push(...parsed);
    groups.set(key, group);
  }

  // Re-number rows sequentially within each lecture.
  for (const group of groups.values()) group.questions.forEach((q, i) => (q.rowNumber = i + 1));
  return [...groups.values()].filter((g) => g.questions.length > 0);
}

/** Distinct subject codes present in the index (for the picker UI). */
export function hubSubjects(index: HubIndexEntry[]): string[] {
  const set = new Set<string>();
  for (const e of Array.isArray(index) ? index : []) if (e.k === "m" && e.s) set.add(e.s);
  return [...set].sort();
}
