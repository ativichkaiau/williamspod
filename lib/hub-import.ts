// Map a WilliamsHub question-bank feed into WilliamsPod lectures/questions.
// The Hub exposes /question-bank.json (per-module questions) and /search-index.json
// (module → title + subject). We group by module → one Pod lecture per module.

import type { ParsedQuestion } from "./excel";

export interface HubQuestion {
  id?: string;
  stem: string;
  options: { id: string; text: string }[];
  answerId: string;
  explanation?: string;
  kind?: string;
  moduleId: string;
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
  sub?: string | null; // lecture-set label, e.g. "L1 — ..."
}

export interface HubLecture {
  name: string;
  subject: string | null;
  sourceModuleId: string;
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

export function mapHubBank(
  feed: HubBankFeed,
  index: HubIndexEntry[],
  subjectFilter: string | null,
): HubLecture[] {
  const meta: Record<string, { title: string; subject: string | null }> = {};
  for (const e of Array.isArray(index) ? index : []) {
    if (e.k === "m" && e.id) meta[e.id] = { title: e.t, subject: e.s ?? null };
  }

  const out: HubLecture[] = [];
  const bank = feed?.bank ?? {};
  for (const [moduleId, qs] of Object.entries(bank)) {
    const info = meta[moduleId];
    const subject = info?.subject ?? null;
    if (!subjectMatches(subject, subjectFilter)) continue;

    const questions: ParsedQuestion[] = [];
    (Array.isArray(qs) ? qs : []).forEach((q, i) => {
      const choices = Array.isArray(q.options) ? q.options.map((o) => o.text) : [];
      if (choices.length < 2 || typeof q.stem !== "string") return;
      const correctIndex = q.options.findIndex((o) => o.id === q.answerId);
      if (correctIndex < 0) return;
      questions.push({
        stem: q.stem,
        choices,
        correctIndex,
        explanation: typeof q.explanation === "string" ? q.explanation : null,
        topic: typeof q.kind === "string" ? q.kind : null,
        difficulty: null,
        rowNumber: i + 1,
      });
    });

    if (questions.length > 0) {
      out.push({
        name: info?.title ?? moduleId.replace(/-/g, " "),
        subject,
        sourceModuleId: moduleId,
        questions,
      });
    }
  }
  return out;
}

/** Distinct subject codes present in the mapped set (for the picker UI). */
export function hubSubjects(index: HubIndexEntry[]): string[] {
  const set = new Set<string>();
  for (const e of Array.isArray(index) ? index : []) if (e.k === "m" && e.s) set.add(e.s);
  return [...set].sort();
}
