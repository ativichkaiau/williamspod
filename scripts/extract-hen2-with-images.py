#!/usr/bin/env python3
"""
Table-aware extraction of HEN-2 questions + answers + images.

Walks the single table in the question docx (No. | Question | Choices),
which is more reliable than the linear-paragraph parser (it never mixes a
stem into the next question's choices, and it keeps images bound to the row
that contains them).

Outputs:
  - records JSON  (stem/choices/correct/explanation/topic/images per question)
  - extracted image files into <public_dir>/hen2/  named q<NN>-<seq>.<ext>

Usage:
  python3 scripts/extract-hen2-with-images.py \\
    --questions  "Codex HEN-2 Aubrynn.docx" \\
    --answer-key "ANS KEY Codex HEN-2 Aubrynn.docx" \\
    --public-dir public \\
    --out /tmp/hen2-records.json
"""
import argparse
import json
import os
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

try:
    from PIL import Image
    import io
    HAVE_PIL = True
except ImportError:
    HAVE_PIL = False

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"

LECTURE_RE = re.compile(r"^LT\s*\d+(?:\s*[-–:]\s*|\s+)(.+)$")
NUM_RE = re.compile(r"^\s*(\d+)\.?\s*$")
ANS_RE = re.compile(r"^Answer:\s*([A-Fa-f])[\.\)]?", re.IGNORECASE)


def cell_text(tc):
    # Join runs; insert spaces between paragraphs so words don't fuse.
    parts = []
    for p in tc.iter(f"{W}p"):
        runs = [t.text or "" for t in p.iter(f"{W}t")]
        if runs:
            parts.append("".join(runs))
    return "\n".join(parts)


def cell_image_rids(tc):
    out = []
    for blip in tc.iter(f"{A}blip"):
        rid = blip.get(f"{R}embed") or blip.get(f"{R}link")
        if rid:
            out.append(rid)
    return out


def split_inline_choices(text):
    """Turn 'A. xxxB. yyyC. zzz' (concatenated, no boundary between a choice's
    last word and the next marker) into [(A,xxx),(B,yyy),...].

    Strategy: search for each expected marker letter in order. Looking only for
    the *next* expected letter avoids false positives from stray capitals, and
    a plain substring search (no \\b) handles 'GoiterB.' where the marker sits
    flush against the previous word.
    """
    flat = re.sub(r"\s*\n\s*", " ", text).strip()

    # Find the byte position of each marker A., B., C., ... in sequence.
    marker_positions = []  # (letter, start_of_marker, end_of_marker)
    search_from = 0
    letter_idx = 0
    while letter_idx < 6:
        letter = chr(ord("A") + letter_idx)
        # marker = the letter followed by '.' or ')'
        m = re.compile(re.escape(letter) + r"[\.\)]").search(flat, search_from)
        if not m:
            break
        marker_positions.append((letter, m.start(), m.end()))
        search_from = m.end()
        letter_idx += 1

    if len(marker_positions) < 2:
        return []

    out = []
    for i, (letter, _start, end) in enumerate(marker_positions):
        text_end = (
            marker_positions[i + 1][1]
            if i + 1 < len(marker_positions)
            else len(flat)
        )
        choice = flat[end:text_end].strip().rstrip(".").strip()
        if choice:
            out.append((letter, choice))
    return out


def extract_questions(qpath, public_hen2_dir):
    z = zipfile.ZipFile(qpath)
    rels = ET.fromstring(z.read("word/_rels/document.xml.rels"))
    rid_map = {rel.get("Id"): rel.get("Target") for rel in rels}
    doc = ET.fromstring(z.read("word/document.xml"))
    body = doc.find(f"{W}body")
    tbl = body.find(f"{W}tbl")

    os.makedirs(public_hen2_dir, exist_ok=True)
    saved = {}  # media target -> public filename

    records = []
    current_lecture = None
    for tr in tbl.findall(f"{W}tr"):
        cells = tr.findall(f"{W}tc")
        if len(cells) == 1:
            t = cell_text(cells[0]).strip()
            m = LECTURE_RE.match(t)
            if m:
                current_lecture = t
            continue
        if len(cells) < 3:
            continue
        num_txt = cell_text(cells[0]).strip()
        nm = NUM_RE.match(num_txt)
        if not nm:
            continue  # header row ("No." / "Questions" / "Choices") or junk
        number = int(nm.group(1))
        stem = re.sub(r"\s*\n\s*", " ", cell_text(cells[1])).strip()
        choices = split_inline_choices(cell_text(cells[2]))

        # Images live in the question cell (index 1); occasionally choices cell.
        img_files = []
        for ci in (1, 2):
            for seq, rid in enumerate(cell_image_rids(cells[ci]), start=1):
                target = rid_map.get(rid)
                if not target:
                    continue
                if target in saved:
                    img_files.append(saved[target])
                    continue
                blob = z.read("word/" + target)
                ext = os.path.splitext(target)[1].lower() or ".png"
                fname = f"q{number:03d}-{len(img_files)+1}{ext}"
                with open(os.path.join(public_hen2_dir, fname), "wb") as f:
                    f.write(blob)
                w = h = 0
                if HAVE_PIL:
                    try:
                        with Image.open(io.BytesIO(blob)) as im:
                            w, h = im.size
                    except Exception:
                        pass
                rec = {"file": fname, "w": w, "h": h}
                saved[target] = rec
                img_files.append(rec)

        records.append({
            "lecture": current_lecture,
            "number": number,
            "stem": stem,
            "choices": [list(c) for c in choices],
            "images": img_files,
        })
    return records


def extract_answers(kpath):
    z = zipfile.ZipFile(kpath)
    doc = ET.fromstring(z.read("word/document.xml"))
    body = doc.find(f"{W}body")
    paragraphs = []
    for p in body.iter(f"{W}p"):
        runs = [t.text for t in p.iter(f"{W}t") if t.text]
        if runs:
            paragraphs.append("".join(runs))

    # Bare choice line like "C. Impaired glucose tolerance" — used as a fallback
    # answer indicator when the key omits the "Answer:" prefix.
    BARE_RE = re.compile(r"^\s*([A-Fa-f])[\.\)]\s+\S")

    answers = {}
    cur_num = cur_letter = None
    fallback_letter = None
    lines = []

    def flush():
        nonlocal cur_num, cur_letter, fallback_letter, lines
        if cur_num is not None:
            letter = cur_letter or fallback_letter
            if letter:
                exp = "\n".join(lines).strip()
                exp = re.sub(r"^(Why\?|Explanation:?)\s*\n?", "", exp).strip()
                answers[cur_num] = {"letter": letter, "explanation": exp}
        cur_num = cur_letter = fallback_letter = None
        lines = []

    for p in paragraphs:
        s = p.strip()
        if LECTURE_RE.match(s):
            continue
        m = NUM_RE.match(s)
        if m:
            flush()
            cur_num = int(m.group(1))
            continue
        m = ANS_RE.match(s)
        if m and cur_num:
            cur_letter = m.group(1).upper()
            continue
        # Record first bare choice line as fallback answer (before "Answer:" seen).
        if cur_num and cur_letter is None and fallback_letter is None:
            bm = BARE_RE.match(s)
            if bm:
                fallback_letter = bm.group(1).upper()
        if cur_num and (cur_letter or fallback_letter):
            lines.append(s)
    flush()
    return answers


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--questions", required=True)
    ap.add_argument("--answer-key", required=True)
    ap.add_argument("--public-dir", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    hen2_dir = os.path.join(args.public_dir, "hen2")
    questions = extract_questions(args.questions, hen2_dir)
    answers = extract_answers(args.answer_key)

    merged = []
    dropped = []
    for r in questions:
        a = answers.get(r["number"])
        if not r["stem"] or not r["choices"]:
            dropped.append((r["number"], "no stem/choices"))
            continue
        if not a or not a.get("letter"):
            dropped.append((r["number"], "no answer"))
            continue
        letters = [c[0] for c in r["choices"]]
        if a["letter"] not in letters:
            dropped.append((r["number"], f"answer {a['letter']} not in {letters}"))
            continue
        merged.append({
            "lecture": r["lecture"],
            "number": r["number"],
            "stem": r["stem"],
            "choices": r["choices"],
            "correct": a["letter"],
            "explanation": a.get("explanation", "") or "",
            "topic": "",
            "images": r["images"],
        })

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False)

    with_img = sum(1 for r in merged if r["images"])
    print(f"extracted {len(merged)} questions ({with_img} with images) → {args.out}",
          file=sys.stderr)
    print(f"images saved to {hen2_dir}", file=sys.stderr)
    if dropped:
        print(f"dropped {len(dropped)}: {dropped}", file=sys.stderr)


if __name__ == "__main__":
    main()
