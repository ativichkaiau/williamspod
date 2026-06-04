#!/usr/bin/env python3
"""
Translate the Thai-stem HNS-2 questions into English using the hand-curated
dictionary below. Reads the records JSON from `extract-hns2-from-docx.py`,
overwrites stems (and any Thai-language choices) with their English form, and
writes a new JSON with everything in English.

Usage:
  python3 scripts/translate-hns2.py \\
    --in  /tmp/hns2-records.json \\
    --out /tmp/hns2-records-en.json

Adding more translations: append to the `T` dict below, keyed by question
number (matches the `number` field in the input JSON).
"""
import argparse
import json
import re
import sys

# Each entry: stem (translated), then optional per-choice translations keyed by letter.
# Choices not in the dict are kept as-is (already English).
T = {
4: {
    "stem": "An image of a cross-section of the medulla highlights a structure. What is its function?",
    "choices": {
        "A": "Receives sensory information from the upper limb contralaterally",
        "B": "Receives sensory information from the lower limb contralaterally",
        "C": "Receives sensory information from the lower limb ipsilaterally",
        "D": "Receives sensory information from the upper limb ipsilaterally",
    },
},
6: {"stem": "If there is a lesion at this location (shown in image), what will result?"},
7: {
    "stem": "A patient presents with visual agnosia. Which Brodmann areas (visual association cortex) are damaged?",
},
8: {
    "stem": "A patient contralaterally ignores part of their body (hemispatial neglect). Where is the lesion located?",
},
10: {"stem": "Which numbered structure (in the image) is related to pain modulation?"},
13: {
    "stem": "An 80-year-old woman presents with sudden onset of hoarseness, dysarthria, and dysphagia. MRI shows a vascular defect at the medulla. A lesion of which structure causes these symptoms?",
},
14: {
    "stem": "A patient with a cerebral hemisphere lesion shows decorticate posturing. Which structure mediates the upper-extremity response in decorticate posturing?",
},
15: {
    "stem": "If a lesion occurs at this location (shown in image), what will happen?",
    "choices": {
        "A": "Spastic paralysis because of an LMN lesion",
        "B": "Flaccid paralysis because of a UMN lesion",
        "C": "Flaccid paralysis because of an LMN lesion",
        "D": "Spastic paralysis because of a UMN lesion",
    },
},
16: {
    "stem": "A patient cannot voluntarily protrude the tongue, but can do so involuntarily/spontaneously. Which cortical area is abnormal?",
},
18: {
    "stem": "A 35-year-old overweight man arrived unconscious. After recovery, examination shows spastic paralysis on the right side and ptosis on the left. Where is the lesion?",
},
24: {
    "stem": "A 55-year-old right-handed patient suddenly loses dexterity and control of the right hand (neglect syndrome features described). They also have right homonymous inferior quadrantanopia. Where is the lesion?",
},
25: {
    "stem": "If the doll's-eye phenomenon does not occur (rotating the head does not move the eyes in the opposite direction), which of the following is correct?",
},
33: {"stem": "What is the triad of Horner's syndrome?"},
37: {
    "stem": "A patient has Rinne negative bilaterally and Weber does not lateralize. Which structure is abnormal?",
},
41: {
    "stem": "A patient who eats raw pork has symptoms consistent with Streptococcus suis infection. Which of the imaging findings (shown) matches?",
},
43: {"stem": "A crescent-shaped lesion on head MRI is most consistent with which hemorrhage?"},
44: {
    "stem": "A 60-year-old presents with a large hemorrhage in the basal ganglia (involving the internal capsule). What is the most likely cause?",
},
45: {
    "stem": "A patient has ptosis, mydriasis, and the eye deviated down-and-out. Workup shows a compressive aneurysm. Which vessel gives rise to this aneurysm?",
},
46: {"stem": "Which vessel supplies the head of the caudate nucleus?"},
48: {
    "stem": "A 23-year-old woman has loss of touch and vibration plus spasticity in the right lower limb. On the left side, pinprick is lost from the level of the umbilicus downward. Where is the spinal cord lesion (vertebral level)?",
},
54: {"stem": "Cerebral contusions most commonly occur in which lobe?"},
57: {
    "stem": "If pyruvate dehydrogenase is deficient, which substance will be depleted?",
},
58: {
    "stem": "Glucose crosses the blood-brain barrier via which type of transport?",
},
61: {
    "stem": "A patient is described as most likely having retinoblastoma. Which of the following statements is correct?",
},
63: {
    "stem": "A 69-year-old woman has Alzheimer's disease. What is the most appropriate treatment?",
},
64: {
    "stem": "A woman has insomnia, headache, and palpitations from drinking energy drinks to stay productive. What is the mechanism of action of the responsible substance (caffeine)?",
},
65: {
    "stem": "A patient on oxycodone for pain stops the drug and develops GI symptoms and other findings of opioid withdrawal. Which drug should be given for maintenance/withdrawal management?",
},
70: {"stem": "What is the mechanism of action of Carbamazepine?"},
74: {
    "stem": "Which antiepileptic drug causes the pathology shown above (e.g. gingival hyperplasia, hirsutism — phenytoin-related findings)?",
},
75: {
    "stem": "Compared to older-generation antiepileptic drugs, what is a characteristic of newer-generation AEDs?",
},
76: {
    "stem": "A patient develops a rash while on Carbamazepine. What is an appropriate alternative AED?",
},
77: {
    "stem": "A pregnant patient on Valproate must switch antiepileptics. Which drug should she switch to?",
},
78: {"stem": "Which of the following is a plausible mechanism of action of an antiepileptic drug?"},
79: {"stem": "A patient has focal seizures. Which drug should be chosen?"},
83: {
    "stem": "A 20-year-old man developed a generalized erythematous rash after taking carbamazepine (image shown). What alternative AED can be used in this patient?",
},
86: {
    "stem": "The case describes classic Parkinson's disease (resting tremor, rigidity, bradykinesia, gait impairment). Which brain region and which neurotransmitter are abnormal?",
},
87: {"stem": "Which drug is used to treat drug-induced Parkinsonism?"},
88: {
    "stem": "A patient takes entacapone as part of Parkinson's disease therapy. Which enzyme is involved in its action?",
},
94: {
    "stem": "Histology shows a neoplasm with cystic and mural nodule architecture, long hair-like processes, and Rosenthal fibers. What is the diagnosis?",
},
97: {
    "stem": "Histology shows a neoplasm with necrosis, infiltrative growth, and pleomorphism. What is the diagnosis?",
},
99: {
    "stem": "A patient presents with hearing symptoms (CN VIII involvement). Which tumor is most likely?",
},
100: {
    "stem": "Histology shows cells with round nuclei and perinuclear halos near the ventricle. Immunohistochemistry is positive for synaptophysin. What is the most likely tumor? (Answer key marks D.)",
},
105: {"stem": "Which drug has the least ototoxicity?"},
106: {
    "stem": "An image shows acute otitis externa with intact tympanic membrane. Which treatment is appropriate?",
},
107: {
    "stem": "A patient has motion sickness. Which vestibular suppressant should be used?",
},
109: {"stem": "What is a side effect of Cinnarizine/Flunarizine?"},
111: {
    "stem": "A drug used in Ménière disease has the following mechanism: H3 receptor antagonist, partial H1 receptor agonist. Which drug is it?",
},
116: {
    "stem": "A 69-year-old woman is diagnosed with Alzheimer's disease. Which drug improves cognition and function?",
},
118: {
    "stem": "Why do beta-blockers commonly cause insomnia?",
},
119: {
    "stem": "A patient does not respond to voice stimulation but does respond to pain stimulation. Which level of consciousness?",
},
120: {
    "stem": "A patient shows disinhibition. Where is the lesion most likely located?",
},
121: {
    "stem": "In Alzheimer's disease, which cerebral lobe is typically affected first?",
},
131: {"stem": "How long does it typically take for Buspirone to take therapeutic effect?"},
133: {"stem": "Which is a side effect of ketamine?"},
134: {
    "stem": "A patient ingested 20 tablets of diazepam used to treat insomnia and anxiety. Which is the antidote for diazepam?",
},
135: {
    "stem": "A pilot has insomnia from jet lag. Which drug is most appropriate?",
},
136: {
    "stem": "A patient with hepatic impairment needs a sedative. Which drug can be used?",
    "choices": {"C": "Oxazepam", "D": "Temazepam"},
},
137: {"stem": "Ramelteon is used for jet lag. What is its mechanism of action?"},
138: {
    "stem": "A patient who must drive during the day has insomnia. Which hypnotic should be given?",
},
139: {"stem": "Which agent is used for anesthetic induction in children?"},
145: {"stem": "Which drug is used to prevent opioid craving (relapse prevention)?"},
146: {
    "stem": "Which opioid analgesic is preferred in a patient with sphincter of Oddi dysfunction?",
},
147: {
    "stem": "A patient with renal failure received an opioid and developed seizures. Which drug was given?",
},
149: {
    "stem": "A psychotic patient has QT prolongation. Which antipsychotic should be AVOIDED?",
},
151: {"stem": "Which antidepressant also helps the patient sleep?"},
152: {
    "stem": "A patient on Fluoxetine reports decreased libido and also wants to quit smoking. Which drug should be used?",
},
153: {"stem": "What is the most common side effect of TCAs (mechanism)?"},
154: {
    "stem": "For bipolar disorder, if lithium cannot be used, which drug is an appropriate alternative?",
},
155: {
    "stem": "For a diagnosis of Major Depressive Disorder (MDD), symptoms must persist for at least how long?",
    "choices": {
        "A": "14 days",
        "B": "2 months",
        "C": "4 months",
        "D": "6 months",
        "E": "1 year",
    },
},
160: {"stem": "Which histologic finding is associated with viral meningoencephalitis?"},
161: {
    "stem": "A patient had a genital ulcer a year ago. They now present with features of neurosyphilis (obliterative endarteritis, plasma cell-rich mass lesions of the cerebrum and spinal cord meninges, dementia, etc.). Which organism is responsible?",
},
162: {
    "stem": "Acute bacterial meningitis in a newborn. Which organism is the most likely cause?",
},
164: {"stem": "On histology of this CNS condition, what is the expected finding?"},
165: {
    "stem": "CSF analysis shows high neutrophils, low glucose, lactate 50. What is the diagnosis?",
},
166: {"stem": "Which is the most common organism cultured from adult CSF (community-acquired meningitis)?"},
168: {
    "stem": "On lumbar puncture, the CSF contains blood (RBCs present) but the patient has no history of trauma. What is the most likely diagnosis?",
},
}


THAI_RE = re.compile(r"[฀-๿]")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="in_path", required=True, help="records JSON from extract-hns2-from-docx.py")
    ap.add_argument("--out", dest="out_path", required=True, help="path to output translated JSON")
    args = ap.parse_args()

    records = json.load(open(args.in_path))

    translated_count = 0
    untranslated_thai = []
    out = []
    for r in records:
        if THAI_RE.search(r["stem"]):
            n = r["number"]
            if n not in T:
                untranslated_thai.append(n)
                continue  # drop questions we have no translation for
            rec = dict(r)
            rec["stem"] = T[n]["stem"]
            if "choices" in T[n]:
                new_choices = []
                for letter, text in rec["choices"]:
                    replacement = T[n]["choices"].get(letter)
                    new_choices.append([letter, replacement if replacement else text])
                rec["choices"] = new_choices
            out.append(rec)
            translated_count += 1
        else:
            out.append(r)

    out.sort(key=lambda r: r["number"])
    with open(args.out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)

    print(
        f"in: {len(records)}  translated: {translated_count}  out: {len(out)}",
        file=sys.stderr,
    )
    if untranslated_thai:
        print(
            f"!! dropped {len(untranslated_thai)} Thai-stem records without translations: "
            f"{untranslated_thai}",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
