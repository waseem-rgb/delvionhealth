import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

type SectionType = "text" | "richtext" | "checkbox" | "select" | "disc_table" | "molecular_results" | "biometric_table";

interface ReportSection {
  id: string;
  label: string;
  type: SectionType;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  subsections?: Array<{ id: string; label: string; type: SectionType }>;
}

interface TemplateDefinition {
  investigationType: string;
  testType?: string;
  templateName: string;
  methodology: string;
  isDefault: boolean;
  sections: ReportSection[];
}

const TEMPLATES: TemplateDefinition[] = [
  // ── X-RAY ──────────────────────────────────────────────────────────────────
  {
    investigationType: "X-RAY",
    templateName: "X-Ray - Standard",
    methodology: "Digital Radiography",
    isDefault: true,
    sections: [
      { id: "clinicalHistory", label: "Clinical History", type: "text", required: true, placeholder: "Clinical indication / relevant history..." },
      {
        id: "technique",
        label: "Technique",
        type: "text",
        defaultValue: "Digital radiographic examination performed in standard projections. Technical quality: satisfactory.",
        placeholder: "Describe technique...",
      },
      {
        id: "findings",
        label: "Findings",
        type: "richtext",
        required: true,
        placeholder: "Describe radiological findings...",
        subsections: [
          { id: "bones", label: "Bones & Joints", type: "text" },
          { id: "softTissues", label: "Soft Tissues", type: "text" },
          { id: "airSpaces", label: "Air Spaces / Lung Fields", type: "text" },
          { id: "other", label: "Other Findings", type: "text" },
        ],
      },
      { id: "impression", label: "Impression / Conclusion", type: "richtext", required: true, placeholder: "Radiological impression..." },
      { id: "recommendation", label: "Recommendations", type: "text", placeholder: "Further imaging / clinical correlation recommended..." },
    ],
  },

  // ── CT BRAIN ───────────────────────────────────────────────────────────────
  {
    investigationType: "CT",
    testType: "CT Brain",
    templateName: "CT Brain - Standard",
    methodology: "Computed Tomography",
    isDefault: true,
    sections: [
      { id: "clinicalHistory", label: "Clinical History", type: "text", required: true },
      {
        id: "technique",
        label: "Technique",
        type: "text",
        defaultValue:
          "MDCT brain examination was performed with contiguous axial sections from skull base to vertex. Slice thickness: 5mm. Reformatted coronal and sagittal images obtained.",
      },
      {
        id: "findings",
        label: "Findings",
        type: "richtext",
        required: true,
        subsections: [
          { id: "brainParenchyma", label: "Brain Parenchyma", type: "text" },
          { id: "cerebralCortex", label: "Cerebral Cortex", type: "text" },
          { id: "basalGanglia", label: "Basal Ganglia", type: "text" },
          { id: "brainstem", label: "Brainstem", type: "text" },
          { id: "cerebellum", label: "Cerebellum", type: "text" },
          { id: "ventricles", label: "Ventricles", type: "text" },
          { id: "sulciGyri", label: "Sulci & Gyri", type: "text" },
          { id: "midline", label: "Midline Structures", type: "text" },
          { id: "extraAxial", label: "Extra-axial Spaces", type: "text" },
          { id: "skullBase", label: "Skull Vault & Base", type: "text" },
          { id: "orbits", label: "Visualized Orbits & Sinuses", type: "text" },
        ],
      },
      { id: "impression", label: "Impression / Conclusion", type: "richtext", required: true },
      { id: "recommendation", label: "Recommendations", type: "text" },
    ],
  },

  // ── CT ABDOMEN ─────────────────────────────────────────────────────────────
  {
    investigationType: "CT",
    testType: "CT Abdomen",
    templateName: "CT Abdomen - Standard",
    methodology: "Computed Tomography",
    isDefault: false,
    sections: [
      { id: "clinicalHistory", label: "Clinical History", type: "text", required: true },
      {
        id: "technique",
        label: "Technique",
        type: "text",
        defaultValue:
          "MDCT abdomen examination performed with helical technique. Axial, coronal and sagittal reformats reviewed.",
      },
      {
        id: "findings",
        label: "Findings",
        type: "richtext",
        required: true,
        subsections: [
          { id: "liver", label: "Liver", type: "text" },
          { id: "gallbladder", label: "Gallbladder & Biliary System", type: "text" },
          { id: "pancreas", label: "Pancreas", type: "text" },
          { id: "spleen", label: "Spleen", type: "text" },
          { id: "kidneys", label: "Kidneys & Ureters", type: "text" },
          { id: "bladder", label: "Urinary Bladder", type: "text" },
          { id: "adrenals", label: "Adrenal Glands", type: "text" },
          { id: "bowel", label: "Bowel & Mesentery", type: "text" },
          { id: "peritoneum", label: "Peritoneum & Ascites", type: "text" },
          { id: "lymphNodes", label: "Lymph Nodes", type: "text" },
          { id: "bones", label: "Bones & Soft Tissues", type: "text" },
          { id: "vascular", label: "Vascular Structures", type: "text" },
        ],
      },
      { id: "impression", label: "Impression / Conclusion", type: "richtext", required: true },
      { id: "recommendation", label: "Recommendations", type: "text" },
    ],
  },

  // ── CT CHEST ───────────────────────────────────────────────────────────────
  {
    investigationType: "CT",
    testType: "CT Chest",
    templateName: "CT Chest / HRCT - Standard",
    methodology: "Computed Tomography",
    isDefault: false,
    sections: [
      { id: "clinicalHistory", label: "Clinical History", type: "text", required: true },
      {
        id: "technique",
        label: "Technique",
        type: "text",
        defaultValue: "HRCT/CT chest performed in supine position during breath hold at full inspiration.",
      },
      {
        id: "findings",
        label: "Findings",
        type: "richtext",
        required: true,
        subsections: [
          { id: "lungRight", label: "Lungs - Right", type: "text" },
          { id: "lungLeft", label: "Lungs - Left", type: "text" },
          { id: "airway", label: "Trachea & Main Bronchi", type: "text" },
          { id: "pleura", label: "Pleura", type: "text" },
          { id: "mediastinum", label: "Mediastinum", type: "text" },
          { id: "heart", label: "Heart & Pericardium", type: "text" },
          { id: "chestWall", label: "Chest Wall & Ribs", type: "text" },
          { id: "diaphragm", label: "Diaphragm", type: "text" },
          { id: "upperAbdomen", label: "Visualized Abdomen", type: "text" },
        ],
      },
      { id: "impression", label: "Impression / Conclusion", type: "richtext", required: true },
      { id: "recommendation", label: "Recommendations", type: "text" },
    ],
  },

  // ── MRI BRAIN ──────────────────────────────────────────────────────────────
  {
    investigationType: "MRI",
    testType: "MRI Brain",
    templateName: "MRI Brain - Standard",
    methodology: "Magnetic Resonance Imaging",
    isDefault: true,
    sections: [
      { id: "clinicalHistory", label: "Clinical History", type: "text", required: true },
      {
        id: "technique",
        label: "Technique",
        type: "text",
        defaultValue: "MRI brain performed. Sequences: T1W, T2W, FLAIR, DWI/ADC, GRE. Axial, coronal and sagittal planes reviewed.",
      },
      {
        id: "findings",
        label: "Findings",
        type: "richtext",
        required: true,
        subsections: [
          { id: "brainParenchyma", label: "Brain Parenchyma", type: "text" },
          { id: "whiteMatter", label: "White Matter", type: "text" },
          { id: "greyMatter", label: "Grey Matter", type: "text" },
          { id: "basalGanglia", label: "Basal Ganglia & Thalami", type: "text" },
          { id: "brainstem", label: "Brainstem", type: "text" },
          { id: "cerebellum", label: "Cerebellum", type: "text" },
          { id: "ventricles", label: "Ventricular System", type: "text" },
          { id: "subarachnoid", label: "Subarachnoid Spaces", type: "text" },
          { id: "sella", label: "Sella & Parasellar Region", type: "text" },
          { id: "extraAxial", label: "Extra-axial Spaces", type: "text" },
          { id: "vessels", label: "Flow Voids & Vessels", type: "text" },
          { id: "skull", label: "Skull Base & Calvarium", type: "text" },
          { id: "orbits", label: "Orbits & Optic Nerves", type: "text" },
          { id: "dwiFindings", label: "DWI Findings", type: "text" },
          { id: "contrast", label: "Post-Contrast Enhancement", type: "text" },
        ],
      },
      { id: "impression", label: "Impression / Conclusion", type: "richtext", required: true },
      { id: "recommendation", label: "Recommendations", type: "text" },
    ],
  },

  // ── MRI SPINE ──────────────────────────────────────────────────────────────
  {
    investigationType: "MRI",
    testType: "MRI Spine",
    templateName: "MRI Spine - Standard",
    methodology: "Magnetic Resonance Imaging",
    isDefault: false,
    sections: [
      { id: "clinicalHistory", label: "Clinical History", type: "text", required: true },
      {
        id: "technique",
        label: "Technique",
        type: "text",
        defaultValue: "MRI spine performed. Sequences: T1W sagittal, T2W sagittal, T2W axial, STIR sagittal.",
      },
      {
        id: "findings",
        label: "Findings",
        type: "richtext",
        required: true,
        subsections: [
          { id: "vertebralBodies", label: "Vertebral Bodies & Alignment", type: "text" },
          { id: "discs", label: "Intervertebral Discs", type: "text" },
          { id: "spinalCanal", label: "Spinal Canal", type: "text" },
          { id: "spinalCord", label: "Spinal Cord / Conus", type: "text" },
          { id: "neuralForamina", label: "Neural Foramina", type: "text" },
          { id: "paraspinal", label: "Paraspinal Soft Tissues", type: "text" },
          { id: "posteriorElements", label: "Posterior Elements", type: "text" },
          { id: "contrast", label: "Post-Contrast Enhancement", type: "text" },
        ],
      },
      {
        id: "discTable",
        label: "Disc Level Analysis",
        type: "disc_table",
        placeholder: "Level | Disc Height | Signal | Disc Pathology | Canal Stenosis | Foraminal Stenosis",
      },
      { id: "impression", label: "Impression / Conclusion", type: "richtext", required: true },
      { id: "recommendation", label: "Recommendations", type: "text" },
    ],
  },

  // ── USG WHOLE ABDOMEN ──────────────────────────────────────────────────────
  {
    investigationType: "USG",
    testType: "USG Whole Abdomen",
    templateName: "USG Whole Abdomen - Standard",
    methodology: "Ultrasonography",
    isDefault: true,
    sections: [
      { id: "clinicalHistory", label: "Clinical History", type: "text", required: true },
      {
        id: "technique",
        label: "Technique",
        type: "text",
        defaultValue: "USG whole abdomen performed using high-frequency probe with standard grey-scale B-mode imaging.",
      },
      {
        id: "findings",
        label: "Findings",
        type: "richtext",
        required: true,
        subsections: [
          { id: "liver", label: "Liver (size, echogenicity, focal lesions, vessels)", type: "text" },
          { id: "gallbladder", label: "Gallbladder (size, wall, calculi)", type: "text" },
          { id: "cbd", label: "Common Bile Duct (calibre)", type: "text" },
          { id: "pancreas", label: "Pancreas (size, echogenicity, duct)", type: "text" },
          { id: "spleen", label: "Spleen (size, echogenicity)", type: "text" },
          { id: "kidneyRight", label: "Right Kidney (size, cortex, CMD, collecting system)", type: "text" },
          { id: "kidneyLeft", label: "Left Kidney (size, cortex, CMD, collecting system)", type: "text" },
          { id: "bladder", label: "Urinary Bladder (distension, wall, lumen)", type: "text" },
          { id: "aortaIVC", label: "Aorta & IVC", type: "text" },
          { id: "ascites", label: "Ascites / Free Fluid", type: "text" },
          { id: "lymphNodes", label: "Lymph Nodes", type: "text" },
          { id: "other", label: "Other", type: "text" },
        ],
      },
      { id: "impression", label: "Impression / Conclusion", type: "richtext", required: true },
      { id: "recommendation", label: "Recommendations", type: "text" },
    ],
  },

  // ── USG OBSTETRIC ──────────────────────────────────────────────────────────
  {
    investigationType: "USG",
    testType: "USG Obstetric",
    templateName: "USG Obstetric / Pregnancy Scan",
    methodology: "Ultrasonography",
    isDefault: false,
    sections: [
      { id: "clinicalHistory", label: "Clinical History", type: "text", required: true },
      {
        id: "technique",
        label: "Technique",
        type: "text",
        defaultValue: "Transabdominal and/or transvaginal ultrasound performed.",
      },
      {
        id: "findings",
        label: "Findings",
        type: "richtext",
        required: true,
        subsections: [
          { id: "foetusCount", label: "Number of Foetuses", type: "text" },
          { id: "presentation", label: "Presentation", type: "text" },
          { id: "biometry", label: "Biometric Parameters (BPD / HC / AC / FL / EFW)", type: "text" },
          { id: "cardiacActivity", label: "Cardiac Activity", type: "text" },
          { id: "placenta", label: "Placenta (site, grade, praevia)", type: "text" },
          { id: "liquor", label: "Liquor Amnii (AFI / MVP)", type: "text" },
          { id: "umbilicalCord", label: "Umbilical Cord", type: "text" },
          { id: "anatomy", label: "Foetal Anatomy Survey", type: "text" },
          { id: "cervix", label: "Cervix & Lower Uterine Segment", type: "text" },
          { id: "uterus", label: "Uterus & Adnexa", type: "text" },
        ],
      },
      { id: "gestationalAge", label: "Gestational Age & EDD", type: "text" },
      { id: "impression", label: "Impression / Conclusion", type: "richtext", required: true },
      { id: "recommendation", label: "Recommendations", type: "text" },
    ],
  },

  // ── DOPPLER ────────────────────────────────────────────────────────────────
  {
    investigationType: "DOPPLER",
    templateName: "Doppler - Standard",
    methodology: "Color Doppler Ultrasonography",
    isDefault: true,
    sections: [
      { id: "clinicalHistory", label: "Clinical History", type: "text", required: true },
      {
        id: "technique",
        label: "Technique",
        type: "text",
        defaultValue: "Color Doppler and spectral analysis performed using high-frequency probe.",
      },
      {
        id: "findings",
        label: "Findings",
        type: "richtext",
        required: true,
        subsections: [
          { id: "greyScale", label: "Grey Scale Findings", type: "text" },
          { id: "colorFlow", label: "Color Flow Mapping", type: "text" },
          { id: "spectral", label: "Spectral Analysis", type: "text" },
          { id: "waveform", label: "Waveform Characteristics", type: "text" },
          { id: "indices", label: "Resistivity Index / Pulsatility Index", type: "text" },
        ],
      },
      { id: "impression", label: "Impression / Conclusion", type: "richtext", required: true },
      { id: "recommendation", label: "Recommendations", type: "text" },
    ],
  },

  // ── MOLECULAR ──────────────────────────────────────────────────────────────
  {
    investigationType: "MOLECULAR",
    templateName: "Molecular / PCR - Standard",
    methodology: "Molecular Testing",
    isDefault: true,
    sections: [
      { id: "clinicalHistory", label: "Clinical History", type: "text" },
      {
        id: "sampleInfo",
        label: "Sample Information",
        type: "text",
        placeholder: "Sample type, collection date, received date, condition on receipt...",
      },
      {
        id: "methodology",
        label: "Methodology",
        type: "text",
        defaultValue:
          "Real-time quantitative PCR performed using validated diagnostic kit. Internal controls included. Results interpreted per manufacturer criteria.",
      },
      {
        id: "results",
        label: "Results",
        type: "molecular_results",
        placeholder: "Analyte | Result | Cut-off | Interpretation",
      },
      { id: "comments", label: "Comments", type: "text" },
      { id: "impression", label: "Interpretation / Conclusion", type: "richtext", required: true },
      { id: "recommendation", label: "Recommendations", type: "text" },
      {
        id: "qcNote",
        label: "Quality Control",
        type: "text",
        defaultValue: "All controls within acceptable limits. Results are reliable.",
      },
    ],
  },

  // ── GENETIC ────────────────────────────────────────────────────────────────
  {
    investigationType: "GENETIC",
    templateName: "Genetic Testing - Standard",
    methodology: "Genetic Testing",
    isDefault: true,
    sections: [
      { id: "clinicalHistory", label: "Clinical History & Indication", type: "text", required: true },
      {
        id: "sampleInfo",
        label: "Sample Information",
        type: "text",
        placeholder: "Sample type, date collected, date received, condition...",
      },
      {
        id: "methodology",
        label: "Methodology",
        type: "text",
        defaultValue: "Genetic testing performed per standard protocols.",
      },
      {
        id: "findings",
        label: "Results",
        type: "richtext",
        required: true,
        subsections: [
          { id: "chromosomalFindings", label: "Chromosomal / Molecular Findings", type: "text" },
          { id: "iscnNomenclature", label: "ISCN Nomenclature (if applicable)", type: "text" },
          { id: "variantClassification", label: "Variant Classification (ACMG)", type: "text" },
        ],
      },
      { id: "impression", label: "Interpretation / Conclusion", type: "richtext", required: true },
      { id: "counsellingNote", label: "Genetic Counselling Note", type: "text" },
      { id: "references", label: "References", type: "text" },
      {
        id: "disclaimer",
        label: "Disclaimer",
        type: "text",
        defaultValue:
          "This report is issued for the exclusive use of the patient/clinician requesting the test. Results should be interpreted in the context of clinical findings and family history.",
      },
    ],
  },
];

@Injectable()
export class NonPathTemplateSeedService {
  constructor(private readonly prisma: PrismaService) {}

  async seedTemplates(tenantId: string): Promise<{ seeded: number; skipped: number }> {
    let seeded = 0;
    let skipped = 0;

    for (const tmpl of TEMPLATES) {
      const existing = await this.prisma.nonPathReportTemplate.findFirst({
        where: { tenantId, investigationType: tmpl.investigationType, templateName: tmpl.templateName },
      });
      if (existing) {
        skipped++;
        continue;
      }
      await this.prisma.nonPathReportTemplate.create({
        data: {
          tenantId,
          investigationType: tmpl.investigationType,
          testType: tmpl.testType,
          templateName: tmpl.templateName,
          methodology: tmpl.methodology,
          isDefault: tmpl.isDefault,
          sections: tmpl.sections as never,
        },
      });
      seeded++;
    }
    return { seeded, skipped };
  }

  getDefaultTemplates() {
    return TEMPLATES;
  }
}
