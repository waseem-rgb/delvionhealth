import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Fuse from 'fuse.js';

export interface LoincEntry {
  testName: string;
  aliases?: string[];
  loincCode: string;
  loincDisplay: string;
  snomedCode?: string;
  snomedDisplay?: string;
  ucumUnit?: string;
}

// 32-entry curated map for common Indian lab tests
const LOINC_MAP: LoincEntry[] = [
  { testName: 'Hemoglobin', aliases: ['HGB', 'Hb'], loincCode: '718-7', loincDisplay: 'Hemoglobin [Mass/volume] in Blood', ucumUnit: 'g/dL', snomedCode: '259695003', snomedDisplay: 'Hemoglobin' },
  { testName: 'Hematocrit', aliases: ['HCT', 'PCV'], loincCode: '20570-8', loincDisplay: 'Hematocrit [Volume Fraction] of Blood', ucumUnit: '%' },
  { testName: 'White Blood Cell Count', aliases: ['WBC', 'Leukocyte count', 'TLC'], loincCode: '6690-2', loincDisplay: 'Leukocytes [#/volume] in Blood by Automated count', ucumUnit: '10*3/uL' },
  { testName: 'Platelet Count', aliases: ['PLT', 'Thrombocytes'], loincCode: '777-3', loincDisplay: 'Platelets [#/volume] in Blood by Automated count', ucumUnit: '10*3/uL' },
  { testName: 'Red Blood Cell Count', aliases: ['RBC', 'Erythrocyte count'], loincCode: '789-8', loincDisplay: 'Erythrocytes [#/volume] in Blood by Automated count', ucumUnit: '10*6/uL' },
  { testName: 'Mean Corpuscular Volume', aliases: ['MCV'], loincCode: '787-2', loincDisplay: 'MCV [Entitic volume] by Automated count', ucumUnit: 'fL' },
  { testName: 'Mean Corpuscular Hemoglobin', aliases: ['MCH'], loincCode: '785-6', loincDisplay: 'MCH [Entitic mass] by Automated count', ucumUnit: 'pg' },
  { testName: 'MCHC', aliases: ['Mean Corpuscular Hemoglobin Concentration'], loincCode: '786-4', loincDisplay: 'MCHC [Mass/volume] by Automated count', ucumUnit: 'g/dL' },
  { testName: 'Fasting Blood Sugar', aliases: ['FBS', 'FBG', 'Glucose Fasting', 'Blood Glucose Fasting'], loincCode: '1558-6', loincDisplay: 'Fasting glucose [Mass/volume] in Serum or Plasma', ucumUnit: 'mg/dL', snomedCode: '33747003', snomedDisplay: 'Glucose' },
  { testName: 'Post Prandial Blood Sugar', aliases: ['PPBS', 'PP2BS', '2 hour glucose'], loincCode: '1521-4', loincDisplay: 'Glucose 2 Hr Post Dose [Mass/volume] in Serum or Plasma', ucumUnit: 'mg/dL' },
  { testName: 'HbA1c', aliases: ['Glycated Hemoglobin', 'A1C', 'Hemoglobin A1c'], loincCode: '4548-4', loincDisplay: 'Hemoglobin A1c/Hemoglobin.total in Blood', ucumUnit: '%', snomedCode: '43396009', snomedDisplay: 'HbA1c' },
  { testName: 'Serum Creatinine', aliases: ['Creatinine', 'S.Creatinine'], loincCode: '2160-0', loincDisplay: 'Creatinine [Mass/volume] in Serum or Plasma', ucumUnit: 'mg/dL', snomedCode: '70901006', snomedDisplay: 'Creatinine' },
  { testName: 'Blood Urea Nitrogen', aliases: ['BUN', 'Urea Nitrogen'], loincCode: '3094-0', loincDisplay: 'Urea nitrogen [Mass/volume] in Serum or Plasma', ucumUnit: 'mg/dL' },
  { testName: 'Uric Acid', aliases: ['Serum Uric Acid', 'S.Uric Acid'], loincCode: '3084-1', loincDisplay: 'Urate [Mass/volume] in Serum or Plasma', ucumUnit: 'mg/dL' },
  { testName: 'Total Cholesterol', aliases: ['Cholesterol', 'S.Cholesterol'], loincCode: '2093-3', loincDisplay: 'Cholesterol [Mass/volume] in Serum or Plasma', ucumUnit: 'mg/dL', snomedCode: '77068002', snomedDisplay: 'Cholesterol' },
  { testName: 'Triglycerides', aliases: ['TG', 'TRIG'], loincCode: '2571-8', loincDisplay: 'Triglyceride [Mass/volume] in Serum or Plasma', ucumUnit: 'mg/dL' },
  { testName: 'HDL Cholesterol', aliases: ['HDL', 'High Density Lipoprotein'], loincCode: '2085-9', loincDisplay: 'Cholesterol in HDL [Mass/volume] in Serum or Plasma', ucumUnit: 'mg/dL' },
  { testName: 'LDL Cholesterol', aliases: ['LDL', 'Low Density Lipoprotein'], loincCode: '2089-1', loincDisplay: 'Cholesterol in LDL [Mass/volume] in Serum or Plasma', ucumUnit: 'mg/dL' },
  { testName: 'SGOT', aliases: ['AST', 'Aspartate Aminotransferase', 'S.G.O.T'], loincCode: '1920-8', loincDisplay: 'Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma', ucumUnit: 'U/L' },
  { testName: 'SGPT', aliases: ['ALT', 'Alanine Aminotransferase', 'S.G.P.T'], loincCode: '1742-6', loincDisplay: 'Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma', ucumUnit: 'U/L' },
  { testName: 'Total Bilirubin', aliases: ['Bilirubin Total', 'T.Bil'], loincCode: '1975-2', loincDisplay: 'Bilirubin.total [Mass/volume] in Serum or Plasma', ucumUnit: 'mg/dL' },
  { testName: 'Direct Bilirubin', aliases: ['Bilirubin Direct', 'D.Bil', 'Conjugated Bilirubin'], loincCode: '1968-7', loincDisplay: 'Bilirubin.direct [Mass/volume] in Serum or Plasma', ucumUnit: 'mg/dL' },
  { testName: 'Alkaline Phosphatase', aliases: ['ALP', 'Alk Phos'], loincCode: '6768-6', loincDisplay: 'Alkaline phosphatase [Enzymatic activity/volume] in Serum or Plasma', ucumUnit: 'U/L' },
  { testName: 'Total Protein', aliases: ['S.Protein', 'Protein Total'], loincCode: '2885-2', loincDisplay: 'Protein [Mass/volume] in Serum or Plasma', ucumUnit: 'g/dL' },
  { testName: 'Albumin', aliases: ['Serum Albumin', 'S.Albumin'], loincCode: '1751-7', loincDisplay: 'Albumin [Mass/volume] in Serum or Plasma', ucumUnit: 'g/dL' },
  { testName: 'TSH', aliases: ['Thyroid Stimulating Hormone', 'Thyrotropin'], loincCode: '3016-3', loincDisplay: 'Thyrotropin [Units/volume] in Serum or Plasma', ucumUnit: 'mIU/L', snomedCode: '61167004', snomedDisplay: 'TSH' },
  { testName: 'Free T3', aliases: ['FT3', 'Free Triiodothyronine'], loincCode: '3051-3', loincDisplay: 'Triiodothyronine (T3).free [Mass/volume] in Serum or Plasma', ucumUnit: 'pg/mL' },
  { testName: 'Free T4', aliases: ['FT4', 'Free Thyroxine'], loincCode: '3054-7', loincDisplay: 'Thyroxine (T4).free [Mass/volume] in Serum or Plasma', ucumUnit: 'ng/dL' },
  { testName: 'Sodium', aliases: ['S.Sodium', 'Serum Sodium', 'Na'], loincCode: '2951-2', loincDisplay: 'Sodium [Moles/volume] in Serum or Plasma', ucumUnit: 'mmol/L' },
  { testName: 'Potassium', aliases: ['S.Potassium', 'Serum Potassium', 'K'], loincCode: '2823-3', loincDisplay: 'Potassium [Moles/volume] in Serum or Plasma', ucumUnit: 'mmol/L' },
  { testName: 'Chloride', aliases: ['S.Chloride', 'Serum Chloride', 'Cl'], loincCode: '2075-0', loincDisplay: 'Chloride [Moles/volume] in Serum or Plasma', ucumUnit: 'mmol/L' },
  { testName: 'Calcium', aliases: ['S.Calcium', 'Serum Calcium', 'Ca'], loincCode: '17861-6', loincDisplay: 'Calcium [Mass/volume] in Serum or Plasma', ucumUnit: 'mg/dL' },
];

@Injectable()
export class LoincMappingService implements OnModuleInit {
  private readonly logger = new Logger(LoincMappingService.name);
  private fuse!: Fuse<LoincEntry>;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    const allEntries = LOINC_MAP.flatMap(entry => {
      const items: LoincEntry[] = [entry];
      // Add alias entries pointing to same data
      (entry.aliases ?? []).forEach(alias => {
        items.push({ ...entry, testName: alias });
      });
      return items;
    });
    this.fuse = new Fuse(allEntries, {
      keys: ['testName'],
      threshold: 0.4,
      includeScore: true,
    });
    this.logger.log(`LOINC mapping initialized with ${LOINC_MAP.length} entries`);
  }

  findByName(name: string): LoincEntry | null {
    const results = this.fuse.search(name);
    if (!results.length || !results[0]) return null;
    const best = results[0].item;
    // Return the canonical entry (from LOINC_MAP), not alias entry
    return LOINC_MAP.find(e => e.loincCode === best.loincCode) ?? best;
  }

  findByLoincCode(code: string): LoincEntry | null {
    return LOINC_MAP.find(e => e.loincCode === code) ?? null;
  }

  getAllEntries(): LoincEntry[] {
    return LOINC_MAP;
  }

  async enrichTestCatalog(tenantId: string): Promise<{ enriched: number; skipped: number }> {
    const tests = await this.prisma.testCatalog.findMany({
      where: { tenantId, OR: [{ loincCode: null }, { loincCode: '' }] },
      select: { id: true, name: true, code: true },
    });

    let enriched = 0;
    let skipped = 0;

    for (const test of tests) {
      const match = this.findByName(test.name) ?? (test.code ? this.findByName(test.code) : null);
      if (match) {
        await this.prisma.testCatalog.update({
          where: { id: test.id },
          data: { loincCode: match.loincCode },
        }).catch(() => {});
        enriched++;
      } else {
        skipped++;
      }
    }

    return { enriched, skipped };
  }
}
