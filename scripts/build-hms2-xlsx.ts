/*
 * Build the HMS-2 question-bank XLSX from records produced by
 * scripts/extract-hms2-with-images.py.
 *
 * Produces one sheet per lecture in WilliamsPod's upload format:
 * question, A, B, C, D, E, correct, explanation, topic, difficulty
 */

import * as fs from "node:fs";
import * as XLSX from "xlsx-js-style";

type RawRecord = {
  lecture: string;
  number: number;
  stem: string;
  choices: [string, string][];
  correct: string;
  allCorrect?: string[];
  explanation: string;
  topic: string;
};

const SHEET_NAME_MAP: Record<string, string> = {
  "LT1 : Disorders of bone": "LT1 Disorders of Bone",
  "LT2 : Disorder of Skeletal Muscle": "LT2 Skeletal Muscle",
  "LT3 : Disorder of Joint": "LT3 Joint Disorders",
  "LT 4 : Introduction to autacoids, salicylates & NSAIDs":
    "LT4 Autacoids NSAIDs",
  "LT 5 : Anti-rheumatic drugs and drugs used in gouts":
    "LT5 Anti-Rheumatic & Gout Drugs",
  "LT 6 : Therapeutic Uses in Musculoskeletal Disorders":
    "LT6 Therapeutic Uses",
  "LT 7 : Drug Effects on Bone Metabolism": "LT7 Bone Metabolism Drugs",
  "LT 8 : Tumors of musculoskeletal system and connective tissue":
    "LT8 MSK Tumors",
};

const HEADER = [
  "question",
  "A",
  "B",
  "C",
  "D",
  "E",
  "correct",
  "explanation",
  "topic",
  "difficulty",
];

function letterFor(choices: [string, string][], target: string): string {
  return choices.find(([letter]) => letter === target)?.[1] ?? "";
}

function sheetOrderKey(sheetName: string): number {
  return Number(sheetName.match(/^LT\s*(\d+)/i)?.[1] ?? 999);
}

function main() {
  const [, , inPath, outPath] = process.argv;
  if (!inPath || !outPath) {
    console.error("usage: build-hms2-xlsx.ts <in.json> <out.xlsx>");
    process.exit(1);
  }

  const records: RawRecord[] = JSON.parse(fs.readFileSync(inPath, "utf8"));
  const bySheet = new Map<string, RawRecord[]>();

  for (const r of records) {
    const sheetName = (SHEET_NAME_MAP[r.lecture] ?? r.lecture).slice(0, 31);
    const rows = bySheet.get(sheetName) ?? [];
    rows.push(r);
    bySheet.set(sheetName, rows);
  }

  const wb = XLSX.utils.book_new();
  let total = 0;
  for (const sheetName of Array.from(bySheet.keys()).sort(
    (a, b) => sheetOrderKey(a) - sheetOrderKey(b),
  )) {
    const rows = bySheet.get(sheetName)!;
    const aoa: (string | number)[][] = [HEADER];
    for (const r of rows) {
      const explanation =
        r.allCorrect && r.allCorrect.length > 1
          ? `Source key also accepts: ${r.allCorrect.join(", ")}.\n${r.explanation}`
          : r.explanation;
      aoa.push([
        r.stem,
        letterFor(r.choices, "A"),
        letterFor(r.choices, "B"),
        letterFor(r.choices, "C"),
        letterFor(r.choices, "D"),
        letterFor(r.choices, "E"),
        r.correct,
        explanation,
        r.topic,
        "",
      ]);
      total += 1;
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 88 },
      { wch: 42 },
      { wch: 42 },
      { wch: 42 },
      { wch: 42 },
      { wch: 42 },
      { wch: 8 },
      { wch: 68 },
      { wch: 18 },
      { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    console.log(`  ${sheetName} (${rows.length} Q)`);
  }

  XLSX.writeFile(wb, outPath);
  console.log(`\nwrote ${outPath} - ${total} questions across ${bySheet.size} sheets`);
}

main();
