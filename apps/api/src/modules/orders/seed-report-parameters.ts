/**
 * Standard report parameters for common lab tests.
 * Used by the seed endpoint to populate ReportParameter + ReferenceRange
 * for tests that have no parameters configured yet.
 */

export interface SeedParameter {
  name: string;
  fieldType: string;
  unit?: string;
  sortOrder: number;
  isMandatory?: boolean;
  options?: string[];
  refLow?: number | null;
  refHigh?: number | null;
  critLow?: number | null;
  critHigh?: number | null;
}

export interface SeedTestConfig {
  parameters: SeedParameter[];
}

export const STANDARD_TEST_PARAMETERS: Record<string, SeedTestConfig> = {
  // ═══ HAEMATOLOGY ═══════════════════════════════

  PT0242: {
    parameters: [
      { name: "Haemoglobin (Hb)", fieldType: "NUMERIC", unit: "g/dL", sortOrder: 1, refLow: 13.5, refHigh: 17.5, critLow: 7.0, critHigh: 20.0 },
      { name: "Haematocrit (HCT)", fieldType: "NUMERIC", unit: "%", sortOrder: 2, refLow: 41, refHigh: 53, critLow: 21, critHigh: 65 },
      { name: "Red Blood Cell Count (RBC)", fieldType: "NUMERIC", unit: "x10⁶/µL", sortOrder: 3, refLow: 4.5, refHigh: 5.9, critLow: 2.0, critHigh: 8.0 },
      { name: "Mean Corpuscular Volume (MCV)", fieldType: "NUMERIC", unit: "fL", sortOrder: 4, refLow: 80, refHigh: 100 },
      { name: "Mean Corpuscular Haemoglobin (MCH)", fieldType: "NUMERIC", unit: "pg", sortOrder: 5, refLow: 27, refHigh: 33 },
      { name: "MCHC", fieldType: "NUMERIC", unit: "g/dL", sortOrder: 6, refLow: 31.5, refHigh: 36 },
      { name: "Red Cell Distribution Width (RDW)", fieldType: "NUMERIC", unit: "%", sortOrder: 7, refLow: 11.5, refHigh: 14.5 },
      { name: "White Blood Cell Count (WBC)", fieldType: "NUMERIC", unit: "x10³/µL", sortOrder: 8, refLow: 4.0, refHigh: 11.0, critLow: 2.0, critHigh: 30.0 },
      { name: "Neutrophils (%)", fieldType: "NUMERIC", unit: "%", sortOrder: 9, refLow: 40, refHigh: 70 },
      { name: "Lymphocytes (%)", fieldType: "NUMERIC", unit: "%", sortOrder: 10, refLow: 20, refHigh: 45 },
      { name: "Monocytes (%)", fieldType: "NUMERIC", unit: "%", sortOrder: 11, refLow: 2, refHigh: 10 },
      { name: "Eosinophils (%)", fieldType: "NUMERIC", unit: "%", sortOrder: 12, refLow: 1, refHigh: 6 },
      { name: "Basophils (%)", fieldType: "NUMERIC", unit: "%", sortOrder: 13, refLow: 0, refHigh: 2 },
      { name: "Platelet Count", fieldType: "NUMERIC", unit: "x10³/µL", sortOrder: 14, refLow: 150, refHigh: 400, critLow: 50, critHigh: 1000 },
      { name: "Mean Platelet Volume (MPV)", fieldType: "NUMERIC", unit: "fL", sortOrder: 15, refLow: 7.5, refHigh: 12.5 },
      { name: "Neutrophils (Absolute)", fieldType: "NUMERIC", unit: "x10³/µL", sortOrder: 16, refLow: 1.8, refHigh: 7.5, critLow: 0.5 },
      { name: "Lymphocytes (Absolute)", fieldType: "NUMERIC", unit: "x10³/µL", sortOrder: 17, refLow: 1.0, refHigh: 4.0 },
    ],
  },

  // ═══ THYROID ═══════════════════════════════════

  PT0760: {
    parameters: [
      { name: "T3 - Triiodothyronine", fieldType: "NUMERIC", unit: "ng/dL", sortOrder: 1, refLow: 60, refHigh: 200 },
      { name: "T4 - Thyroxine", fieldType: "NUMERIC", unit: "µg/dL", sortOrder: 2, refLow: 4.5, refHigh: 12.5 },
      { name: "TSH", fieldType: "NUMERIC", unit: "µIU/mL", sortOrder: 3, refLow: 0.35, refHigh: 5.5, critHigh: 100 },
    ],
  },

  PT0761: {
    parameters: [
      { name: "FT3 - Free Triiodothyronine", fieldType: "NUMERIC", unit: "pg/mL", sortOrder: 1, refLow: 2.3, refHigh: 4.2 },
      { name: "FT4 - Free Thyroxine", fieldType: "NUMERIC", unit: "ng/dL", sortOrder: 2, refLow: 0.89, refHigh: 1.76 },
      { name: "TSH", fieldType: "NUMERIC", unit: "µIU/mL", sortOrder: 3, refLow: 0.35, refHigh: 5.5, critHigh: 100 },
    ],
  },

  PT0762: {
    parameters: [
      { name: "TSH", fieldType: "NUMERIC", unit: "µIU/mL", sortOrder: 1, refLow: 0.35, refHigh: 5.5, critHigh: 100 },
    ],
  },

  // ═══ BIOCHEMISTRY — LIVER FUNCTION ═════════════

  PT_LFT: {
    parameters: [
      { name: "Total Bilirubin", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 1, refLow: 0.2, refHigh: 1.2, critHigh: 15 },
      { name: "Direct Bilirubin", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 2, refLow: 0.0, refHigh: 0.3 },
      { name: "Indirect Bilirubin", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 3, refLow: 0.2, refHigh: 0.9 },
      { name: "SGOT (AST)", fieldType: "NUMERIC", unit: "U/L", sortOrder: 4, refLow: 10, refHigh: 40, critHigh: 1000 },
      { name: "SGPT (ALT)", fieldType: "NUMERIC", unit: "U/L", sortOrder: 5, refLow: 7, refHigh: 56, critHigh: 1000 },
      { name: "ALP", fieldType: "NUMERIC", unit: "U/L", sortOrder: 6, refLow: 44, refHigh: 147 },
      { name: "GGT", fieldType: "NUMERIC", unit: "U/L", sortOrder: 7, refLow: 8, refHigh: 61 },
      { name: "Total Protein", fieldType: "NUMERIC", unit: "g/dL", sortOrder: 8, refLow: 6.3, refHigh: 8.2 },
      { name: "Albumin", fieldType: "NUMERIC", unit: "g/dL", sortOrder: 9, refLow: 3.5, refHigh: 5.0, critLow: 1.5 },
      { name: "Globulin", fieldType: "NUMERIC", unit: "g/dL", sortOrder: 10, refLow: 2.0, refHigh: 3.5 },
      { name: "A/G Ratio", fieldType: "NUMERIC", unit: "", sortOrder: 11, refLow: 1.0, refHigh: 2.5 },
    ],
  },

  // ═══ BIOCHEMISTRY — KIDNEY FUNCTION ════════════

  PT_KFT: {
    parameters: [
      { name: "Blood Urea Nitrogen (BUN)", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 1, refLow: 7, refHigh: 20, critHigh: 100 },
      { name: "Urea", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 2, refLow: 15, refHigh: 45 },
      { name: "Creatinine", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 3, refLow: 0.7, refHigh: 1.3, critHigh: 10 },
      { name: "Uric Acid", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 4, refLow: 3.5, refHigh: 7.2 },
      { name: "eGFR", fieldType: "NUMERIC", unit: "mL/min", sortOrder: 5, refLow: 60, refHigh: 120, critLow: 15 },
      { name: "Sodium (Na+)", fieldType: "NUMERIC", unit: "mEq/L", sortOrder: 6, refLow: 136, refHigh: 145, critLow: 120, critHigh: 160 },
      { name: "Potassium (K+)", fieldType: "NUMERIC", unit: "mEq/L", sortOrder: 7, refLow: 3.5, refHigh: 5.1, critLow: 2.8, critHigh: 6.5 },
      { name: "Chloride (Cl-)", fieldType: "NUMERIC", unit: "mEq/L", sortOrder: 8, refLow: 98, refHigh: 107, critLow: 80, critHigh: 120 },
      { name: "Bicarbonate (HCO3-)", fieldType: "NUMERIC", unit: "mEq/L", sortOrder: 9, refLow: 22, refHigh: 29, critLow: 10, critHigh: 40 },
    ],
  },

  // ═══ DIABETES ══════════════════════════════════

  PT_DIAB: {
    parameters: [
      { name: "Fasting Blood Glucose", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 1, refLow: 70, refHigh: 100, critLow: 40, critHigh: 500 },
      { name: "Post-Prandial Glucose (PP)", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 2, refLow: 70, refHigh: 140, critLow: 40, critHigh: 500 },
      { name: "HbA1c", fieldType: "NUMERIC", unit: "%", sortOrder: 3, refLow: 4.0, refHigh: 5.7, critHigh: 14 },
      { name: "Insulin (Fasting)", fieldType: "NUMERIC", unit: "µIU/mL", sortOrder: 4, refLow: 2.6, refHigh: 24.9 },
    ],
  },

  // ═══ LIPID PROFILE ══════════════════════════════

  PT_LIPID: {
    parameters: [
      { name: "Total Cholesterol", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 1, refHigh: 200, critHigh: 300 },
      { name: "Triglycerides", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 2, refHigh: 150, critHigh: 500 },
      { name: "HDL Cholesterol", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 3, refLow: 40 },
      { name: "LDL Cholesterol", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 4, refHigh: 100, critHigh: 190 },
      { name: "VLDL", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 5, refLow: 5, refHigh: 40 },
      { name: "Non-HDL Cholesterol", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 6, refHigh: 130 },
      { name: "TC/HDL Ratio", fieldType: "NUMERIC", unit: "", sortOrder: 7, refHigh: 5.0 },
    ],
  },

  // ═══ HORMONES ═══════════════════════════════════

  PT_FSH_LH: {
    parameters: [
      { name: "FSH", fieldType: "NUMERIC", unit: "mIU/mL", sortOrder: 1, refLow: 1.5, refHigh: 12.4 },
      { name: "LH", fieldType: "NUMERIC", unit: "mIU/mL", sortOrder: 2, refLow: 1.7, refHigh: 8.6 },
    ],
  },

  PT_IRON: {
    parameters: [
      { name: "Serum Iron", fieldType: "NUMERIC", unit: "µg/dL", sortOrder: 1, refLow: 60, refHigh: 170 },
      { name: "TIBC", fieldType: "NUMERIC", unit: "µg/dL", sortOrder: 2, refLow: 250, refHigh: 370 },
      { name: "Ferritin", fieldType: "NUMERIC", unit: "ng/mL", sortOrder: 3, refLow: 12, refHigh: 300 },
      { name: "Transferrin Sat. %", fieldType: "NUMERIC", unit: "%", sortOrder: 4, refLow: 20, refHigh: 50 },
    ],
  },

  // ═══ URINE ═══════════════════════════════════════

  PT_URE: {
    parameters: [
      { name: "Colour", fieldType: "TEXT", unit: "", sortOrder: 1 },
      { name: "Appearance", fieldType: "OPTION", unit: "", sortOrder: 2, options: ["Clear", "Hazy", "Turbid", "Cloudy"] },
      { name: "pH", fieldType: "NUMERIC", unit: "", sortOrder: 3, refLow: 4.5, refHigh: 8.0 },
      { name: "Specific Gravity", fieldType: "NUMERIC", unit: "", sortOrder: 4, refLow: 1.001, refHigh: 1.030 },
      { name: "Protein", fieldType: "OPTION", unit: "", sortOrder: 5, options: ["Nil", "Trace", "+1", "+2", "+3", "+4"] },
      { name: "Glucose", fieldType: "OPTION", unit: "", sortOrder: 6, options: ["Nil", "Trace", "+1", "+2", "+3", "+4"] },
      { name: "Ketones", fieldType: "OPTION", unit: "", sortOrder: 7, options: ["Nil", "Trace", "+1", "+2", "+3"] },
      { name: "Bilirubin", fieldType: "OPTION", unit: "", sortOrder: 8, options: ["Nil", "Trace", "+1", "+2", "+3"] },
      { name: "Urobilinogen", fieldType: "NUMERIC", unit: "EU/dL", sortOrder: 9, refLow: 0.2, refHigh: 1.0 },
      { name: "Blood", fieldType: "OPTION", unit: "", sortOrder: 10, options: ["Nil", "Trace", "+1", "+2", "+3"] },
      { name: "Leucocytes", fieldType: "OPTION", unit: "", sortOrder: 11, options: ["Nil", "Trace", "+1", "+2", "+3"] },
      { name: "Nitrites", fieldType: "OPTION", unit: "", sortOrder: 12, options: ["Negative", "Positive"] },
      { name: "Pus Cells (HPF)", fieldType: "TEXT", unit: "/HPF", sortOrder: 13 },
      { name: "RBCs (HPF)", fieldType: "TEXT", unit: "/HPF", sortOrder: 14 },
      { name: "Epithelial Cells", fieldType: "TEXT", unit: "/HPF", sortOrder: 15 },
      { name: "Casts", fieldType: "TEXT", unit: "", sortOrder: 16 },
      { name: "Crystals", fieldType: "TEXT", unit: "", sortOrder: 17 },
      { name: "Bacteria", fieldType: "OPTION", unit: "", sortOrder: 18, options: ["Nil", "Few", "Moderate", "Many"] },
    ],
  },

  // ═══ COMPLETE URINE EXAMINATION (CUE) ═══════════

  PT_CUE: {
    parameters: [
      // Physical examination
      { name: "Volume", fieldType: "NUMERIC", unit: "mL", sortOrder: 1 },
      { name: "Colour", fieldType: "TEXT", unit: "", sortOrder: 2 },
      { name: "Appearance", fieldType: "OPTION", unit: "", sortOrder: 3, options: ["Clear", "Slightly Hazy", "Hazy", "Turbid", "Cloudy"] },
      { name: "Specific Gravity", fieldType: "NUMERIC", unit: "", sortOrder: 4, refLow: 1.003, refHigh: 1.030 },
      { name: "pH", fieldType: "NUMERIC", unit: "", sortOrder: 5, refLow: 4.5, refHigh: 8.0 },
      { name: "Odour", fieldType: "OPTION", unit: "", sortOrder: 6, options: ["Normal", "Ammoniacal", "Fruity", "Foul Smelling"] },
      // Chemical examination
      { name: "Protein (Albumin)", fieldType: "OPTION", unit: "", sortOrder: 7, options: ["Nil", "Trace", "+1", "+2", "+3", "+4"] },
      { name: "Glucose (Sugar)", fieldType: "OPTION", unit: "", sortOrder: 8, options: ["Nil", "Trace", "+1", "+2", "+3", "+4"] },
      { name: "Ketone Bodies", fieldType: "OPTION", unit: "", sortOrder: 9, options: ["Nil", "Trace", "+1", "+2", "+3"] },
      { name: "Bilirubin", fieldType: "OPTION", unit: "", sortOrder: 10, options: ["Nil", "Trace", "+1", "+2", "+3"] },
      { name: "Urobilinogen", fieldType: "NUMERIC", unit: "EU/dL", sortOrder: 11, refLow: 0.2, refHigh: 1.0 },
      { name: "Blood (Occult)", fieldType: "OPTION", unit: "", sortOrder: 12, options: ["Nil", "Trace", "+1", "+2", "+3"] },
      { name: "Leucocyte Esterase", fieldType: "OPTION", unit: "", sortOrder: 13, options: ["Nil", "Trace", "+1", "+2", "+3"] },
      { name: "Nitrites", fieldType: "OPTION", unit: "", sortOrder: 14, options: ["Negative", "Positive"] },
      { name: "Bile Salts", fieldType: "OPTION", unit: "", sortOrder: 15, options: ["Absent", "Present"] },
      { name: "Bile Pigments", fieldType: "OPTION", unit: "", sortOrder: 16, options: ["Absent", "Present"] },
      // Microscopic examination
      { name: "Pus Cells", fieldType: "TEXT", unit: "/HPF", sortOrder: 17 },
      { name: "Red Blood Cells", fieldType: "TEXT", unit: "/HPF", sortOrder: 18 },
      { name: "Epithelial Cells", fieldType: "OPTION", unit: "/HPF", sortOrder: 19, options: ["Nil", "Few", "Moderate", "Many"] },
      { name: "Casts", fieldType: "OPTION", unit: "/LPF", sortOrder: 20, options: ["Nil", "Hyaline", "Granular", "WBC Casts", "RBC Casts", "Waxy"] },
      { name: "Crystals", fieldType: "OPTION", unit: "", sortOrder: 21, options: ["Nil", "Calcium Oxalate", "Uric Acid", "Triple Phosphate", "Amorphous Urates", "Amorphous Phosphates"] },
      { name: "Bacteria", fieldType: "OPTION", unit: "", sortOrder: 22, options: ["Nil", "Few", "Moderate", "Many"] },
      { name: "Yeast Cells", fieldType: "OPTION", unit: "", sortOrder: 23, options: ["Nil", "Few", "Moderate", "Many"] },
      { name: "Mucus Threads", fieldType: "OPTION", unit: "", sortOrder: 24, options: ["Nil", "Few", "Moderate", "Many"] },
      { name: "Spermatozoa", fieldType: "OPTION", unit: "", sortOrder: 25, options: ["Nil", "Present"] },
    ],
  },

  // ═══ COAGULATION ════════════════════════════════

  PT_COAG: {
    parameters: [
      { name: "PT (Prothrombin Time)", fieldType: "NUMERIC", unit: "seconds", sortOrder: 1, refLow: 11, refHigh: 13.5, critHigh: 30 },
      { name: "INR", fieldType: "NUMERIC", unit: "", sortOrder: 2, refLow: 0.9, refHigh: 1.1, critHigh: 5 },
      { name: "APTT", fieldType: "NUMERIC", unit: "seconds", sortOrder: 3, refLow: 25, refHigh: 35, critHigh: 70 },
      { name: "Fibrinogen", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 4, refLow: 200, refHigh: 400, critLow: 100 },
      { name: "D-Dimer", fieldType: "NUMERIC", unit: "ng/mL", sortOrder: 5, refHigh: 500 },
    ],
  },

  // ═══ CARDIAC MARKERS ════════════════════════════

  PT_CARDIAC: {
    parameters: [
      { name: "Troponin I", fieldType: "NUMERIC", unit: "ng/mL", sortOrder: 1, refHigh: 0.04, critHigh: 2.0 },
      { name: "CK-MB", fieldType: "NUMERIC", unit: "U/L", sortOrder: 2, refHigh: 25 },
      { name: "CK Total", fieldType: "NUMERIC", unit: "U/L", sortOrder: 3, refLow: 22, refHigh: 198 },
      { name: "LDH", fieldType: "NUMERIC", unit: "U/L", sortOrder: 4, refLow: 140, refHigh: 280 },
      { name: "BNP / NT-proBNP", fieldType: "NUMERIC", unit: "pg/mL", sortOrder: 5, refHigh: 100, critHigh: 1000 },
    ],
  },

  // ═══ SINGLE-PARAMETER TESTS ════════════════════

  PT_ESR: {
    parameters: [
      { name: "ESR (Erythrocyte Sedimentation Rate)", fieldType: "NUMERIC", unit: "mm/hr", sortOrder: 1, refLow: 0, refHigh: 20 },
    ],
  },

  PT_CRP: {
    parameters: [
      { name: "C-Reactive Protein (CRP)", fieldType: "NUMERIC", unit: "mg/L", sortOrder: 1, refHigh: 5 },
    ],
  },

  PT_VIT_D: {
    parameters: [
      { name: "25-Hydroxy Vitamin D", fieldType: "NUMERIC", unit: "ng/mL", sortOrder: 1, refLow: 30, refHigh: 100, critLow: 10 },
    ],
  },

  PT_VIT_B12: {
    parameters: [
      { name: "Vitamin B12", fieldType: "NUMERIC", unit: "pg/mL", sortOrder: 1, refLow: 200, refHigh: 900, critLow: 150 },
    ],
  },
};

/**
 * Keyword-based matching for tests whose codes don't match the seed keys above.
 */
export const NAME_KEYWORD_MATCHES: { keywords: string[]; configKey: string }[] = [
  { keywords: ["complete blood count", "cbc", "haemogram", "hemogram"], configKey: "PT0242" },
  { keywords: ["thyroid profile i", "t3 t4 tsh", "thyroid function"], configKey: "PT0760" },
  { keywords: ["thyroid profile iii", "ft3 ft4", "free thyroid"], configKey: "PT0761" },
  { keywords: ["tsh"], configKey: "PT0762" },
  { keywords: ["liver function", "lft", "hepatic"], configKey: "PT_LFT" },
  { keywords: ["renal function", "kidney function", "kft", "rft"], configKey: "PT_KFT" },
  { keywords: ["lipid profile", "cholesterol panel"], configKey: "PT_LIPID" },
  { keywords: ["urine routine", "urinalysis", "urine r&m", "urine r/m"], configKey: "PT_URE" },
  { keywords: ["complete urine", "cue", "urine complete", "urine examination"], configKey: "PT_CUE" },
  { keywords: ["coagulation", "clotting profile", "pt inr"], configKey: "PT_COAG" },
  { keywords: ["cardiac panel", "cardiac marker", "troponin panel"], configKey: "PT_CARDIAC" },
  { keywords: ["diabetes panel", "diabetic profile"], configKey: "PT_DIAB" },
  { keywords: ["iron profile", "iron studies"], configKey: "PT_IRON" },
  { keywords: ["fsh lh", "gonadotropin"], configKey: "PT_FSH_LH" },
  { keywords: ["esr", "erythrocyte sedimentation"], configKey: "PT_ESR" },
  { keywords: ["c-reactive protein", "crp", "hs-crp"], configKey: "PT_CRP" },
  { keywords: ["vitamin d", "vit d", "25 hydroxy"], configKey: "PT_VIT_D" },
  { keywords: ["vitamin b12", "vit b12", "cobalamin"], configKey: "PT_VIT_B12" },
];
