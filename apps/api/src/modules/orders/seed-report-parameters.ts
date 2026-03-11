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

  // ═══ HORMONES — REPRODUCTIVE ══════════════════════
  PT_TESTOSTERONE: {
    parameters: [
      { name: "Total Testosterone", fieldType: "NUMERIC", unit: "ng/dL", sortOrder: 1, refLow: 270, refHigh: 1070 },
      { name: "Free Testosterone", fieldType: "NUMERIC", unit: "pg/mL", sortOrder: 2, refLow: 9.0, refHigh: 30.0 },
      { name: "SHBG", fieldType: "NUMERIC", unit: "nmol/L", sortOrder: 3, refLow: 10, refHigh: 57 },
    ],
  },

  PT_PROLACTIN: {
    parameters: [
      { name: "Prolactin", fieldType: "NUMERIC", unit: "ng/mL", sortOrder: 1, refLow: 2.0, refHigh: 18.0, critHigh: 100 },
    ],
  },

  PT_ESTRADIOL: {
    parameters: [
      { name: "Estradiol (E2)", fieldType: "NUMERIC", unit: "pg/mL", sortOrder: 1, refLow: 15, refHigh: 350 },
    ],
  },

  PT_PROGESTERONE: {
    parameters: [
      { name: "Progesterone", fieldType: "NUMERIC", unit: "ng/mL", sortOrder: 1, refLow: 0.2, refHigh: 25.0 },
    ],
  },

  PT_HORMONES_FULL: {
    parameters: [
      { name: "LH (Luteinising Hormone)", fieldType: "NUMERIC", unit: "mIU/mL", sortOrder: 1, refLow: 1.7, refHigh: 8.6 },
      { name: "FSH (Follicle Stimulating Hormone)", fieldType: "NUMERIC", unit: "mIU/mL", sortOrder: 2, refLow: 1.5, refHigh: 12.4 },
      { name: "Estradiol (E2)", fieldType: "NUMERIC", unit: "pg/mL", sortOrder: 3, refLow: 15, refHigh: 350 },
      { name: "Progesterone", fieldType: "NUMERIC", unit: "ng/mL", sortOrder: 4, refLow: 0.2, refHigh: 25.0 },
      { name: "Prolactin", fieldType: "NUMERIC", unit: "ng/mL", sortOrder: 5, refLow: 2.0, refHigh: 18.0, critHigh: 100 },
      { name: "Total Testosterone", fieldType: "NUMERIC", unit: "ng/dL", sortOrder: 6, refLow: 270, refHigh: 1070 },
      { name: "DHEA-S", fieldType: "NUMERIC", unit: "µg/dL", sortOrder: 7, refLow: 80, refHigh: 560 },
      { name: "AMH (Anti-Mullerian Hormone)", fieldType: "NUMERIC", unit: "ng/mL", sortOrder: 8, refLow: 1.0, refHigh: 3.5 },
    ],
  },

  // ═══ TUMOUR MARKERS ═════════════════════════════════
  PT_PSA: {
    parameters: [
      { name: "Total PSA", fieldType: "NUMERIC", unit: "ng/mL", sortOrder: 1, refHigh: 4.0, critHigh: 10.0 },
      { name: "Free PSA", fieldType: "NUMERIC", unit: "ng/mL", sortOrder: 2, refLow: 0.0 },
      { name: "Free/Total PSA Ratio", fieldType: "NUMERIC", unit: "%", sortOrder: 3, refLow: 25 },
    ],
  },

  PT_AFP: {
    parameters: [
      { name: "Alpha-Fetoprotein (AFP)", fieldType: "NUMERIC", unit: "ng/mL", sortOrder: 1, refHigh: 8.1, critHigh: 400 },
    ],
  },

  PT_CEA: {
    parameters: [
      { name: "Carcinoembryonic Antigen (CEA)", fieldType: "NUMERIC", unit: "ng/mL", sortOrder: 1, refHigh: 5.0, critHigh: 50 },
    ],
  },

  PT_CA125: {
    parameters: [
      { name: "CA-125", fieldType: "NUMERIC", unit: "U/mL", sortOrder: 1, refHigh: 35, critHigh: 200 },
    ],
  },

  PT_CA199: {
    parameters: [
      { name: "CA 19-9", fieldType: "NUMERIC", unit: "U/mL", sortOrder: 1, refHigh: 37, critHigh: 200 },
    ],
  },

  PT_CA153: {
    parameters: [
      { name: "CA 15-3", fieldType: "NUMERIC", unit: "U/mL", sortOrder: 1, refHigh: 30 },
    ],
  },

  PT_TUMOUR_FULL: {
    parameters: [
      { name: "AFP (Alpha-Fetoprotein)", fieldType: "NUMERIC", unit: "ng/mL", sortOrder: 1, refHigh: 8.1, critHigh: 400 },
      { name: "CEA (Carcinoembryonic Antigen)", fieldType: "NUMERIC", unit: "ng/mL", sortOrder: 2, refHigh: 5.0, critHigh: 50 },
      { name: "CA-125", fieldType: "NUMERIC", unit: "U/mL", sortOrder: 3, refHigh: 35, critHigh: 200 },
      { name: "CA 19-9", fieldType: "NUMERIC", unit: "U/mL", sortOrder: 4, refHigh: 37, critHigh: 200 },
      { name: "CA 15-3", fieldType: "NUMERIC", unit: "U/mL", sortOrder: 5, refHigh: 30 },
      { name: "Total PSA", fieldType: "NUMERIC", unit: "ng/mL", sortOrder: 6, refHigh: 4.0, critHigh: 10.0 },
    ],
  },

  // ═══ INFECTIONS / SEROLOGY ══════════════════════════
  PT_HBSAG: {
    parameters: [
      { name: "HBsAg (Hepatitis B Surface Antigen)", fieldType: "OPTION", unit: "", sortOrder: 1, options: ["Non-Reactive", "Reactive", "Borderline"] },
    ],
  },

  PT_HCV: {
    parameters: [
      { name: "Anti-HCV (Hepatitis C Antibody)", fieldType: "OPTION", unit: "", sortOrder: 1, options: ["Non-Reactive", "Reactive", "Borderline"] },
    ],
  },

  PT_HBSAG_HCV: {
    parameters: [
      { name: "HBsAg (Hepatitis B Surface Antigen)", fieldType: "OPTION", unit: "", sortOrder: 1, options: ["Non-Reactive", "Reactive", "Borderline"] },
      { name: "Anti-HCV (Hepatitis C Antibody)", fieldType: "OPTION", unit: "", sortOrder: 2, options: ["Non-Reactive", "Reactive", "Borderline"] },
    ],
  },

  PT_HIV: {
    parameters: [
      { name: "HIV 1 & 2 Antibody (Rapid)", fieldType: "OPTION", unit: "", sortOrder: 1, options: ["Non-Reactive", "Reactive"] },
    ],
  },

  PT_VDRL: {
    parameters: [
      { name: "VDRL (Syphilis Screening)", fieldType: "OPTION", unit: "", sortOrder: 1, options: ["Non-Reactive", "Reactive", "Weakly Reactive"] },
      { name: "VDRL Titre (if reactive)", fieldType: "TEXT", unit: "", sortOrder: 2 },
    ],
  },

  PT_DENGUE_NS1: {
    parameters: [
      { name: "Dengue NS1 Antigen", fieldType: "OPTION", unit: "", sortOrder: 1, options: ["Negative", "Positive"] },
    ],
  },

  PT_DENGUE_IGM: {
    parameters: [
      { name: "Dengue IgM Antibody", fieldType: "OPTION", unit: "", sortOrder: 1, options: ["Negative", "Positive", "Equivocal"] },
    ],
  },

  PT_DENGUE_PANEL: {
    parameters: [
      { name: "Dengue NS1 Antigen", fieldType: "OPTION", unit: "", sortOrder: 1, options: ["Negative", "Positive"] },
      { name: "Dengue IgM Antibody", fieldType: "OPTION", unit: "", sortOrder: 2, options: ["Negative", "Positive", "Equivocal"] },
      { name: "Dengue IgG Antibody", fieldType: "OPTION", unit: "", sortOrder: 3, options: ["Negative", "Positive", "Equivocal"] },
      { name: "Interpretation", fieldType: "TEXT", unit: "", sortOrder: 4 },
    ],
  },

  PT_MALARIA: {
    parameters: [
      { name: "Malaria Antigen (PF — Plasmodium falciparum)", fieldType: "OPTION", unit: "", sortOrder: 1, options: ["Not Detected", "Detected"] },
      { name: "Malaria Antigen (PV — Plasmodium vivax)", fieldType: "OPTION", unit: "", sortOrder: 2, options: ["Not Detected", "Detected"] },
    ],
  },

  PT_WIDAL: {
    parameters: [
      { name: "S. Typhi 'O' Titre", fieldType: "TEXT", unit: "", sortOrder: 1 },
      { name: "S. Typhi 'H' Titre", fieldType: "TEXT", unit: "", sortOrder: 2 },
      { name: "S. Paratyphi AO Titre", fieldType: "TEXT", unit: "", sortOrder: 3 },
      { name: "S. Paratyphi AH Titre", fieldType: "TEXT", unit: "", sortOrder: 4 },
      { name: "S. Paratyphi BH Titre", fieldType: "TEXT", unit: "", sortOrder: 5 },
      { name: "Interpretation", fieldType: "TEXT", unit: "", sortOrder: 6 },
    ],
  },

  PT_SCRUB_TYPHUS: {
    parameters: [
      { name: "Scrub Typhus IgM (ELISA)", fieldType: "OPTION", unit: "", sortOrder: 1, options: ["Negative", "Positive", "Equivocal"] },
      { name: "IgM Index Value", fieldType: "NUMERIC", unit: "", sortOrder: 2 },
    ],
  },

  PT_LEPTOSPIRA: {
    parameters: [
      { name: "Leptospira IgM Antibody", fieldType: "OPTION", unit: "", sortOrder: 1, options: ["Negative", "Positive", "Borderline"] },
    ],
  },

  PT_COVID_AG: {
    parameters: [
      { name: "COVID-19 Antigen (Rapid)", fieldType: "OPTION", unit: "", sortOrder: 1, options: ["Negative", "Positive", "Invalid"] },
    ],
  },

  PT_COVID_IGG: {
    parameters: [
      { name: "COVID-19 IgG Antibody (S-Protein)", fieldType: "NUMERIC", unit: "BAU/mL", sortOrder: 1, refLow: 0, refHigh: 33.8 },
      { name: "Interpretation", fieldType: "TEXT", unit: "", sortOrder: 2 },
    ],
  },

  // ═══ AUTOIMMUNE ═════════════════════════════════════
  PT_RA_FACTOR: {
    parameters: [
      { name: "RA Factor (Rheumatoid Arthritis Factor)", fieldType: "NUMERIC", unit: "IU/mL", sortOrder: 1, refHigh: 14 },
      { name: "Interpretation", fieldType: "OPTION", unit: "", sortOrder: 2, options: ["Negative (<14 IU/mL)", "Weakly Positive (14-50 IU/mL)", "Positive (>50 IU/mL)"] },
    ],
  },

  PT_ASO: {
    parameters: [
      { name: "ASO Titre (Anti-Streptolysin O)", fieldType: "NUMERIC", unit: "IU/mL", sortOrder: 1, refHigh: 200 },
      { name: "Interpretation", fieldType: "OPTION", unit: "", sortOrder: 2, options: ["Normal (<200 IU/mL)", "Elevated (>200 IU/mL)"] },
    ],
  },

  PT_ANA: {
    parameters: [
      { name: "ANA (Antinuclear Antibody) Titre", fieldType: "TEXT", unit: "", sortOrder: 1 },
      { name: "ANA Pattern", fieldType: "OPTION", unit: "", sortOrder: 2, options: ["Negative", "Homogeneous", "Speckled", "Nucleolar", "Centromere", "Cytoplasmic"] },
      { name: "Interpretation", fieldType: "TEXT", unit: "", sortOrder: 3 },
    ],
  },

  PT_CCP: {
    parameters: [
      { name: "Anti-CCP Antibody (Anti-Cyclic Citrullinated Peptide)", fieldType: "NUMERIC", unit: "U/mL", sortOrder: 1, refHigh: 17 },
      { name: "Interpretation", fieldType: "OPTION", unit: "", sortOrder: 2, options: ["Negative (<17 U/mL)", "Weak Positive (17-50 U/mL)", "Moderate Positive (50-100 U/mL)", "Strong Positive (>100 U/mL)"] },
    ],
  },

  PT_AUTOIMMUNE_PANEL: {
    parameters: [
      { name: "RA Factor", fieldType: "NUMERIC", unit: "IU/mL", sortOrder: 1, refHigh: 14 },
      { name: "ASO Titre", fieldType: "NUMERIC", unit: "IU/mL", sortOrder: 2, refHigh: 200 },
      { name: "Anti-CCP", fieldType: "NUMERIC", unit: "U/mL", sortOrder: 3, refHigh: 17 },
      { name: "ANA Titre", fieldType: "TEXT", unit: "", sortOrder: 4 },
      { name: "CRP (Quantitative)", fieldType: "NUMERIC", unit: "mg/L", sortOrder: 5, refHigh: 5.0 },
      { name: "ESR", fieldType: "NUMERIC", unit: "mm/hr", sortOrder: 6, refLow: 0, refHigh: 20 },
    ],
  },

  // ═══ STOOL EXAMINATION ══════════════════════════════
  PT_STOOL: {
    parameters: [
      { name: "Colour", fieldType: "TEXT", unit: "", sortOrder: 1 },
      { name: "Consistency", fieldType: "OPTION", unit: "", sortOrder: 2, options: ["Formed", "Semi-formed", "Soft", "Loose", "Watery", "Mucoid", "Blood-stained"] },
      { name: "Odour", fieldType: "OPTION", unit: "", sortOrder: 3, options: ["Normal", "Offensive", "Sour", "Foul"] },
      { name: "Mucus", fieldType: "OPTION", unit: "", sortOrder: 4, options: ["Absent", "Present"] },
      { name: "Blood (Macroscopic)", fieldType: "OPTION", unit: "", sortOrder: 5, options: ["Absent", "Present"] },
      { name: "Pus Cells (HPF)", fieldType: "TEXT", unit: "/HPF", sortOrder: 6 },
      { name: "Red Blood Cells (HPF)", fieldType: "TEXT", unit: "/HPF", sortOrder: 7 },
      { name: "Epithelial Cells", fieldType: "OPTION", unit: "", sortOrder: 8, options: ["Absent", "Few", "Moderate", "Many"] },
      { name: "Cysts / Ova / Parasites", fieldType: "TEXT", unit: "", sortOrder: 9 },
      { name: "Fat Globules", fieldType: "OPTION", unit: "", sortOrder: 10, options: ["Nil", "Few", "Moderate", "Many"] },
      { name: "Bacteria", fieldType: "OPTION", unit: "", sortOrder: 11, options: ["Normal Flora", "Excess Bacteria", "Spore-forming bacilli"] },
      { name: "Occult Blood (FOB)", fieldType: "OPTION", unit: "", sortOrder: 12, options: ["Negative", "Positive"] },
      { name: "Remarks", fieldType: "TEXT", unit: "", sortOrder: 13 },
    ],
  },

  // ═══ SEMEN ANALYSIS ═════════════════════════════════
  PT_SEMEN: {
    parameters: [
      { name: "Volume", fieldType: "NUMERIC", unit: "mL", sortOrder: 1, refLow: 1.5 },
      { name: "Colour", fieldType: "TEXT", unit: "", sortOrder: 2 },
      { name: "Appearance", fieldType: "OPTION", unit: "", sortOrder: 3, options: ["Opalescent White", "Yellowish", "Greyish"] },
      { name: "Viscosity", fieldType: "OPTION", unit: "", sortOrder: 4, options: ["Normal", "Increased", "Decreased"] },
      { name: "Liquefaction Time", fieldType: "TEXT", unit: "mins", sortOrder: 5 },
      { name: "pH", fieldType: "NUMERIC", unit: "", sortOrder: 6, refLow: 7.2, refHigh: 8.0 },
      { name: "Sperm Concentration", fieldType: "NUMERIC", unit: "million/mL", sortOrder: 7, refLow: 16 },
      { name: "Total Sperm Count", fieldType: "NUMERIC", unit: "million/ejaculate", sortOrder: 8, refLow: 39 },
      { name: "Total Motility (PR + NP)", fieldType: "NUMERIC", unit: "%", sortOrder: 9, refLow: 42 },
      { name: "Progressive Motility (PR)", fieldType: "NUMERIC", unit: "%", sortOrder: 10, refLow: 30 },
      { name: "Non-Progressive Motility (NP)", fieldType: "NUMERIC", unit: "%", sortOrder: 11 },
      { name: "Immotile", fieldType: "NUMERIC", unit: "%", sortOrder: 12 },
      { name: "Normal Morphology", fieldType: "NUMERIC", unit: "%", sortOrder: 13, refLow: 4 },
      { name: "Pus Cells", fieldType: "TEXT", unit: "/HPF", sortOrder: 14 },
      { name: "RBCs", fieldType: "TEXT", unit: "/HPF", sortOrder: 15 },
      { name: "Impression", fieldType: "TEXT", unit: "", sortOrder: 16 },
    ],
  },

  // ═══ BLOOD GROUP ════════════════════════════════════
  PT_BLOOD_GROUP: {
    parameters: [
      { name: "ABO Blood Group", fieldType: "OPTION", unit: "", sortOrder: 1, options: ["A", "B", "AB", "O"] },
      { name: "Rh Factor", fieldType: "OPTION", unit: "", sortOrder: 2, options: ["Positive", "Negative"] },
      { name: "Blood Group & Rh Type", fieldType: "TEXT", unit: "", sortOrder: 3 },
    ],
  },

  // ═══ ELECTROLYTES ═══════════════════════════════════
  PT_ELECTROLYTES: {
    parameters: [
      { name: "Sodium (Na+)", fieldType: "NUMERIC", unit: "mEq/L", sortOrder: 1, refLow: 136, refHigh: 145, critLow: 120, critHigh: 160 },
      { name: "Potassium (K+)", fieldType: "NUMERIC", unit: "mEq/L", sortOrder: 2, refLow: 3.5, refHigh: 5.1, critLow: 2.8, critHigh: 6.5 },
      { name: "Chloride (Cl-)", fieldType: "NUMERIC", unit: "mEq/L", sortOrder: 3, refLow: 98, refHigh: 107, critLow: 80, critHigh: 120 },
      { name: "Bicarbonate (HCO3-)", fieldType: "NUMERIC", unit: "mEq/L", sortOrder: 4, refLow: 22, refHigh: 29, critLow: 10, critHigh: 40 },
      { name: "Calcium (Total)", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 5, refLow: 8.5, refHigh: 10.5, critLow: 7.0, critHigh: 13.0 },
      { name: "Phosphorus", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 6, refLow: 2.5, refHigh: 4.5 },
      { name: "Magnesium", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 7, refLow: 1.7, refHigh: 2.2, critLow: 1.0, critHigh: 4.0 },
    ],
  },

  // ═══ HBA1C (STANDALONE) ══════════════════════════════
  PT_HBA1C: {
    parameters: [
      { name: "HbA1c (Glycated Haemoglobin)", fieldType: "NUMERIC", unit: "%", sortOrder: 1, refHigh: 5.7, critHigh: 14 },
      { name: "eAG (Estimated Average Glucose)", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 2 },
      { name: "Interpretation", fieldType: "OPTION", unit: "", sortOrder: 3, options: ["Normal (<5.7%)", "Pre-diabetes (5.7-6.4%)", "Diabetes (≥6.5%)"] },
    ],
  },

  // ═══ BLOOD GLUCOSE (STANDALONE) ══════════════════════
  PT_FBS: {
    parameters: [
      { name: "Fasting Blood Sugar (FBS)", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 1, refLow: 70, refHigh: 100, critLow: 40, critHigh: 500 },
    ],
  },

  PT_PPBS: {
    parameters: [
      { name: "Post-Prandial Blood Sugar (PPBS)", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 1, refLow: 70, refHigh: 140, critLow: 40, critHigh: 500 },
    ],
  },

  PT_RBS: {
    parameters: [
      { name: "Random Blood Sugar (RBS)", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 1, refLow: 70, refHigh: 140, critLow: 40, critHigh: 500 },
    ],
  },

  // ═══ URINE SPECIAL ═══════════════════════════════════
  PT_URINE_PROTEIN: {
    parameters: [
      { name: "24-Hr Urine Protein", fieldType: "NUMERIC", unit: "mg/24hr", sortOrder: 1, refHigh: 150 },
      { name: "Urine Volume (24hr)", fieldType: "NUMERIC", unit: "mL", sortOrder: 2 },
      { name: "Spot Urine Protein-Creatinine Ratio", fieldType: "NUMERIC", unit: "", sortOrder: 3, refHigh: 0.2 },
    ],
  },

  PT_MICROALBUMIN: {
    parameters: [
      { name: "Urine Microalbumin", fieldType: "NUMERIC", unit: "mg/L", sortOrder: 1, refHigh: 20 },
      { name: "Urine Creatinine", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 2 },
      { name: "Microalbumin/Creatinine Ratio (ACR)", fieldType: "NUMERIC", unit: "mg/g", sortOrder: 3, refHigh: 30 },
    ],
  },

  // ═══ THYROID ANTIBODIES ══════════════════════════════
  PT_THYROID_AB: {
    parameters: [
      { name: "Anti-TPO (Thyroid Peroxidase Antibody)", fieldType: "NUMERIC", unit: "IU/mL", sortOrder: 1, refHigh: 34 },
      { name: "Anti-Thyroglobulin (Anti-TG)", fieldType: "NUMERIC", unit: "IU/mL", sortOrder: 2, refHigh: 115 },
      { name: "Thyroglobulin", fieldType: "NUMERIC", unit: "ng/mL", sortOrder: 3, refLow: 1.4, refHigh: 78 },
    ],
  },

  // ═══ COMPREHENSIVE METABOLIC PANEL ═══════════════════
  PT_CMP: {
    parameters: [
      // Renal
      { name: "Blood Urea Nitrogen (BUN)", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 1, refLow: 7, refHigh: 20, critHigh: 100 },
      { name: "Creatinine", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 2, refLow: 0.7, refHigh: 1.3, critHigh: 10 },
      { name: "eGFR", fieldType: "NUMERIC", unit: "mL/min", sortOrder: 3, refLow: 60, critLow: 15 },
      // Electrolytes
      { name: "Sodium", fieldType: "NUMERIC", unit: "mEq/L", sortOrder: 4, refLow: 136, refHigh: 145, critLow: 120, critHigh: 160 },
      { name: "Potassium", fieldType: "NUMERIC", unit: "mEq/L", sortOrder: 5, refLow: 3.5, refHigh: 5.1, critLow: 2.8, critHigh: 6.5 },
      { name: "Chloride", fieldType: "NUMERIC", unit: "mEq/L", sortOrder: 6, refLow: 98, refHigh: 107 },
      { name: "Bicarbonate", fieldType: "NUMERIC", unit: "mEq/L", sortOrder: 7, refLow: 22, refHigh: 29 },
      { name: "Calcium", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 8, refLow: 8.5, refHigh: 10.5, critLow: 7.0 },
      // Liver
      { name: "Total Protein", fieldType: "NUMERIC", unit: "g/dL", sortOrder: 9, refLow: 6.3, refHigh: 8.2 },
      { name: "Albumin", fieldType: "NUMERIC", unit: "g/dL", sortOrder: 10, refLow: 3.5, refHigh: 5.0, critLow: 1.5 },
      { name: "Total Bilirubin", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 11, refLow: 0.2, refHigh: 1.2, critHigh: 15 },
      { name: "SGOT (AST)", fieldType: "NUMERIC", unit: "U/L", sortOrder: 12, refLow: 10, refHigh: 40, critHigh: 1000 },
      { name: "SGPT (ALT)", fieldType: "NUMERIC", unit: "U/L", sortOrder: 13, refLow: 7, refHigh: 56, critHigh: 1000 },
      { name: "ALP", fieldType: "NUMERIC", unit: "U/L", sortOrder: 14, refLow: 44, refHigh: 147 },
      // Glucose
      { name: "Fasting Blood Glucose", fieldType: "NUMERIC", unit: "mg/dL", sortOrder: 15, refLow: 70, refHigh: 100, critLow: 40, critHigh: 500 },
    ],
  },

  // ═══ AMYLASE / LIPASE ════════════════════════════════
  PT_PANCREAS: {
    parameters: [
      { name: "Serum Amylase", fieldType: "NUMERIC", unit: "U/L", sortOrder: 1, refLow: 25, refHigh: 125, critHigh: 600 },
      { name: "Serum Lipase", fieldType: "NUMERIC", unit: "U/L", sortOrder: 2, refLow: 10, refHigh: 140, critHigh: 600 },
    ],
  },

  // ═══ SERUM PROTEIN ELECTROPHORESIS ══════════════════
  PT_SERUM_PROTEIN: {
    parameters: [
      { name: "Total Protein", fieldType: "NUMERIC", unit: "g/dL", sortOrder: 1, refLow: 6.3, refHigh: 8.2 },
      { name: "Albumin", fieldType: "NUMERIC", unit: "g/dL", sortOrder: 2, refLow: 3.5, refHigh: 5.0 },
      { name: "Alpha-1 Globulin", fieldType: "NUMERIC", unit: "g/dL", sortOrder: 3, refLow: 0.1, refHigh: 0.3 },
      { name: "Alpha-2 Globulin", fieldType: "NUMERIC", unit: "g/dL", sortOrder: 4, refLow: 0.6, refHigh: 1.0 },
      { name: "Beta Globulin", fieldType: "NUMERIC", unit: "g/dL", sortOrder: 5, refLow: 0.7, refHigh: 1.2 },
      { name: "Gamma Globulin", fieldType: "NUMERIC", unit: "g/dL", sortOrder: 6, refLow: 0.7, refHigh: 1.6 },
      { name: "A/G Ratio", fieldType: "NUMERIC", unit: "", sortOrder: 7, refLow: 1.0, refHigh: 2.5 },
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
  // Reproductive hormones
  { keywords: ["testosterone"], configKey: "PT_TESTOSTERONE" },
  { keywords: ["prolactin"], configKey: "PT_PROLACTIN" },
  { keywords: ["estradiol", "oestradiol"], configKey: "PT_ESTRADIOL" },
  { keywords: ["progesterone"], configKey: "PT_PROGESTERONE" },
  { keywords: ["female hormone panel", "reproductive hormone", "hormone profile", "amh", "anti-mullerian"], configKey: "PT_HORMONES_FULL" },
  // Tumour markers
  { keywords: ["prostate specific antigen", "psa", "prostate antigen"], configKey: "PT_PSA" },
  { keywords: ["alpha fetoprotein", "alpha-fetoprotein", "afp"], configKey: "PT_AFP" },
  { keywords: ["carcinoembryonic", "cea"], configKey: "PT_CEA" },
  { keywords: ["ca-125", "ca 125", "ovarian"], configKey: "PT_CA125" },
  { keywords: ["ca 19-9", "ca19-9"], configKey: "PT_CA199" },
  { keywords: ["ca 15-3", "ca15-3"], configKey: "PT_CA153" },
  { keywords: ["tumour marker panel", "tumor marker panel", "oncomarker"], configKey: "PT_TUMOUR_FULL" },
  // Infections
  { keywords: ["hbsag", "hepatitis b surface", "hbs antigen"], configKey: "PT_HBSAG" },
  { keywords: ["anti-hcv", "hepatitis c antibody", "hcv antibody"], configKey: "PT_HCV" },
  { keywords: ["hepatitis b and c", "hbsag and hcv", "hepatitis panel"], configKey: "PT_HBSAG_HCV" },
  { keywords: ["hiv", "human immunodeficiency"], configKey: "PT_HIV" },
  { keywords: ["vdrl", "syphilis", "tpha", "rpr"], configKey: "PT_VDRL" },
  { keywords: ["dengue ns1", "dengue antigen"], configKey: "PT_DENGUE_NS1" },
  { keywords: ["dengue igm"], configKey: "PT_DENGUE_IGM" },
  { keywords: ["dengue panel", "dengue fever panel", "dengue ns1 igm igg"], configKey: "PT_DENGUE_PANEL" },
  { keywords: ["malaria antigen", "malaria pf pv", "malaria ag", "malarial"], configKey: "PT_MALARIA" },
  { keywords: ["widal", "typhoid test", "enteric fever"], configKey: "PT_WIDAL" },
  { keywords: ["scrub typhus"], configKey: "PT_SCRUB_TYPHUS" },
  { keywords: ["leptospira", "leptospirosis"], configKey: "PT_LEPTOSPIRA" },
  { keywords: ["covid-19 antigen", "covid antigen", "sars-cov-2 antigen", "corona antigen"], configKey: "PT_COVID_AG" },
  { keywords: ["covid igg", "covid antibody", "sars-cov-2 antibody", "covid-19 igg"], configKey: "PT_COVID_IGG" },
  // Autoimmune
  { keywords: ["rheumatoid factor", "ra factor", "rf test"], configKey: "PT_RA_FACTOR" },
  { keywords: ["aso titre", "anti streptolysin", "aslo"], configKey: "PT_ASO" },
  { keywords: ["antinuclear antibody", "ana", "anti-nuclear"], configKey: "PT_ANA" },
  { keywords: ["anti-ccp", "cyclic citrullinated peptide", "ccp antibody"], configKey: "PT_CCP" },
  { keywords: ["autoimmune panel", "arthritis panel", "connective tissue"], configKey: "PT_AUTOIMMUNE_PANEL" },
  // Stool & Semen
  { keywords: ["stool", "faeces", "fecal", "stool routine", "stool examination"], configKey: "PT_STOOL" },
  { keywords: ["semen analysis", "semen examination", "sperm analysis", "seminogram"], configKey: "PT_SEMEN" },
  // Blood group
  { keywords: ["blood group", "blood grouping", "abo rh", "blood type"], configKey: "PT_BLOOD_GROUP" },
  // Electrolytes
  { keywords: ["electrolytes", "serum electrolyte", "ion panel"], configKey: "PT_ELECTROLYTES" },
  // Glucose standalone
  { keywords: ["hba1c", "glycated haemoglobin", "glycosylated haemoglobin", "haemoglobin a1c"], configKey: "PT_HBA1C" },
  { keywords: ["fasting blood sugar", "fasting glucose", "fbs", "fasting blood glucose"], configKey: "PT_FBS" },
  { keywords: ["post prandial", "postprandial", "ppbs", "2hr glucose", "2 hour glucose"], configKey: "PT_PPBS" },
  { keywords: ["random blood sugar", "random glucose", "rbs", "casual glucose"], configKey: "PT_RBS" },
  // Urine special
  { keywords: ["24 hour urine protein", "24hr protein", "spot protein creatinine"], configKey: "PT_URINE_PROTEIN" },
  { keywords: ["microalbumin", "microalbuminuria", "urine albumin creatinine"], configKey: "PT_MICROALBUMIN" },
  // Thyroid antibodies
  { keywords: ["anti-tpo", "thyroid peroxidase", "thyroid antibody", "anti-thyroglobulin"], configKey: "PT_THYROID_AB" },
  // Comprehensive metabolic
  { keywords: ["comprehensive metabolic panel", "cmp", "basic metabolic"], configKey: "PT_CMP" },
  // Pancreas
  { keywords: ["amylase", "lipase", "pancreatic enzyme", "pancreatitis panel"], configKey: "PT_PANCREAS" },
  // Serum protein
  { keywords: ["serum protein electrophoresis", "spe", "spep", "protein electrophoresis"], configKey: "PT_SERUM_PROTEIN" },
];
