/*
 * Build the HNS-2 question bank xlsx from the JSON I extracted from the two
 * source docx files. Produces one sheet per lecture in the WilliamsPod format
 * (header: question, A, B, C, D, E, correct, explanation, topic, difficulty).
 *
 * Run:
 *   npx tsx scripts/build-hns2-xlsx.ts /tmp/hns2-records.json /tmp/hns2-bank.xlsx
 */

import * as fs from "node:fs";
import * as XLSX from "xlsx-js-style";

type RawRecord = {
  lecture: string;
  number: number;
  stem: string;
  choices: [string, string][]; // [letter, text]
  correct: string;
  explanation: string;
  topic: string;
};

const SHEET_NAME_MAP: Record<string, string> = {
  "LT01 Clinical Neuroanatomy in Lesion Localization I": "LT01 Lesion Localization I",
  "LT02 Clinical Neuroanatomy in Lesion Localization II": "LT02 Lesion Localization II",
  "LT03 Common ear disorder": "LT03 Common Ear Disorder",
  "LT04 Traumatic and mechanical disorders": "LT04 Trauma & Mechanical",
  "LT05 Metabolic and regulatory disorders": "LT05 Metabolic & Regulatory",
  "LT06 Common eye disorder (posterior segment)": "LT06 Eye - Posterior Segment",
  "LT07 Basic of pharmacology and CNS stimulants": "LT07 Pharm Basics & CNS Stim",
  "LT08 Antiepileptic drugs": "LT08 Antiepileptic Drugs",
  "LT09 Anti-Parkinson-degenerative disorder": "LT09 Anti-Parkinson",
  "LT10 Neoplastic disorders and tumor-like condition": "LT10 Neoplastic Disorders",
  "LT11 Drugs related to ear": "LT11 Ear Drugs",
  "LT12 Cognitive function and consciousness": "LT12 Cognition & Consciousness",
  "LT13 Antimigraine": "LT13 Antimigraine",
  "LT14 Sedative hypnotic drugs": "LT14 Sedative Hypnotics",
  "LT15 Opioid analgesics": "LT15 Opioid Analgesics",
  "LT14 Opioid analgesics": "LT15 Opioid Analgesics", // typo in source — merge
  "LT16 Anti-psychotic": "LT16 Anti-Psychotic",
  "LT18 Infectious/inflammatory/immunologic disorders": "LT18 Inf-Inflam-Immune",
  "LT19 Cerebrospinal fluid analysis": "LT19 CSF Analysis",
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

function letterFor(choices: [string, string][], target: string): string | null {
  // Return the choice text under that letter, or null if missing.
  const found = choices.find(([l]) => l === target);
  return found ? found[1] : null;
}

function main() {
  const [, , inPath, outPath] = process.argv;
  if (!inPath || !outPath) {
    console.error("usage: build-hns2-xlsx.ts <in.json> <out.xlsx>");
    process.exit(1);
  }
  const records: RawRecord[] = JSON.parse(fs.readFileSync(inPath, "utf8"));

  const bySheet = new Map<string, RawRecord[]>();
  for (const r of records) {
    const sheetName = SHEET_NAME_MAP[r.lecture] ?? r.lecture.slice(0, 31);
    let arr = bySheet.get(sheetName);
    if (!arr) {
      arr = [];
      bySheet.set(sheetName, arr);
    }
    arr.push(r);
  }

  const wb = XLSX.utils.book_new();

  // Add the sheets in LT order
  const sheetOrder = Array.from(bySheet.keys()).sort((a, b) => {
    const an = Number(a.match(/^LT(\d+)/)?.[1] ?? 999);
    const bn = Number(b.match(/^LT(\d+)/)?.[1] ?? 999);
    return an - bn;
  });

  let totalQuestions = 0;
  for (const sheetName of sheetOrder) {
    const rows = bySheet.get(sheetName)!;
    const aoa: (string | number)[][] = [HEADER];
    for (const r of rows) {
      const row: (string | number)[] = [
        r.stem,
        letterFor(r.choices, "A") ?? "",
        letterFor(r.choices, "B") ?? "",
        letterFor(r.choices, "C") ?? "",
        letterFor(r.choices, "D") ?? "",
        letterFor(r.choices, "E") ?? "",
        r.correct,
        r.explanation,
        r.topic, // author name as a coarse topic
        "", // difficulty — leave blank, fill in manually if desired
      ];
      aoa.push(row);
      totalQuestions++;
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Column widths for readability when opened in Excel/Numbers.
    ws["!cols"] = [
      { wch: 80 }, // question
      { wch: 40 }, // A
      { wch: 40 }, // B
      { wch: 40 }, // C
      { wch: 40 }, // D
      { wch: 40 }, // E
      { wch: 8 },  // correct
      { wch: 60 }, // explanation
      { wch: 18 }, // topic
      { wch: 10 }, // difficulty
    ];

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    console.log(`  ${sheetName}  (${rows.length} Q)`);
  }

  XLSX.writeFile(wb, outPath);
  console.log(`\nwrote ${outPath} — ${totalQuestions} questions across ${sheetOrder.length} sheets`);
}

main();
