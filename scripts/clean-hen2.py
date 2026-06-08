#!/usr/bin/env python3
"""
Clean + finalize the HEN-2 records produced by extract-hen2-with-images.py.

Does, in order:
  1. Unicode ligature normalization (ﬁ ﬀ ﬂ → fi ff fl, etc.)
  2. Safe global spelling fixes for misspelled drug names.
  3. Mechanical grammar fixes: space after period/comma, collapse whitespace,
     un-fuse known run-together words, strip the trailing "(Author)" tag into
     the topic field, capitalize the first letter, ensure a trailing "?".
  4. Targeted per-question stem/choice rewrites for genuinely broken items.
  5. Attach [[image:...]] tokens (with real pixel dimensions) to the questions
     that had figures, appended after the stem.

Usage:
  python3 scripts/clean-hen2.py --in /tmp/hen2-img-records.json --out /tmp/hen2-final.json
"""
import argparse
import json
import re
import sys

LIGATURES = {
    "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl",
    "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st",
}

# Safe, unambiguous drug/term spelling corrections (whole-word, case-insensitive
# where sensible). Applied to stems AND choices.
SPELLING = {
    r"\bPropanolol\b": "Propranolol",
    r"\bDiatiazem\b": "Diltiazem",
    r"\bCarvidelol\b": "Carvedilol",
    r"\bBrococriptine\b": "Bromocriptine",
    r"\bOsteoporesis\b": "Osteoporosis",
    r"\bCalcitoin\b": "Calcitonin",
    r"\bPinadronate\b": "Pamidronate",
    r"\bPalmidronate\b": "Pamidronate",
    r"\bPalmidronate\b": "Pamidronate",
    r"\bGantorelix\b": "Ganirelix",
    r"\bPegvisolant\b": "Pegvisomant",
    r"\bLiothrix\b": "Liotrix",
    r"\badrenocorticol\b": "adrenocortical",
    r"\bUnintestinal\b": "Unintentional",
    r"\bcachetic\b": "cachectic",
    r"\bmusclewasting\b": "muscle wasting",
    r"\bperipheraledema\b": "peripheral edema",
    r"\bTSHlevel\b": "TSH level",
    r"\bH&Eslide\b": "H&E slide",
    r"\bandfacial\b": "and facial",
    r"\bweightgain\b": "weight gain",
    r"\bmicrofollicle\b": "microfollicles",
    r"\boccured\b": "occurred",
}

# Specific stem replacements (full stem text, applied after mechanical cleanup).
STEM_FIXES = {
    12: "A 34-year-old man reports a 3-size increase in shoe size and blurred vision over 3 years. Examination reveals a broad nose, frontal bossing, macroglossia, and a prominent lower jaw. MRI shows a 3.4 cm pituitary adenoma. Which of the following conditions is most likely to occur in this patient?",
    13: "A 25-year-old woman presents with breast secretion and no history of pregnancy. MRI shows an adenohypophyseal mass. Which of the following hormones is most likely involved?",
    23: "A 5-year-old girl presents with short stature and delayed bone age. After she is started on “drug A”, she develops hypoglycemia. What is “drug A”?",
    36: "A 34-year-old man presents with palpitations, headache, and blurred vision, with high blood pressure. Laboratory studies reveal normal aldosterone, renin, and angiotensin levels, but elevated 24-hour urine metanephrines. What is the cell of origin of this patient's tumor?",
    37: "A 42-year-old woman presents with progressive fatigue, unintentional weight loss, salt cravings, dizziness on standing, nausea, and intermittent abdominal discomfort for 3 months. On examination, BP is 92/58 mmHg with increased pigmentation of the palmar creases and oral mucosa. Which of the following is the most likely diagnosis?",
    38: "A 45-year-old woman presented with a painless mass on the right side of the neck 8 months ago. She reports occasional dizziness when turning her head to the right and a pulsating sound in her right ear. Examination shows a firm, non-tender mass just below the right mandible. After surgery, the histology of the mass is shown. What is the most likely diagnosis?",
    39: "Which of the following is the least likely to cause Cushingoid features?",
    124: "A patient with type 1 diabetes mellitus presents with deep, labored breathing and a fruity odor on the breath. Laboratory results are shown. What is the most likely diagnosis?",
    128: "A 58-year-old man with known type 2 diabetes mellitus presents to the emergency department feeling drowsy. His home blood glucose monitoring has recently averaged about 450 mg/dL, and his recent HbA1c was 12%. The blood results obtained in hospital are shown. What is the most likely diagnosis?",
    125: "A 58-year-old man with known type 2 diabetes mellitus presents to the emergency department feeling drowsy. His home blood glucose monitoring has recently averaged about 450 mg/dL, and his recent HbA1c was 12%. The blood results obtained in hospital are shown. What is the most likely diagnosis?",
}

# Specific choice replacements: {qnum: {letter: new_text}}
CHOICE_FIXES = {
    28: {"C": "Bacterial septicemia"},
    150: {"B": "Bacterial infection (cellulitis)"},
}

AUTHOR_RE = re.compile(r"\s*\(([A-Za-z][A-Za-z,&/ .]*)\)\s*$")
QUESTION_HINT = re.compile(
    r"(which|what|how|when|where|why|most likely|most appropriate|"
    r"best|cause|diagnosis|treatment|mechanism)",
    re.IGNORECASE,
)


def fix_ligatures(s):
    for k, v in LIGATURES.items():
        s = s.replace(k, v)
    return s


def fix_spelling(s):
    for pat, repl in SPELLING.items():
        s = re.sub(pat, repl, s, flags=re.IGNORECASE)
    return s


def mechanical(s):
    s = fix_ligatures(s)
    # space after sentence punctuation glued to a capital letter / next word
    s = re.sub(r"([a-z0-9\)’'])\.([A-Z])", r"\1. \2", s)
    s = re.sub(r"([a-z0-9])\?([A-Z])", r"\1? \2", s)
    s = re.sub(r"([a-z])\,([A-Za-z])", r"\1, \2", s)
    # collapse whitespace
    s = re.sub(r"\s+", " ", s).strip()
    s = fix_spelling(s)
    return s


THAI_META_RE = re.compile(r"\(\s*(?:ไม่ระบุปี|ปี\s*\d+|\d{2,4})\s*\)")


def clean_stem(s):
    # strip Thai "year not specified" / year metadata tags anywhere in the stem
    s = THAI_META_RE.sub("", s)
    s = mechanical(s)
    # strip trailing author tag → return (stem, author)
    author = None
    m = AUTHOR_RE.search(s)
    if m:
        author = m.group(1).strip()
        s = s[: m.start()].strip()
    # capitalize first letter
    if s and s[0].islower():
        s = s[0].upper() + s[1:]
    # ensure terminal punctuation; add "?" if it looks like a question
    if s and s[-1] not in ".?:":
        s += "?" if QUESTION_HINT.search(s) else "."
    # normalize a trailing " ." or " ?"
    s = re.sub(r"\s+([?.])$", r"\1", s)
    return s, author


def clean_choice(text):
    text = mechanical(text)
    if text and text[0].islower():
        # keep drug names lower? capitalize first letter for consistency
        text = text[0].upper() + text[1:]
    return text


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="in_path", required=True)
    ap.add_argument("--out", dest="out_path", required=True)
    ap.add_argument("--image-base", default="/hen2")
    args = ap.parse_args()

    recs = json.load(open(args.in_path))
    out = []
    for r in recs:
        n = r["number"]
        stem, author = clean_stem(r["stem"])
        if n in STEM_FIXES:
            stem = STEM_FIXES[n]

        choices = []
        cfix = CHOICE_FIXES.get(n, {})
        for letter, text in r["choices"]:
            new = cfix.get(letter)
            choices.append([letter, new if new else clean_choice(text)])

        # Attach image tokens after the stem.
        imgs = r.get("images") or []
        if imgs:
            tokens = []
            for im in imgs:
                fname = im["file"] if isinstance(im, dict) else im
                w = im.get("w", 0) if isinstance(im, dict) else 0
                h = im.get("h", 0) if isinstance(im, dict) else 0
                if not w or not h:
                    w, h = 800, 600
                alt = f"Question {n} figure"
                tokens.append(f"[[image:{args.image_base}/{fname}|{w}x{h}|{alt}]]")
            stem = stem + "\n" + " ".join(tokens)

        out.append({
            "lecture": r["lecture"],
            "number": n,
            "stem": stem,
            "choices": choices,
            "correct": r["correct"],
            "explanation": fix_ligatures(r.get("explanation", "") or ""),
            "topic": author or "",
        })

    out.sort(key=lambda r: r["number"])
    json.dump(out, open(args.out_path, "w"), ensure_ascii=False)
    with_img = sum(1 for r in out if "[[image:" in r["stem"])
    print(f"cleaned {len(out)} questions ({with_img} with image tokens) → {args.out_path}",
          file=sys.stderr)


if __name__ == "__main__":
    main()
