#!/usr/bin/env python3
"""
Extract HMS-2 questions, answers, explanations, and figures from the two source
DOCX files.

The HMS-2 files are table-based:
  question doc:  No | Question | Choices
  answer key:    No | Question | Choices | Explaination

Outputs JSON records compatible with build-hms2-xlsx.ts. Any Thai notes found in
question/explanation text are translated to English here so the workbook imports
without Thai text.
"""
import argparse
import io
import json
import os
import re
import zipfile
from xml.etree import ElementTree as ET

try:
    from PIL import Image
    HAVE_PIL = True
except ImportError:
    HAVE_PIL = False

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"

NUM_RE = re.compile(r"^\s*(\d+)\s*$")
LECTURE_RE = re.compile(r"^LT\s*\d+\s*[:\-–]\s*.+", re.IGNORECASE)
THAI_RE = re.compile(r"[\u0E00-\u0E7F]")
ANSWER_RE = re.compile(r"Answer:\s*([A-Fa-f])\s*[\.\)]?", re.IGNORECASE)


def cell_text(tc):
    parts = []
    for p in tc.iter(f"{W}p"):
        runs = [t.text or "" for t in p.iter(f"{W}t")]
        text = "".join(runs).strip()
        if text:
            parts.append(text)
    return "\n".join(parts).strip()


def cell_image_rids(tc):
    out = []
    for blip in tc.iter(f"{A}blip"):
        rid = blip.get(f"{R}embed") or blip.get(f"{R}link")
        if rid:
            out.append(rid)
    return out


def table_rows(docx_path):
    with zipfile.ZipFile(docx_path) as z:
        rels = ET.fromstring(z.read("word/_rels/document.xml.rels"))
        rid_map = {rel.get("Id"): rel.get("Target") for rel in rels}
        doc = ET.fromstring(z.read("word/document.xml"))
    tbl = next(doc.iter(f"{W}tbl"))
    rows = []
    for tr in tbl.findall(f"{W}tr"):
        cells = tr.findall(f"{W}tc")
        rows.append((cells, [cell_text(tc) for tc in cells]))
    return rows, rid_map


def split_choice_line(line):
    # Handles "A. Foo B. Bar", "A.Foo", "A) Foo", and "A . Foo".
    marker_re = re.compile(r"(?<![A-Za-z])([A-F])\s*[\.\)]\s*", re.IGNORECASE)
    matches = list(marker_re.finditer(line))
    if len(matches) < 2:
        return []
    letters = [m.group(1).upper() for m in matches]
    if letters[0] != "A":
        return []
    out = []
    for i, m in enumerate(matches):
        expected = chr(ord("A") + i)
        letter = m.group(1).upper()
        if letter != expected:
            return []
        end = matches[i + 1].start() if i + 1 < len(matches) else len(line)
        text = line[m.end():end].strip().rstrip(".").strip()
        if text:
            out.append((letter, text))
    return out


def split_expected_markers(line):
    # Handles tightly glued strings like "A) Vitamin DB) ZincC) Pyridoxine".
    # Search for A/B/C/... markers in order; the next expected marker is the
    # delimiter, so a choice text containing "Vitamin D" does not matter until
    # the next marker is literally "B)".
    marker_positions = []
    search_from = 0
    for i in range(6):
        letter = chr(ord("A") + i)
        m = re.compile(re.escape(letter) + r"\s*[\.\)]\s*", re.IGNORECASE).search(
            line,
            search_from,
        )
        if not m:
            break
        marker_positions.append((letter, m.start(), m.end()))
        search_from = m.end()
    if len(marker_positions) < 2:
        return []
    out = []
    for i, (letter, _start, end) in enumerate(marker_positions):
        text_end = (
            marker_positions[i + 1][1]
            if i + 1 < len(marker_positions)
            else len(line)
        )
        text = line[end:text_end].strip().rstrip(".").strip()
        if text:
            out.append((letter, text))
    return out


def parse_choices(raw):
    choices = []
    for line in raw.replace("\r", "\n").split("\n"):
        s = line.strip()
        if not s:
            continue
        multi = split_expected_markers(s) or split_choice_line(s)
        if multi:
            choices.extend(multi)
            continue
        numeric = re.match(r"^([1-6])\s*[\.\)]\s*(.+)$", s)
        if numeric:
            letter = chr(ord("A") + int(numeric.group(1)) - 1)
            choices.append((letter, numeric.group(2).strip().rstrip(".")))
            continue
        # Line-based fallback for source rows like "A Collagen type 1 defect".
        m = re.match(r"^([A-Fa-f])\s*(?:[\.\)]\s*)?(.+)$", s)
        if not m:
            continue
        letter = m.group(1).upper()
        expected = chr(ord("A") + len(choices))
        if letter == expected:
            choices.append((letter, m.group(2).strip().rstrip(".")))
    return choices


def parse_answer_markers(raw):
    out = []
    for line in raw.replace("\r", "\n").split("\n"):
        s = line.strip()
        if not s:
            continue
        numeric = re.match(r"^([1-6])\s*[\.\)]", s)
        if numeric:
            out.append(chr(ord("A") + int(numeric.group(1)) - 1))
            continue
        m = re.match(r"^([A-Fa-f])\s*[\.\)]", s)
        if m:
            out.append(m.group(1).upper())
    return out


def parse_answer_choice_texts(raw):
    out = []
    for line in raw.replace("\r", "\n").split("\n"):
        s = line.strip()
        if not s:
            continue
        numeric = re.match(r"^([1-6])\s*[\.\)]\s*(.+)$", s)
        if numeric:
            out.append((
                chr(ord("A") + int(numeric.group(1)) - 1),
                numeric.group(2).strip().rstrip("."),
            ))
            continue
        m = re.match(r"^([A-Fa-f])\s*[\.\)]\s*(.+)$", s)
        if m:
            out.append((m.group(1).upper(), m.group(2).strip().rstrip(".")))
    return out


def parse_correct_letters(choice_cell, explanation_cell):
    letters = parse_answer_markers(choice_cell)
    if letters:
        return letters
    found = [m.group(1).upper() for m in ANSWER_RE.finditer(explanation_cell or "")]
    return found


def clean_lecture(raw):
    # Drop the Thai provenance note under LT6; it is not part of the lecture name.
    return raw.split("\n", 1)[0].strip()


def translate_thai_notes(text, question_number):
    if not text:
        return text
    text = text.replace(
        "\u0028 \u0e44\u0e21\u0e48 MED Quinn \u0e01\u0e47 MED Flynt "
        "\u0e15\u0e49\u0e19\u0e17\u0e32\u0e07\u0e08\u0e33\u0e1b\u0e35"
        "\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49 \u003b-\u003b\u0029",
        "(source uncertain: MED Quinn or MED Flynt; original year not remembered)",
    )
    text = text.replace(
        "\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e40\u0e23\u0e35\u0e22"
        "\u0e19\u0e08\u0e49\u0e32",
        "Note: not covered in class.",
    )
    if question_number == 79 and THAI_RE.search(text):
        return (
            "The source key accepts both ultrasound diathermy and shortwave "
            "diathermy. The lecture slides do not state the difference between "
            "these modalities (lecture 6, page 18)."
        )
    if question_number == 89 and THAI_RE.search(text):
        return (
            "The source key accepts both A and B: denosumab and bisphosphonates "
            "(lecture 7, pages 28-29)."
        )
    return text


def clean_explanation(raw, question_number):
    s = translate_thai_notes(raw or "", question_number)
    s = s.replace("✅", "")
    s = re.sub(r"\s*/\s*", "\n", s)
    if "Why?" in s:
        s = s.split("Why?", 1)[1]
    else:
        s = re.sub(r"^Answer:\s*.*?(?:\n|$)", "", s, flags=re.IGNORECASE)
    s = re.sub(r"^\s*Why\?\s*", "", s, flags=re.IGNORECASE)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{2,}", "\n", s)
    return s.strip()


def extract_questions(question_docx, public_hms2_dir):
    rows, rid_map = table_rows(question_docx)
    z = zipfile.ZipFile(question_docx)
    os.makedirs(public_hms2_dir, exist_ok=True)

    records = []
    current_lecture = None
    saved = {}
    for cells, texts in rows:
        if len(texts) == 1 and LECTURE_RE.match(texts[0].strip()):
            current_lecture = clean_lecture(texts[0])
            continue
        if len(cells) < 3:
            continue
        m = NUM_RE.match(texts[0].strip())
        if not m:
            continue
        number = int(m.group(1))
        stem = re.sub(r"\s*\n\s*", " ", texts[1]).strip()
        stem = translate_thai_notes(stem, number)
        choices = parse_choices(texts[2])

        images = []
        for ci in (1, 2):
            for rid in cell_image_rids(cells[ci]):
                target = rid_map.get(rid)
                if not target:
                    continue
                if target in saved:
                    images.append(saved[target])
                    continue
                blob = z.read("word/" + target)
                ext = os.path.splitext(target)[1].lower() or ".png"
                fname = f"q{number:03d}-{len(images) + 1}{ext}"
                path = os.path.join(public_hms2_dir, fname)
                with open(path, "wb") as f:
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
                images.append(rec)

        records.append({
            "lecture": current_lecture,
            "number": number,
            "stem": stem,
            "choices": [list(c) for c in choices],
            "images": images,
        })
    return records


def extract_answers(answer_key_docx):
    rows, _rid_map = table_rows(answer_key_docx)
    answers = {}
    for _cells, texts in rows:
        if len(texts) < 4:
            continue
        m = NUM_RE.match(texts[0].strip())
        if not m:
            continue
        number = int(m.group(1))
        letters = parse_correct_letters(texts[2], texts[3])
        if not letters:
            continue
        answers[number] = {
            "letters": letters,
            "answer_choices": parse_answer_choice_texts(texts[2]),
            "explanation": clean_explanation(texts[3], number),
        }
    return answers


def normalize_choice_text(text):
    return re.sub(r"\s+", " ", text.strip().rstrip(".")).casefold()


def remap_answer_letters(answer, question_choices):
    if not answer.get("answer_choices"):
        return answer["letters"]

    by_letter = {letter: text for letter, text in question_choices}
    by_text = {normalize_choice_text(text): letter for letter, text in question_choices}
    by_answer_letter = {letter: text for letter, text in answer["answer_choices"]}

    remapped = []
    for letter in answer["letters"]:
        text = by_answer_letter.get(letter)
        mapped = None
        if text:
            if normalize_choice_text(by_letter.get(letter, "")) == normalize_choice_text(text):
                mapped = letter
            else:
                mapped = by_text.get(normalize_choice_text(text))
        remapped.append(mapped or letter)
    return list(dict.fromkeys(remapped))


def attach_image_tokens(stem, number, images, image_base):
    if not images:
        return stem
    tokens = []
    for im in images:
        w = im.get("w") or 800
        h = im.get("h") or 600
        tokens.append(
            f"[[image:{image_base}/{im['file']}|{w}x{h}|Question {number} figure]]"
        )
    return stem + "\n" + " ".join(tokens)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--questions", required=True)
    ap.add_argument("--answer-key", required=True)
    ap.add_argument("--public-dir", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--image-base", default="/hms2")
    args = ap.parse_args()

    hms2_dir = os.path.join(args.public_dir, "hms2")
    questions = extract_questions(args.questions, hms2_dir)
    answers = extract_answers(args.answer_key)

    merged = []
    dropped = []
    for q in questions:
        number = q["number"]
        answer = answers.get(number)
        if number == 28 and not answer:
            # Source key says "bruh" but the explanation identifies polymyositis;
            # add it as the missing completion choice so the row is testable.
            q["choices"].append(["E", "Polymyositis"])
            answer = {
                "letters": ["E"],
                "explanation": (
                    "The picture may suggest Pompe disease, but the SLE history "
                    "and endomysial lymphocytic infiltration invading individual "
                    "muscle fibers are most consistent with polymyositis. "
                    "Glycogen-storage diseases typically cause exertional weakness."
                ),
            }
        if not answer:
            dropped.append((number, "no answer"))
            continue
        if not q["choices"]:
            dropped.append((number, "no choices"))
            continue
        letters = [c[0] for c in q["choices"]]
        answer_letters = remap_answer_letters(answer, q["choices"])
        correct = answer_letters[0]
        if correct not in letters:
            dropped.append((number, f"answer {correct} not in choices {letters}"))
            continue
        stem = attach_image_tokens(q["stem"], number, q["images"], args.image_base)
        merged.append({
            "lecture": q["lecture"],
            "number": number,
            "stem": stem,
            "choices": q["choices"],
            "correct": correct,
            "allCorrect": answer_letters,
            "explanation": answer["explanation"],
            "topic": "",
        })

    thai_left = [
        r["number"]
        for r in merged
        if THAI_RE.search(
            " ".join(
                [r["stem"], r["explanation"]]
                + [choice[1] for choice in r["choices"]]
            )
        )
    ]

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)

    with_images = sum(1 for r in merged if "[[image:" in r["stem"])
    print(f"extracted {len(merged)} questions ({with_images} with images) -> {args.out}")
    print(f"images saved to {hms2_dir}")
    if dropped:
        print(f"dropped {len(dropped)}: {dropped}")
    if thai_left:
        raise SystemExit(f"Thai text remains in records: {thai_left}")


if __name__ == "__main__":
    main()
