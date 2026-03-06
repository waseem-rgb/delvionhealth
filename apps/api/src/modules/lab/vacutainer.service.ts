import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

interface VacutainerGuideEntry {
  tubeType: string;
  color: string;
  volumeMl: number;
  tests: string[];
}

// Standard vacutainer tube type to color/volume mapping
const TUBE_DEFAULTS: Record<
  string,
  { color: string; volumeMl: number }
> = {
  // EDTA tubes
  EDTA_PURPLE: { color: "Purple", volumeMl: 3 },
  EDTA: { color: "Purple", volumeMl: 3 },
  "EDTA (Purple)": { color: "Purple", volumeMl: 3 },
  "Purple Top": { color: "Purple", volumeMl: 3 },

  // Serum separator / gel tubes
  SST_GOLD: { color: "Gold", volumeMl: 5 },
  SST: { color: "Gold", volumeMl: 5 },
  "SST (Gold)": { color: "Gold", volumeMl: 5 },
  "Gold Top": { color: "Gold", volumeMl: 5 },
  SERUM: { color: "Red", volumeMl: 5 },
  "Serum (Red)": { color: "Red", volumeMl: 5 },
  "Red Top": { color: "Red", volumeMl: 5 },
  PLAIN: { color: "Red", volumeMl: 5 },

  // Citrate tubes
  CITRATE_BLUE: { color: "Blue", volumeMl: 2.7 },
  CITRATE: { color: "Blue", volumeMl: 2.7 },
  "Citrate (Blue)": { color: "Blue", volumeMl: 2.7 },
  "Blue Top": { color: "Blue", volumeMl: 2.7 },

  // Fluoride tubes
  FLUORIDE_GREY: { color: "Grey", volumeMl: 2 },
  FLUORIDE: { color: "Grey", volumeMl: 2 },
  "Fluoride (Grey)": { color: "Grey", volumeMl: 2 },
  "Grey Top": { color: "Grey", volumeMl: 2 },

  // Heparin tubes
  HEPARIN_GREEN: { color: "Green", volumeMl: 4 },
  HEPARIN: { color: "Green", volumeMl: 4 },
  "Heparin (Green)": { color: "Green", volumeMl: 4 },
  "Green Top": { color: "Green", volumeMl: 4 },

  // Urine
  URINE: { color: "Yellow (Urine)", volumeMl: 10 },
  "Urine Container": { color: "Yellow (Urine)", volumeMl: 10 },

  // Other
  WHOLE_BLOOD: { color: "Purple", volumeMl: 3 },
  PLASMA: { color: "Green", volumeMl: 4 },
};

@Injectable()
export class VacutainerService {
  private readonly logger = new Logger(VacutainerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get vacutainer guide for a set of test IDs.
   * Groups tests by sample type, deduplicates tubes.
   */
  async getVacutainerGuide(
    testIds: string[],
    tenantId: string,
  ): Promise<VacutainerGuideEntry[]> {
    if (testIds.length === 0) {
      return [];
    }

    const tests = await this.prisma.testCatalog.findMany({
      where: {
        id: { in: testIds },
        tenantId,
      },
      select: {
        id: true,
        name: true,
        sampleType: true,
      },
    });

    // Group tests by sampleType (tube type)
    const tubeMap = new Map<string, string[]>();
    for (const test of tests) {
      const tubeType = test.sampleType ?? "SERUM";
      const existing = tubeMap.get(tubeType) ?? [];
      existing.push(test.name);
      tubeMap.set(tubeType, existing);
    }

    // Build guide entries with deduplication
    const guide: VacutainerGuideEntry[] = [];
    for (const [tubeType, testNames] of tubeMap.entries()) {
      const normalizedKey = tubeType.toUpperCase().replace(/\s+/g, "_");
      const defaults = TUBE_DEFAULTS[tubeType] ??
        TUBE_DEFAULTS[normalizedKey] ?? {
          color: "Unknown",
          volumeMl: 3,
        };

      guide.push({
        tubeType,
        color: defaults.color,
        volumeMl: defaults.volumeMl,
        tests: testNames,
      });
    }

    return guide;
  }
}
