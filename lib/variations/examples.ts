import type {
  AiVariationResponse,
  BaseQuestion,
  QuestionAngle,
} from "./types";

/**
 * A hand-written reference module: the canonical aortic-dissection example the
 * spec describes, showing the SAME concept probed from all eight angles. Used
 * by docs and by `scripts/variations-demo.ts` to sanity-check the pipeline
 * without any AI key. This is illustrative content — medically standard.
 */

export const EXAMPLE_BASE_QUESTION: BaseQuestion = {
  id: "example-aortic-dissection",
  lectureId: "example-lecture",
  stem: "A 62-year-old man presents with sudden, severe tearing chest pain radiating to the back. Which physical examination finding is most expected?",
  choices: [
    "Early diastolic murmur at the left sternal border",
    "Pansystolic murmur radiating to the axilla",
    "Fixed splitting of S2",
    "Pericardial friction rub",
  ],
  correctIndex: 0,
  explanation:
    "Ascending aortic dissection can extend to the aortic root and disrupt the aortic valve, producing acute aortic regurgitation — heard as an early diastolic murmur. The concept links the dissection site (aortic root) to valvular dysfunction (AR).",
  topic: "Aortic dissection → aortic regurgitation",
  difficulty: 3,
};

/**
 * The eight-angle variant set for the example, in the strict response shape a
 * provider would return. Every variant preserves the same learning objective
 * (aortic root involvement → acute AR) and does not alter medical truth.
 */
export const EXAMPLE_VARIATIONS: AiVariationResponse = {
  learningObjective:
    "Ascending aortic dissection involving the aortic root causes acute aortic regurgitation (early diastolic murmur).",
  variants: [
    {
      angle: "recall",
      difficulty: "easier",
      stem: "Which valvular lesion is classically associated with ascending aortic dissection?",
      choices: [
        "Acute aortic regurgitation",
        "Mitral stenosis",
        "Tricuspid regurgitation",
        "Pulmonary stenosis",
      ],
      correctIndex: 0,
      explanation:
        "Root involvement disrupts aortic valve coaptation, producing acute AR.",
      conceptTag: "aortic root → AR",
    },
    {
      angle: "mechanism",
      difficulty: "same",
      stem: "Why can an ascending aortic dissection produce a new early diastolic murmur?",
      choices: [
        "Dissection into the aortic root disrupts valve leaflet coaptation, causing regurgitation",
        "Increased afterload thickens the ventricular septum",
        "Coronary embolism infarcts a papillary muscle",
        "Rapid heart rate shortens diastolic filling",
      ],
      correctIndex: 0,
      explanation:
        "Loss of leaflet support at the root leads to incompetence and diastolic backflow.",
      conceptTag: "root disruption → incompetent valve",
    },
    {
      angle: "clinical_vignette",
      difficulty: "same",
      stem: "A patient develops an early diastolic murmur and widened pulse pressure minutes after sudden tearing chest pain. What vascular pathology is most likely?",
      choices: [
        "Ascending aortic dissection with root involvement",
        "Infective endocarditis of the mitral valve",
        "Acute pulmonary embolism",
        "Rheumatic mitral stenosis",
      ],
      correctIndex: 0,
      explanation:
        "The acute AR picture immediately after tearing pain points to root dissection.",
      conceptTag: "acute AR after tearing pain → dissection",
    },
    {
      angle: "physical_exam",
      difficulty: "same",
      stem: "In suspected ascending aortic dissection, which auscultatory finding best supports aortic root involvement?",
      choices: [
        "Early diastolic decrescendo murmur at the left sternal border",
        "Mid-systolic click",
        "Opening snap",
        "Continuous machinery murmur",
      ],
      correctIndex: 0,
      explanation:
        "An early diastolic murmur reflects acute aortic regurgitation from root disruption.",
      conceptTag: "root involvement → diastolic murmur",
    },
    {
      angle: "diagnosis",
      difficulty: "same",
      stem: "Tearing chest pain to the back, an early diastolic murmur, and a widened mediastinum on chest X-ray. What is the most likely diagnosis?",
      choices: [
        "Ascending aortic dissection",
        "ST-elevation myocardial infarction",
        "Tension pneumothorax",
        "Acute pericarditis",
      ],
      correctIndex: 0,
      explanation:
        "The triad of tearing pain, acute AR, and widened mediastinum is classic for dissection.",
      conceptTag: "triad → dissection",
    },
    {
      angle: "management",
      difficulty: "harder",
      stem: "A patient with ascending aortic dissection and a new early diastolic murmur is hemodynamically unstable. What is the most immediate clinical priority?",
      choices: [
        "Emergency surgical repair (type A dissection is a surgical emergency)",
        "Thrombolysis",
        "Outpatient beta-blocker titration",
        "Elective valve replacement in 6 weeks",
      ],
      correctIndex: 0,
      explanation:
        "Ascending (type A) dissection with acute AR requires emergent surgery; thrombolysis is contraindicated.",
      conceptTag: "type A + AR → emergency surgery",
    },
    {
      angle: "trap",
      difficulty: "harder",
      stem: "Both tachycardia and an early diastolic murmur are noted after sudden tearing chest pain. Which finding is MORE SPECIFIC for the underlying pathology?",
      choices: [
        "The early diastolic murmur (acute aortic regurgitation)",
        "Sinus tachycardia",
        "Mild leukocytosis",
        "Anxiety",
      ],
      correctIndex: 0,
      explanation:
        "Tachycardia is nonspecific; the diastolic murmur specifically points to root involvement with AR.",
      conceptTag: "specific vs nonspecific sign",
    },
    {
      angle: "integration",
      difficulty: "harder",
      stem: "Connect the anatomical site of an ascending aortic dissection to the resulting valvular dysfunction.",
      choices: [
        "Aortic root disruption → loss of leaflet coaptation → acute aortic regurgitation",
        "Aortic arch tear → mitral valve prolapse",
        "Descending aorta tear → tricuspid regurgitation",
        "Root disruption → aortic stenosis",
      ],
      correctIndex: 0,
      explanation:
        "The root houses the aortic valve; dissection there causes incompetence, i.e. acute AR.",
      conceptTag: "anatomy → valve consequence",
    },
  ],
};

export const EXAMPLE_ANGLE_ORDER: QuestionAngle[] =
  EXAMPLE_VARIATIONS.variants.map((v) => v.angle);
