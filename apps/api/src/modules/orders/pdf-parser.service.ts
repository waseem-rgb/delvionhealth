import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import * as fs from "fs";

export interface ParsedTest {
  code: string;
  name: string;
  department: string;
  category: string;
  sampleType: string;
  tatHours: number;
  price: number;
}

@Injectable()
export class PdfParserService {
  private readonly logger = new Logger(PdfParserService.name);

  async parsePdfTestList(filePath: string): Promise<ParsedTest[]> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new BadRequestException(
        "PDF parsing is not configured. Please set ANTHROPIC_API_KEY in the server environment.",
      );
    }
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });

    const pdfBuffer = fs.readFileSync(filePath);
    const base64Pdf = pdfBuffer.toString("base64");

    this.logger.log(`Parsing PDF (${(pdfBuffer.length / 1024).toFixed(0)} KB) with Claude...`);

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64Pdf,
              },
            },
            {
              type: "text",
              text: `Extract ALL laboratory tests from this price list/rate card document.
Return ONLY a valid JSON array, no other text, no markdown code blocks.

The document may use column headers like: Test Code, Investigations, Methodology, Sample Type, Sample Volume, Schedule, TAT, MRP, B2B, Price, Rate, Department, Category.

Map each row to this exact JSON structure:
{
  "code": "test code / abbreviation (use 'Test Code' column, or create short code from name e.g. CBC, LFT, KFT)",
  "name": "full test name (from 'Investigations' or 'Test Name' or 'Name' column)",
  "department": "from 'Department' or 'Methodology' column, or best guess: Biochemistry|Haematology|Microbiology|Serology|Hormones|Immunology|Urinalysis|Molecular|Other",
  "category": "from 'Category' column, or same as department",
  "sampleType": "from 'Sample Type' column, or: Serum|EDTA Blood|Citrate Blood|Urine|Stool|Swab|Other",
  "tatHours": 0 (from 'TAT' or 'Schedule' column as number of hours; 0 if not available),
  "price": 0 (from 'MRP' or 'Price' or 'Rate' column as number, no currency symbol; 0 if not visible)
}

Rules:
- Include EVERY test row, even if some fields are empty — use empty string "" for missing text fields and 0 for missing numbers.
- Do NOT skip rows that have a name but missing price or other fields.
- Return valid JSON array only. No wrapping text.`,
            },
          ],
        },
      ],
    });

    const firstBlock = response.content[0];
    const text = firstBlock && firstBlock.type === "text" ? firstBlock.text : "";

    // Clean and parse JSON
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    try {
      const parsed = JSON.parse(cleaned) as ParsedTest[];
      this.logger.log(`Parsed ${parsed.length} tests from PDF`);
      return parsed;
    } catch (e) {
      this.logger.error(`Failed to parse Claude response as JSON: ${(e as Error).message}`);
      throw new Error("Failed to parse PDF content. The AI response was not valid JSON.");
    }
  }
}
