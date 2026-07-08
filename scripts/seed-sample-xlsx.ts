import * as XLSX from "xlsx-js-style";
import { resolve } from "node:path";

type Row = (string | number)[];

const HEADER: Row = ["question", "A", "B", "C", "D", "correct", "explanation", "topic", "difficulty"];

const cardiovascular: Row[] = [
  HEADER,
  [
    "Which artery supplies the inferior wall of the left ventricle in most patients?",
    "Left anterior descending",
    "Right coronary",
    "Circumflex",
    "Left main",
    "B",
    "In a right-dominant circulation (~80%), the RCA gives off the posterior descending artery, supplying the inferior LV wall.",
    "coronary anatomy",
    2,
  ],
  [
    "Which valve abnormality classically produces a mid-systolic click?",
    "Aortic stenosis",
    "Mitral valve prolapse",
    "Tricuspid regurgitation",
    "Pulmonary stenosis",
    "B",
    "MVP produces a mid-systolic click as the redundant leaflet snaps into the LA; often followed by a late-systolic murmur.",
    "valvular disease",
    1,
  ],
  [
    "First-line antihypertensive class in a 62-year-old patient with HFrEF (EF 30%)?",
    "Calcium channel blockers (non-dihydropyridine)",
    "ARNI (sacubitril/valsartan)",
    "Hydralazine + nitrates",
    "Loop diuretics",
    "B",
    "ARNI is first-line GDMT for HFrEF, superior to enalapril in PARADIGM-HF. CCBs (non-DHP) are contraindicated.",
    "heart failure",
    3,
  ],
];

const respiratory: Row[] = [
  HEADER,
  [
    "What is the most common cause of community-acquired pneumonia in adults?",
    "Streptococcus pneumoniae",
    "Mycoplasma pneumoniae",
    "Legionella pneumophila",
    "Haemophilus influenzae",
    "A",
    "S. pneumoniae remains the leading bacterial cause of CAP across most age groups.",
    "infectious disease",
    1,
  ],
  [
    "Hallmark spirometry finding in COPD?",
    "FEV1/FVC > 0.8 with restriction",
    "FEV1/FVC < 0.7, not fully reversible",
    "Increased FEV1 after bronchodilator > 12%",
    "Normal spirometry with reduced DLCO only",
    "B",
    "COPD shows a non-reversible obstructive pattern. Significant reversibility points toward asthma.",
    "obstructive lung disease",
    2,
  ],
  [
    "Which finding is most specific for pulmonary embolism on CT angiography?",
    "Mosaic attenuation",
    "Filling defect within a pulmonary artery",
    "Ground-glass opacity",
    "Pleural effusion",
    "B",
    "Intraluminal filling defect is the direct sign of PE.",
    "pulmonary vascular",
    1,
  ],
];

const renal: Row[] = [
  HEADER,
  [
    "Most common cause of nephrotic syndrome in adults in the US?",
    "Minimal change disease",
    "Focal segmental glomerulosclerosis",
    "Membranous nephropathy",
    "IgA nephropathy",
    "B",
    "FSGS is now the leading cause of primary nephrotic syndrome in US adults.",
    "glomerular disease",
    2,
  ],
  [
    "Urinary finding most suggestive of acute interstitial nephritis?",
    "RBC casts",
    "WBC casts with eosinophiluria",
    "Hyaline casts",
    "Waxy casts",
    "B",
    "AIN classically presents with WBC casts and sometimes eosinophiluria, often drug-induced.",
    "tubulointerstitial",
    2,
  ],
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cardiovascular), "Cardiovascular");
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(respiratory), "Respiratory");
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(renal), "Renal");

const out = resolve(process.cwd(), "sample-bank.xlsx");
XLSX.writeFile(wb, out);
console.log(`wrote ${out}`);
