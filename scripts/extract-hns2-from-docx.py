#!/usr/bin/env python3
"""
Extract HNS-2 mock-exam questions + answers from the two source .docx files.

Outputs a single JSON array of records:
  [{ "lecture": str, "number": int, "stem": str,
     "choices": [["A","..."],["B","..."],...],
     "correct": "A"|"B"|..., "explanation": str, "topic": str }]

Stems containing Thai characters are kept as-is — translate them with
`translate-hns2.py` before building the xlsx.

Usage:
  python3 scripts/extract-hns2-from-docx.py \\
    --questions  "ANS KEY HNS-2 code X.docx" \\
    --answer-key "HNS-2 code X active.docx" \\
    --out /tmp/hns2-records.json
"""
import argparse
import json
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def extract_paragraphs(docx_path):
    """Read paragraph-by-paragraph text from a .docx file."""
    with zipfile.ZipFile(docx_path) as z:
        with z.open("word/document.xml") as f:
            tree = ET.parse(f)
    body = tree.getroot().find(f"{NS}body")
    paragraphs = []
    for p in body.iter(f"{NS}p"):
        runs = [t.text for t in p.iter(f"{NS}t") if t.text]
        if runs:
            paragraphs.append("".join(runs))
    return paragraphs


LECTURE_RE = re.compile(r"^LT\d+\s+(.+)$")
NUM_RE = re.compile(r"^(\d+)\.?\s*$")
ANS_RE = re.compile(r"^Answer:\s*([A-Fa-f])[\.\)]?", re.IGNORECASE)
AUTHOR_RE = re.compile(r"^\((.+)\)$")


def parse_questions(paragraphs):
    """Walk the question file and yield records with lecture/number/stem/choices."""
    records = []
    current_lecture = None
    current_record = None
    for line in paragraphs:
        s = line.strip()
        if not s:
            continue
        m = LECTURE_RE.match(s)
        if m and not s.startswith(("No.", "Question", "Choices")):
            current_lecture = s
            continue
        m = NUM_RE.match(s)
        if m:
            if current_record:
                records.append(current_record)
            current_record = {
                "lecture": current_lecture,
                "number": int(m.group(1)),
                "stem": "",
                "choices": [],
                "author": None,
            }
            continue
        if current_record is None:
            continue
        if AUTHOR_RE.match(s) and current_record["stem"]:
            current_record["author"] = s.strip("()")
            continue
        cm = re.match(r"^([A-Fa-f])\.?\.?\)?\s*(.*)$", s)
        if cm and current_record["stem"] and len(s) <= 600:
            letter = cm.group(1).upper()
            expected = chr(ord("A") + len(current_record["choices"]))
            if letter == expected:
                current_record["choices"].append((letter, cm.group(2).strip()))
                continue
        if not current_record["choices"]:
            current_record["stem"] = (current_record["stem"] + " " + s).strip()
    if current_record:
        records.append(current_record)
    return records


def parse_answers(paragraphs):
    """Walk the answer-key file and yield { number → { letter, explanation } }."""
    answers = {}
    current_num = None
    current_letter = None
    current_lines = []

    def flush():
        nonlocal current_num, current_letter, current_lines
        if current_num is not None and current_letter:
            exp = "\n".join(current_lines).strip()
            exp = re.sub(r"^(Why\?|Explanation:?)\s*\n?", "", exp).strip()
            answers[current_num] = {"letter": current_letter, "explanation": exp}
        current_num = None
        current_letter = None
        current_lines = []

    for p in paragraphs:
        s = p.strip()
        if LECTURE_RE.match(s):
            continue
        m = NUM_RE.match(s)
        if m:
            flush()
            current_num = int(m.group(1))
            continue
        m = ANS_RE.match(s)
        if m and current_num:
            current_letter = m.group(1).upper()
            continue
        if current_num and current_letter:
            current_lines.append(s)
    flush()
    return answers


def merge(questions, answers):
    """Cross-reference question records with answer-key records by number."""
    out = []
    for r in questions:
        a = answers.get(r["number"])
        if not a or not a.get("letter"):
            continue
        letters = [c[0] for c in r["choices"]]
        if a["letter"] not in letters:
            continue
        out.append({
            "lecture": r["lecture"],
            "number": r["number"],
            "stem": r["stem"],
            "choices": [list(c) for c in r["choices"]],
            "correct": a["letter"],
            "explanation": a.get("explanation", "") or "",
            "topic": r["author"] or "",
        })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--questions", required=True, help="path to questions .docx")
    ap.add_argument("--answer-key", required=True, help="path to answer-key .docx")
    ap.add_argument("--out", required=True, help="path to output .json")
    args = ap.parse_args()

    q_paras = extract_paragraphs(args.questions)
    k_paras = extract_paragraphs(args.answer_key)
    questions = parse_questions(q_paras)
    answers = parse_answers(k_paras)
    records = merge(questions, answers)

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False)

    thai_re = re.compile(r"[฀-๿]")
    thai_stem = sum(1 for r in records if thai_re.search(r["stem"]))
    print(
        f"extracted {len(records)} records → {args.out}  "
        f"({thai_stem} stems contain Thai characters)",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
