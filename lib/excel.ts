import * as XLSX from "xlsx-js-style";

/**
 * Excel format expected:
 * - One sheet per lecture; the sheet name is the lecture name.
 * - Header row (case-insensitive, tolerant): question, a, b, c, d, e, correct, explanation, topic, difficulty
 * - "correct" can be a letter (A-E) or a 1-based index.
 * - "difficulty" can be 1-3 or "easy"/"medium"/"hard".
 * - Blank rows are skipped. Rows missing a question stem are skipped.
 */

export type ParsedQuestion = {
  stem: string;
  choices: string[];
  correctIndex: number;
  explanation: string | null;
  topic: string | null;
  difficulty: number | null;
  rowNumber: number; // 1-based row in the source sheet (header = row 1)
};

export type ParsedLecture = {
  name: string;
  questions: ParsedQuestion[];
  warnings: string[];
};

export type ParseResult = {
  lectures: ParsedLecture[];
  errors: { sheet: string; row: number; message: string }[];
};

const CHOICE_KEYS = ["a", "b", "c", "d", "e", "f"] as const;
const HEADER_ALIASES: Record<string, string> = {
  question: "question",
  stem: "question",
  q: "question",
  prompt: "question",
  a: "a",
  b: "b",
  c: "c",
  d: "d",
  e: "e",
  f: "f",
  "choice a": "a",
  "choice b": "b",
  "choice c": "c",
  "choice d": "d",
  "choice e": "e",
  "option a": "a",
  "option b": "b",
  "option c": "c",
  "option d": "d",
  "option e": "e",
  correct: "correct",
  answer: "correct",
  "correct answer": "correct",
  explanation: "explanation",
  rationale: "explanation",
  explain: "explanation",
  topic: "topic",
  subtopic: "topic",
  tag: "topic",
  difficulty: "difficulty",
  level: "difficulty",
};

function normalizeKey(k: string): string {
  return k.trim().toLowerCase().replace(/\s+/g, " ");
}

function mapHeader(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((cell, idx) => {
    if (cell == null) return;
    const key = normalizeKey(String(cell));
    const canonical = HEADER_ALIASES[key];
    if (canonical && !(canonical in map)) {
      map[canonical] = idx;
    }
  });
  return map;
}

function parseCorrect(raw: unknown, choiceCount: number): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") {
    if (Number.isInteger(raw) && raw >= 1 && raw <= choiceCount) return raw - 1;
    return null;
  }
  const s = String(raw).trim();
  if (!s) return null;
  // Letter form (A, B, ..., or "(A)", "A.", "A)")
  const letterMatch = s.match(/^[\s(]?([A-Fa-f])[\s).:]?$/);
  if (letterMatch) {
    const idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
    if (idx >= 0 && idx < choiceCount) return idx;
    return null;
  }
  // Numeric form
  const n = Number(s);
  if (Number.isInteger(n) && n >= 1 && n <= choiceCount) return n - 1;
  return null;
}

function parseDifficulty(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") {
    if (raw >= 1 && raw <= 3) return Math.round(raw);
    return null;
  }
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (["1", "easy", "e", "low"].includes(s)) return 1;
  if (["2", "medium", "med", "m", "mid"].includes(s)) return 2;
  if (["3", "hard", "h", "high"].includes(s)) return 3;
  const n = Number(s);
  if (Number.isInteger(n) && n >= 1 && n <= 3) return n;
  return null;
}

function cellString(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim();
  return String(raw).trim();
}

export function parseWorkbook(buf: ArrayBuffer): ParseResult {
  const wb = XLSX.read(buf, { type: "array" });
  const result: ParseResult = { lectures: [], errors: [] };

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });
    if (!rows.length) continue;

    const header = mapHeader(rows[0]);
    if (header.question == null) {
      result.errors.push({
        sheet: sheetName,
        row: 1,
        message:
          "Missing 'question' column. Required columns: question, A, B, C, D, correct.",
      });
      continue;
    }

    const lecture: ParsedLecture = { name: sheetName.trim(), questions: [], warnings: [] };

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;
      const stem = cellString(row[header.question]);
      if (!stem) continue; // empty row

      const choices: string[] = [];
      for (const key of CHOICE_KEYS) {
        const idx = header[key];
        if (idx == null) continue;
        const v = cellString(row[idx]);
        if (v) choices.push(v);
      }

      if (choices.length < 2) {
        result.errors.push({
          sheet: sheetName,
          row: rowNumber,
          message: `Need at least 2 answer choices (found ${choices.length}).`,
        });
        continue;
      }

      const correctIndex = parseCorrect(
        header.correct != null ? row[header.correct] : null,
        choices.length,
      );
      if (correctIndex == null) {
        result.errors.push({
          sheet: sheetName,
          row: rowNumber,
          message: "Could not parse 'correct' — expected a letter (A-E) or 1-based index.",
        });
        continue;
      }

      const explanation =
        header.explanation != null ? cellString(row[header.explanation]) : "";
      const topic = header.topic != null ? cellString(row[header.topic]) : "";
      const difficulty =
        header.difficulty != null ? parseDifficulty(row[header.difficulty]) : null;

      lecture.questions.push({
        stem,
        choices,
        correctIndex,
        explanation: explanation || null,
        topic: topic || null,
        difficulty,
        rowNumber,
      });
    }

    if (lecture.questions.length === 0) {
      result.errors.push({
        sheet: sheetName,
        row: 0,
        message: "Sheet contained no usable questions.",
      });
    } else {
      result.lectures.push(lecture);
    }
  }

  return result;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "lecture";
}
