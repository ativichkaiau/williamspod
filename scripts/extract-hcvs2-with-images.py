#!/usr/bin/env python3
"""
Table-aware extraction of the HCVS-2 (cardiovascular) question bank + answer key
+ figures, emitting records in the WilliamsPod build shape.

The two source docx files each hold ONE table:
  - questions:   No. | Questions | Choices          (figures live in the Q cell)
  - answer key:  No. | Questions | Choices | Explaination
Lecture headers are single-cell rows ("Lt.1 ...", "Active learning : ...").

Figures are extracted from the QUESTIONS docx (its media numbering is what the
question cell references) into <public-dir>/hcvs2/ as q<NN>-<seq>.<ext>, and
embedded into the stem as the renderer's token: [[image:hcvs2/q01-1.jpg|WxH|alt]].

A small curated PATCH layer fixes the issues found on a full read of the bank:
unclear grammar, typos, ambiguous/mislabelled answers, and Thai-only or
Thai-primary explanations that had to be (re)written in English. Every patched
item is printed at the end so it can be spot-checked.

Usage:
  python3 scripts/extract-hcvs2-with-images.py \\
    --questions  ".work/hcvs/CodeX HCVS-2 Aubrynn.docx" \\
    --answer-key ".work/hcvs/ANSWER KEY CodeX HCVS-2 Aubrynn.docx" \\
    --public-dir public \\
    --out .work/hcvs/hcvs2-records.json
"""
import argparse
import io
import json
import os
import re
import sys
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
THAI_RE = re.compile(r"[฀-๿]")

# --- lecture header -> (sheet/lecture name <=31 chars, topic) ------------------
# Keyed by the leading Lt. number; "AL" is the Active-learning insert after Lt.3.
LECTURES = {
    1:  ("LT1-2 Dysrhythmia & ECGs", "Dysrhythmia & ECG"),
    3:  ("LT3 Congenital Heart Disease", "Congenital heart disease"),
    "AL": ("LT3b Antiarrhythmic (AL)", "Antiarrhythmic drugs"),
    4:  ("LT4 Vascular Disorders 1", "Vascular disorders"),
    5:  ("LT5+9 Ischemic Heart Disease", "Ischemic heart disease"),
    6:  ("LT6 Chronic Stable Angina Rx", "Antianginal drugs"),
    7:  ("LT7 Antithrombotic Drugs", "Antiplatelets & anticoagulants"),
    8:  ("LT8 Dyslipidemia Drugs", "Dyslipidemia drugs"),
    10: ("LT10 Valvular & Rheumatic HD", "Valvular & rheumatic heart disease"),
    11: ("LT11 Cardiomyopathy & Myocard", "Cardiomyopathy & myocarditis"),
    12: ("LT12 Shock & Cardiac Arrest", "Shock & cardiac arrest"),
    13: ("LT13 Inotropes & Vasopressors", "Inotropes & vasopressors"),
    14: ("LT14 HF Pathophysiology", "Heart failure - pathophysiology"),
    15: ("LT15 HF Pathology", "Heart failure - pathology"),
    16: ("LT16 Heart Failure Drugs", "Heart failure drugs"),
    17: ("LT17 Hypertension", "Hypertension"),
    18: ("LT18 Antihypertensive Drugs", "Antihypertensive drugs"),
    19: ("LT19 Vascular Disorders 2", "Vasculitis & vascular disorders"),
    20: ("LT20 Pericardium & Tumors", "Pericardial disease & cardiac tumors"),
}

AUTHOR_TAG_RE = re.compile(
    r"\s*\(\s*(?:Blythe|Lalynn|Llyr|Aileen)"
    r"(?:\s*,\s*(?:Blythe|Lalynn|Llyr|Aileen))*\s*\)\s*",
    re.IGNORECASE,
)

TYPO = {
    "Temponade": "Tamponade",
    "Isoproferenol": "Isoproterenol",
    "Isosorbide dinitrates": "Isosorbide dinitrate",
    "Increase pulmonary bloodflow": "Increase pulmonary blood flow",
    "artherosclerotic": "atherosclerotic",
    "Fixed Slit S2": "Fixed Split S2",
    "Concave pulmonary arterial segmental": "Concave pulmonary arterial segment",
    "in a image": "in an image",
    "Right  Bundle": "Right Bundle",
}

# --- curated patches (applied after auto-parse) --------------------------------
# stem: replace the whole cleaned stem text (image token re-appended after).
STEM_PATCHES = {
    7: ("A 2-year-old boy presents with central cyanosis, tachycardia, a "
        "pansystolic murmur at the left lower sternal border, cardiomegaly, "
        "increased lung vascularity, and superior mediastinal narrowing. "
        "What is the diagnosis?"),
    68: ("A 60-year-old man with a history of ischemic cardiomyopathy (EF 25%) "
         "and chronic right-sided heart failure dies from decompensated heart "
         "failure. Autopsy of the liver shows marked centrilobular (zone 3) "
         "congestion and necrosis. What is the most consistent gross appearance "
         "of the liver caused by right-sided heart failure?"),
    93: ("A 42-year-old man with a 20-pack-year smoking history presents with "
         "painful ischemic ulcers and black discoloration of several fingertips. "
         "He also reports intermittent claudication of the hands and feet. "
         "Physical examination shows distal digital gangrene and diminished "
         "distal pulses. There is no history of diabetes or hyperlipidemia. "
         "What is the most likely diagnosis?"),
    106: ("A 28-year-old woman with systemic lupus erythematosus (SLE) presents "
          "with pleuritic chest pain that improves when leaning forward. A "
          "pericardial friction rub is heard on examination. Echocardiography "
          "shows a small pericardial effusion. Which type of pericarditis is "
          "most commonly associated with SLE?"),
}

# correct-letter override (auto-parse got a non-letter or the wrong token).
CORRECT_PATCHES = {
    8: "E",   # key double-lists A. LVH + E. ↑pulmonary blood flow; E chosen as primary
    22: "A",  # key marks E then A; explanation = decreased preload -> A
    60: "B",  # key wrote "2. Phenylephrine"; option B is Phenylephrine
}

# explanation: full replacement in clean English (Thai-only/primary or reworked).
EXPL_PATCHES = {
    1: ("The ECG shows ST-segment elevation in the anterior precordial leads "
        "(V2-V4) together with tall, broad hyperacute T waves - an early sign of "
        "acute anterior wall MI (it precedes fully developed ST elevation). Rate "
        "is about 100/min and the rhythm is irregular with PVCs."),
    8: ("The picture (continuous machinery murmur, heart-failure symptoms in "
        "infancy) is a patent ductus arteriosus (PDA) - a left-to-right shunt. "
        "PDA is not offered as a choice; among the options the shunt's increased "
        "pulmonary blood flow is the best answer. The same left-to-right shunt "
        "also causes left ventricular hypertrophy (A) from chronic left-heart "
        "volume overload, so LVH is a defensible alternative - this item is "
        "effectively double-keyed."),
    22: ("At standard doses sublingual nitroglycerin acts mainly as a venodilator. "
         "Venous pooling reduces venous return, so the PRIMARY mechanism of angina "
         "relief is decreased preload, which lowers myocardial oxygen demand. "
         "(A modest increase in coronary blood flow also contributes but is not "
         "the principal effect.)"),
    39: ("The image shows mitral valve prolapse. Recognized complications include "
         "infective endocarditis, mitral regurgitation (which can progress to "
         "left-sided heart failure), atrial fibrillation and other arrhythmias, "
         "and, rarely, sudden death. Infective endocarditis is the complication "
         "highlighted here."),
    60: ("Phenylephrine is a pure alpha-1 adrenergic agonist, so it raises blood "
         "pressure only by increasing systemic vascular resistance "
         "(vasoconstriction), with no beta-1 inotropic or chronotropic support "
         "for the heart itself."),
    90: ("A young Asian woman with 'pulseless disease' (weak upper-extremity "
         "pulses, arm claudication, an inter-arm blood-pressure difference) plus "
         "granulomatous arterial inflammation is the classic picture of Takayasu "
         "arteritis, which affects the aortic arch and its major branches."),
}


def cell_text(tc):
    parts = []
    for p in tc.iter(f"{W}p"):
        runs = [t.text or "" for t in p.iter(f"{W}t")]
        if runs:
            parts.append("".join(runs))
    return "\n".join(parts)


def cell_blip_rids(tc):
    out = []
    for blip in tc.iter(f"{A}blip"):
        rid = blip.get(f"{R}embed") or blip.get(f"{R}link")
        if rid and rid not in out:
            out.append(rid)
    return out


def flatten(text):
    return re.sub(r"\s+", " ", text.replace("\n", " ")).strip()


def split_choices(text):
    """'A. x B. y ...' (any spacing, markers may sit flush) -> [(A,x),(B,y),...].
    Searches for each expected marker letter in sequence, so stray capitals and
    ':'/';' inside a choice never split it."""
    flat = flatten(text)
    marks = []  # (letter, start, end)
    frm = 0
    for i in range(6):
        letter = chr(ord("A") + i)
        m = re.compile(re.escape(letter) + r"[\.\)]").search(flat, frm)
        if not m:
            break
        marks.append((letter, m.start(), m.end()))
        frm = m.end()
    if len(marks) < 2:
        return []
    out = []
    for i, (letter, _s, end) in enumerate(marks):
        text_end = marks[i + 1][1] if i + 1 < len(marks) else len(flat)
        choice = flat[end:text_end].strip().strip(".").strip()
        if choice:
            out.append((letter, choice))
    return out


def fix_text(t):
    """Grammar/typo cleanup shared by stems, choices, explanations."""
    for a, b in TYPO.items():
        t = t.replace(a, b)
    # insert a missing space after . ? : when a lowercase/digit is glued to a capital
    t = re.sub(r"([a-z0-9\)])([.?:])([A-Z])", r"\1\2 \3", t)
    t = re.sub(r"[ \t]{2,}", " ", t)
    return t.strip()


def clean_stem(t):
    t = t.replace("***", " ")
    t = AUTHOR_TAG_RE.sub(" ", t)
    t = flatten(t)
    # a stray answer letter left dangling after the tag, e.g. "... SLE? B"
    t = re.sub(r"\?\s+[A-E]\s*$", "?", t)
    return fix_text(t)


def clean_expl(t):
    m = THAI_RE.search(t)
    if m:
        t = t[: m.start()]
    t = re.sub(r"^\s*(Explanation|Explaination)\s*:?\s*", "", t, flags=re.IGNORECASE)
    t = flatten(t)
    t = re.sub(r"\(\s*\)", "", t)
    return fix_text(t)


def save_images(z, rid_map, rids, number, out_dir, saved):
    files = []
    for rid in rids:
        target = rid_map.get(rid)
        if not target:
            continue
        if target in saved:
            files.append(saved[target])
            continue
        blob = z.read("word/" + target)
        ext = os.path.splitext(target)[1].lower() or ".png"
        fname = f"q{number:02d}-{len(files) + 1}{ext}"
        with open(os.path.join(out_dir, fname), "wb") as f:
            f.write(blob)
        w = h = 0
        if HAVE_PIL:
            try:
                with Image.open(io.BytesIO(blob)) as im:
                    w, h = im.size
            except Exception:
                pass
        rec = {"file": fname, "w": w or 800, "h": h or 600}
        saved[target] = rec
        files.append(rec)
    return files


def parse_questions(path, out_dir):
    z = zipfile.ZipFile(path)
    rels = ET.fromstring(z.read("word/_rels/document.xml.rels"))
    rid_map = {r.get("Id"): r.get("Target") for r in rels}
    body = ET.fromstring(z.read("word/document.xml")).find(f"{W}body")
    tbl = body.find(f"{W}tbl")
    os.makedirs(out_dir, exist_ok=True)
    saved = {}
    rows = {}
    lecture = None
    for tr in tbl.findall(f"{W}tr"):
        cells = tr.findall(f"{W}tc")
        if len(cells) == 1:
            head = flatten(cell_text(cells[0]))
            if head.lower().startswith("active learning"):
                lecture = "AL"
            else:
                m = re.match(r"Lt\.?\s*(\d+)", head, re.IGNORECASE)
                if m:
                    lecture = int(m.group(1))
            continue
        if len(cells) < 3:
            continue
        nm = NUM_RE.match(flatten(cell_text(cells[0])))
        if not nm:
            continue
        number = int(nm.group(1))
        stem = clean_stem(cell_text(cells[1]))
        choices = [
            (l, fix_text(txt)) for l, txt in split_choices(cell_text(cells[2]))
        ]
        rids = cell_blip_rids(cells[1]) + [
            r for r in cell_blip_rids(cells[2]) if r not in cell_blip_rids(cells[1])
        ]
        images = save_images(z, rid_map, rids, number, out_dir, saved)
        rows[number] = {
            "lecture": lecture,
            "number": number,
            "stem": stem,
            "choices": choices,
            "images": images,
        }
    return rows


def parse_answers(path):
    z = zipfile.ZipFile(path)
    body = ET.fromstring(z.read("word/document.xml")).find(f"{W}body")
    tbl = body.find(f"{W}tbl")
    out = {}
    for tr in tbl.findall(f"{W}tr"):
        cells = tr.findall(f"{W}tc")
        if len(cells) < 4:
            continue
        nm = NUM_RE.match(flatten(cell_text(cells[0])))
        if not nm:
            continue
        number = int(nm.group(1))
        correct_cell = flatten(cell_text(cells[2]))
        m = re.search(r"([A-E])[\.\)]", correct_cell)
        letter = m.group(1) if m else None
        out[number] = {
            "letter": letter,
            "correct_text": correct_cell,
            "explanation": cell_text(cells[3]),
        }
    return out


def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--questions", required=True)
    ap.add_argument("--answer-key", required=True)
    ap.add_argument("--public-dir", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    out_dir = os.path.join(args.public_dir, "hcvs2")
    q = parse_questions(args.questions, out_dir)
    a = parse_answers(args.answer_key)

    records, warnings, patched = [], [], []
    for number in sorted(q):
        r = q[number]
        ans = a.get(number, {})
        lecture_key = r["lecture"]
        sheet, topic = LECTURES.get(lecture_key, (f"LT? {lecture_key}", ""))

        stem = r["stem"]
        if number in STEM_PATCHES:
            stem = STEM_PATCHES[number]
            patched.append(f"  Q{number}: stem rewritten")

        choices = r["choices"]
        letters = [c[0] for c in choices]

        correct = CORRECT_PATCHES.get(number) or ans.get("letter")
        if number in CORRECT_PATCHES:
            patched.append(
                f"  Q{number}: correct set to {correct} "
                f"(key had '{ans.get('correct_text', '')[:40]}')"
            )

        if not correct or correct not in letters:
            warnings.append(f"Q{number}: correct '{correct}' not in {letters}")
            continue
        if len(choices) < 2:
            warnings.append(f"Q{number}: only {len(choices)} choices")
            continue

        # sanity: key's correct-choice text should resemble our choice at `correct`
        if number not in CORRECT_PATCHES and ans.get("correct_text"):
            key_txt = norm(re.sub(r"^[A-E][\.\)]", "", ans["correct_text"]))
            our_txt = norm(dict(choices)[correct])
            if key_txt and our_txt and key_txt[:14] not in our_txt and our_txt[:14] not in key_txt:
                warnings.append(
                    f"Q{number}: answer-key text vs choice {correct} mismatch "
                    f"(key='{ans['correct_text'][:38]}' choice='{dict(choices)[correct][:38]}')"
                )

        explanation = EXPL_PATCHES.get(number) or clean_expl(ans.get("explanation", ""))
        if number in EXPL_PATCHES:
            patched.append(f"  Q{number}: explanation rewritten (Thai-only/reworked)")
        if not explanation:
            warnings.append(f"Q{number}: empty explanation")

        # append figure token(s) after the stem
        for i, im in enumerate(r["images"], start=1):
            alt = f"Question {number} figure" + (f" {i}" if len(r["images"]) > 1 else "")
            stem = f"{stem}\n[[image:hcvs2/{im['file']}|{im['w']}x{im['h']}|{alt}]]"

        records.append({
            "lecture": sheet,
            "number": number,
            "stem": stem,
            "choices": [list(c) for c in choices],
            "correct": correct,
            "explanation": explanation,
            "topic": topic,
        })

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=0)

    with_img = sum(1 for r in records if "[[image:" in r["stem"])
    print(f"extracted {len(records)}/{len(q)} questions "
          f"({with_img} with figures) -> {args.out}", file=sys.stderr)
    print(f"figures -> {out_dir}", file=sys.stderr)
    if patched:
        print("\nPATCHED (spot-check these):", file=sys.stderr)
        print("\n".join(patched), file=sys.stderr)
    if warnings:
        print(f"\nWARNINGS ({len(warnings)}):", file=sys.stderr)
        print("\n".join("  " + w for w in warnings), file=sys.stderr)


if __name__ == "__main__":
    main()
