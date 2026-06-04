/*
 * Build the HEN-2 question bank xlsx from the JSON extracted from the two
 * source docx files. One sheet per lecture (LT#) in WilliamsPod format.
 *
 * Run:
 *   npx tsx scripts/build-hen2-xlsx.ts /tmp/hen2-records.json /tmp/hen2-bank.xlsx
 */

import * as fs from "node:fs";
import * as XLSX from "xlsx-js-style";

type RawRecord = {
  lecture: string;
  number: number;
  stem: string;
  choices: [string, string][];
  correct: string;
  explanation: string;
  topic: string;
};

const SHEET_NAME_MAP: Record<string, string> = {
  "LT1 - Pathology related to pituitary and hypothalamus":
    "LT1 Pituitary & Hypothalamus",
  "LT2 - Drugs related to pituitary & hypothalamus": "LT2 Pituitary Drugs",
  "LT3 - Pathology of adrenal gland and multiple endocrine neoplasia":
    "LT3 Adrenal & MEN",
  "LT4 - Cushing syndrome": "LT4 Cushing Syndrome",
  "LT5 - Corticosteroids & antagonists": "LT5 Corticosteroids",
  "LT6 - Pathology of thyroid & parathyroid": "LT6 Thyroid & Parathyroid Path",
  "LT7 - Clinical Pathology in DM, DMtype 1&2, insulin resistance":
    "LT7 Clinical DM & T1-T2",
  "LT8 - Drugs used in thyroid diseases": "LT8 Thyroid Drugs",
  "LT9 - Drugs used in parathyroid diseases": "LT9 Parathyroid Drugs",
  "LT10 - Investigation used in DM": "LT10 DM Investigations",
  "LT12 - Treatment of diabetes": "LT12 Diabetes Treatment",
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
  const found = choices.find(([l]) => l === target);
  return found ? found[1] : "";
}

function main() {
  const [, , inPath, outPath] = process.argv;
  if (!inPath || !outPath) {
    console.error("usage: build-hen2-xlsx.ts <in.json> <out.xlsx>");
    process.exit(1);
  }
  const records: RawRecord[] = JSON.parse(fs.readFileSync(inPath, "utf8"));

  const bySheet = new Map<string, RawRecord[]>();
  for (const r of records) {
    const sheetName = SHEET_NAME_MAP[r.lecture] ?? r.lecture.slice(0, 31);
    if (sheetName.length > 31) {
      console.warn(`!! sheet name too long, truncating: ${sheetName}`);
    }
    const arr = bySheet.get(sheetName) ?? [];
    arr.push(r);
    bySheet.set(sheetName, arr);
  }

  const wb = XLSX.utils.book_new();
  const sheetOrder = Array.from(bySheet.keys()).sort((a, b) => {
    const an = Number(a.match(/^LT(\d+)/)?.[1] ?? 999);
    const bn = Number(b.match(/^LT(\d+)/)?.[1] ?? 999);
    return an - bn;
  });

  let total = 0;
  for (const sheetName of sheetOrder) {
    const rows = bySheet.get(sheetName)!;
    const aoa: (string | number)[][] = [HEADER];
    for (const r of rows) {
      aoa.push([
        r.stem,
        letterFor(r.choices, "A"),
        letterFor(r.choices, "B"),
        letterFor(r.choices, "C"),
        letterFor(r.choices, "D"),
        letterFor(r.choices, "E"),
        r.correct,
        r.explanation,
        r.topic,
        "",
      ]);
      total++;
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 80 },
      { wch: 40 },
      { wch: 40 },
      { wch: 40 },
      { wch: 40 },
      { wch: 40 },
      { wch: 8 },
      { wch: 60 },
      { wch: 18 },
      { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    console.log(`  ${sheetName}  (${rows.length} Q)`);
  }

  XLSX.writeFile(wb, outPath);
  console.log(`\nwrote ${outPath} — ${total} questions across ${sheetOrder.length} sheets`);
}

main();
