import { readFileSync } from "node:fs";
import { parseWorkbook } from "../lib/excel";

const path = process.argv[2] ?? "/tmp/hns2-bank.xlsx";
const buf = readFileSync(path);
const r = parseWorkbook(
  buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
);

console.log(`lectures: ${r.lectures.length}, errors: ${r.errors.length}`);
let totalQ = 0;
for (const lec of r.lectures) {
  console.log(`  ${lec.name} — ${lec.questions.length} Q`);
  totalQ += lec.questions.length;
}
console.log(`total questions: ${totalQ}`);
if (r.errors.length) {
  console.log("\nErrors:");
  for (const e of r.errors.slice(0, 10)) {
    console.log(`  ${e.sheet}:${e.row}  ${e.message}`);
  }
}
