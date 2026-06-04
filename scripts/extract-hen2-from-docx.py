#!/usr/bin/env python3
"""
Extract HEN-2 mock-exam questions + answers from the two source .docx files,
split into one record per question with its lecture (LT#) attached.

Output JSON format matches scripts/extract-hns2-from-docx.py so the same
translate + build pipeline can consume it.

Usage:
  python3 scripts/extract-hen2-from-docx.py \\
    --questions  "Codex HEN-2 Aubrynn.docx" \\
    --answer-key "ANS KEY Codex HEN-2 Aubrynn.docx" \\
    --out /tmp/hen2-records.json
"""
import argparse
import json
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def extract_paragraphs(docx_path):
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


# HEN-2 uses "LT1 - Title" or "LT01 Title". Make the dash optional.
LECTURE_RE = re.compile(r"^LT\s*\d+(?:\s*[-–:]\s*|\s+)(.+)$")
NUM_RE = re.compile(r"^(\d+)\.?\s*$")
ANS_RE = re.compile(r"^Answer:\s*([A-Fa-f])[\.\)]?", re.IGNORECASE)
AUTHOR_RE = re.compile(r"^\(([^)]+)\)$")

# Split a paragraph that packs multiple choices into one line, like
#   "A. Empty sella syndromeB. Sheehan syndromeC. Pituitary adenomaD. Craniopharyngioma"
# into [(A, "Empty sella syndrome"), (B, "Sheehan syndrome"), ...]
MULTI_CHOICE_RE = re.compile(r"([A-F])\.\s*")


def maybe_split_inline_choices(line):
    """If a single line contains multiple A./B./C./... markers, return the
    parsed list. Otherwise return None."""
    matches = list(MULTI_CHOICE_RE.finditer(line))
    # Heuristic: only treat as multi-choice when we see at least 3 different
    # letters in sequence (A, B, C, ...) — avoids false-positives like
    # "A. patient ... B. develops ..." being misparsed.
    letters = [m.group(1) for m in matches]
    if len(letters) < 3:
        return None
    # Letters must start at A and be roughly contiguous in order.
    expected = [chr(ord("A") + i) for i in range(len(letters))]
    if letters != expected:
        return None
    out = []
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(line)
        text = line[start:end].strip().rstrip(".")
        if text:
            out.append((m.group(1), text))
    return out


def parse_questions(paragraphs):
    records = []
    current_lecture = None
    current_record = None

    def commit():
        if current_record:
            records.append(current_record)

    for line in paragraphs:
        s = line.strip()
        if not s:
            continue

        # Lecture header
        m = LECTURE_RE.match(s)
        if m and not s.startswith(("No.", "Question", "Choices")):
            current_lecture = s
            continue

        # Question number on its own line
        m = NUM_RE.match(s)
        if m:
            commit()
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

        # Author tag in parens
        if AUTHOR_RE.match(s) and current_record["stem"]:
            current_record["author"] = s.strip("()")
            continue

        # Multi-choice on one line?
        if current_record["stem"] and not current_record["choices"]:
            multi = maybe_split_inline_choices(s)
            if multi:
                current_record["choices"].extend(multi)
                continue

        # Single choice on its own line?
        cm = re.match(r"^([A-Fa-f])[\.\)]\s*(.*)$", s)
        if cm and current_record["stem"] and len(s) <= 600:
            letter = cm.group(1).upper()
            expected = chr(ord("A") + len(current_record["choices"]))
            if letter == expected:
                current_record["choices"].append((letter, cm.group(2).strip()))
                continue

        # Otherwise it's part of the stem
        if not current_record["choices"]:
            # Trim any trailing author tag baked into the line
            author_inline = re.search(r"\(([A-Za-z][^)]*)\)\s*$", s)
            if author_inline and current_record["stem"]:
                current_record["author"] = author_inline.group(1)
                s = s[: author_inline.start()].strip()
            current_record["stem"] = (current_record["stem"] + " " + s).strip()

    commit()
    return records


def parse_answers(paragraphs):
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
    out = []
    for r in questions:
        a = answers.get(r["number"])
        if not a or not a.get("letter"):
            continue
        if not r["choices"] or not r["stem"]:
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
    ap.add_argument("--questions", required=True)
    ap.add_argument("--answer-key", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    qp = extract_paragraphs(args.questions)
    kp = extract_paragraphs(args.answer_key)
    questions = parse_questions(qp)
    answers = parse_answers(kp)
    records = merge(questions, answers)

    thai_re = re.compile(r"[฀-๿]")
    thai_stem = sum(1 for r in records if thai_re.search(r["stem"]))

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False)

    print(
        f"extracted {len(records)} records → {args.out}  "
        f"({thai_stem} stems contain Thai characters)",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
