import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import Anthropic from "@anthropic-ai/sdk";

@Injectable()
export class VoiceAgentService {
  private readonly logger = new Logger(VoiceAgentService.name);
  private anthropic: Anthropic;

  constructor(private readonly prisma: PrismaService) {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  // ── Create new session ──
  async createSession(
    tenantId: string,
    channel: string,
    visitorInfo?: { name?: string; phone?: string; email?: string },
  ) {
    return this.prisma.agentSession.create({
      data: {
        tenantId,
        channel,
        visitorName: visitorInfo?.name ?? null,
        visitorPhone: visitorInfo?.phone ?? null,
        visitorEmail: visitorInfo?.email ?? null,
      },
    });
  }

  // ── Get widget config by embed key ──
  async getConfigByEmbedKey(embedKey: string) {
    const config = await this.prisma.agentWidgetConfig.findFirst({
      where: { embedKey },
    });
    if (!config) throw new NotFoundException("Invalid embed key");

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: config.tenantId },
      select: { name: true, adminEmail: true },
    });
    return { ...config, tenantName: tenant?.name };
  }

  // ── MAIN CHAT: process a user message ──
  async chat(
    sessionToken: string,
    userMessage: string,
    tenantId: string,
  ): Promise<{ reply: string; suggestions?: string[] }> {
    const session = await this.prisma.agentSession.findFirst({
      where: { sessionToken, tenantId },
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 20 },
      },
    });
    if (!session) throw new NotFoundException("Session not found");

    // Save user message
    await this.prisma.agentMessage.create({
      data: { sessionId: session.id, role: "USER", content: userMessage },
    });

    // Load widget config for system prompt
    const config = await this.prisma.agentWidgetConfig.findFirst({
      where: { tenantId },
    });

    // Build conversation history
    const history: Anthropic.Messages.MessageParam[] = session.messages.map(
      (m) => ({
        role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }),
    );

    // Define tools
    const tools: Anthropic.Messages.Tool[] = [
      {
        name: "search_tests",
        description:
          "Search the lab test catalog by test name, symptom, or category. Returns matching tests with price, TAT, sample type.",
        input_schema: {
          type: "object" as const,
          properties: {
            query: {
              type: "string",
              description:
                "Search query — test name, symptom, or category",
            },
            limit: {
              type: "number",
              description: "Max results (default 5)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_test_details",
        description:
          "Get detailed info about a specific test including price, preparation, TAT, sample type.",
        input_schema: {
          type: "object" as const,
          properties: {
            testName: {
              type: "string",
              description: "Test name to look up",
            },
          },
          required: ["testName"],
        },
      },
      {
        name: "suggest_tests_for_symptoms",
        description:
          "Given symptoms, suggest relevant diagnostic tests and health packages.",
        input_schema: {
          type: "object" as const,
          properties: {
            symptoms: {
              type: "array",
              items: { type: "string" },
              description: "List of symptoms reported by patient",
            },
          },
          required: ["symptoms"],
        },
      },
      {
        name: "get_available_slots",
        description: "Get available appointment slots for a given date.",
        input_schema: {
          type: "object" as const,
          properties: {
            date: {
              type: "string",
              description: "Date in YYYY-MM-DD format",
            },
          },
          required: ["date"],
        },
      },
      {
        name: "book_appointment",
        description: "Book a lab appointment for a patient.",
        input_schema: {
          type: "object" as const,
          properties: {
            patientName: { type: "string" },
            patientPhone: { type: "string" },
            testNames: {
              type: "string",
              description: "Comma-separated test names",
            },
            date: { type: "string", description: "YYYY-MM-DD" },
            timeSlot: { type: "string", description: "e.g. 08:00 AM" },
            notes: { type: "string" },
          },
          required: [
            "patientName",
            "patientPhone",
            "testNames",
            "date",
            "timeSlot",
          ],
        },
      },
      {
        name: "check_report_status",
        description:
          "Check whether a patient report is ready, using their phone number or MRN.",
        input_schema: {
          type: "object" as const,
          properties: {
            phone: { type: "string" },
            mrn: { type: "string" },
          },
        },
      },
      {
        name: "get_lab_info",
        description:
          "Get general lab information: working hours, address, contact, services offered.",
        input_schema: {
          type: "object" as const,
          properties: {
            infoType: {
              type: "string",
              description:
                "hours | location | contact | services",
            },
          },
          required: ["infoType"],
        },
      },
    ];

    const systemPrompt = `You are ${config?.labName ?? "the lab"}'s friendly and professional AI assistant.

ABOUT THE LAB:
${config?.labName ? `- Name: ${config.labName}` : ""}
${config?.labTagline ? `- Tagline: ${config.labTagline}` : ""}
- Working hours: ${config?.workingHours ?? "Mon-Sat 7am-9pm"}
${config?.phoneNumber ? `- Phone: ${config.phoneNumber}` : ""}
${config?.whatsappNumber ? `- WhatsApp: ${config.whatsappNumber}` : ""}

YOUR ROLE:
- Help patients understand which tests they need based on symptoms
- Provide accurate test pricing, preparation instructions, and turnaround times
- Book appointments and check report status
- Answer common queries about the lab
- Be warm, professional, and reassuring

STRICT RULES:
- NEVER diagnose or suggest medications — always recommend consulting a doctor
- For emergencies, immediately provide the lab phone number
- Keep responses concise — max 3-4 sentences unless detail is needed
- Use tools to get real data — never make up test names or prices
- Collect name and phone number before booking an appointment
- After booking, always confirm the appointment details
- Respond in the same language the patient uses (English or Hindi)

CONVERSATION STYLE:
- Warm and professional
- Use patient's name if known
- Short sentences — this may be read aloud
- End with a clear next step or question`;

    // Call Anthropic with tool use
    let response = await this.anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages: [...history, { role: "user", content: userMessage }],
    });

    // Handle tool calls (loop until no more tool_use)
    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
      );

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        const result = await this._executeTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          tenantId,
          session.id,
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages: [
          ...history,
          { role: "user", content: userMessage },
          { role: "assistant", content: response.content },
          { role: "user", content: toolResults },
        ],
      });
    }

    // Extract final text reply
    const reply = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Save agent reply
    await this.prisma.agentMessage.create({
      data: { sessionId: session.id, role: "AGENT", content: reply },
    });

    const suggestions = this._getSuggestions(userMessage);

    return { reply, suggestions };
  }

  // ── Execute tool calls ──
  private async _executeTool(
    name: string,
    input: Record<string, unknown>,
    tenantId: string,
    sessionId: string,
  ): Promise<unknown> {
    try {
      switch (name) {
        case "search_tests": {
          const query = String(input.query ?? "");
          const limit = Number(input.limit) || 5;
          const tests = await this.prisma.testCatalog.findMany({
            where: {
              tenantId,
              isActive: true,
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { code: { contains: query, mode: "insensitive" } },
                { category: { contains: query, mode: "insensitive" } },
              ],
            },
            select: {
              id: true,
              name: true,
              code: true,
              price: true,
              sampleType: true,
              turnaroundHours: true,
              category: true,
            },
            take: limit,
          });
          return { tests, count: tests.length };
        }

        case "get_test_details": {
          const testName = String(input.testName ?? "");
          const test = await this.prisma.testCatalog.findFirst({
            where: {
              tenantId,
              name: { contains: testName, mode: "insensitive" },
            },
            select: {
              id: true,
              name: true,
              code: true,
              price: true,
              sampleType: true,
              turnaroundHours: true,
              category: true,
              department: true,
              methodology: true,
              testNotes: {
                select: {
                  generalNote: true,
                  fastingNote: true,
                },
              },
            },
          });
          return test ?? { error: "Test not found" };
        }

        case "suggest_tests_for_symptoms": {
          const symptoms = (input.symptoms as string[]) ?? [];
          const SYMPTOM_MAP: Record<string, string[]> = {
            fatigue: ["CBC", "thyroid", "vitamin B12", "iron", "HbA1c", "vitamin D"],
            "hair loss": ["thyroid", "iron", "vitamin D", "testosterone"],
            "weight gain": ["thyroid", "HbA1c", "cortisol", "insulin"],
            "weight loss": ["CBC", "thyroid", "HbA1c", "ESR", "liver function"],
            fever: ["CBC", "ESR", "CRP", "malaria", "dengue", "typhoid", "blood culture"],
            diabetes: ["HbA1c", "fasting glucose", "postprandial glucose", "kidney function", "lipid profile"],
            "chest pain": ["troponin", "lipid profile", "CRP", "CBC"],
            "joint pain": ["RA factor", "uric acid", "ESR", "CRP", "vitamin D"],
            hypertension: ["kidney function", "electrolytes", "lipid profile", "thyroid"],
            anaemia: ["CBC", "iron studies", "vitamin B12", "folate"],
            jaundice: ["liver function", "bilirubin", "hepatitis B", "hepatitis C"],
            headache: ["CBC", "ESR", "thyroid", "vitamin D", "vitamin B12"],
            "frequent urination": ["fasting glucose", "HbA1c", "urine routine", "kidney function"],
          };

          const testQueries = new Set<string>();
          for (const symptom of symptoms) {
            const s = symptom.toLowerCase();
            for (const [key, tests] of Object.entries(SYMPTOM_MAP)) {
              if (s.includes(key) || key.includes(s)) {
                tests.forEach((t) => testQueries.add(t));
              }
            }
          }

          if (!testQueries.size) {
            return {
              message:
                "Could not map specific tests to these symptoms. Recommend consulting a doctor.",
              suggestions: [],
            };
          }

          const tests = await this.prisma.testCatalog.findMany({
            where: {
              tenantId,
              isActive: true,
              OR: Array.from(testQueries).map((q) => ({
                name: { contains: q, mode: "insensitive" as const },
              })),
            },
            select: {
              id: true,
              name: true,
              price: true,
              sampleType: true,
              turnaroundHours: true,
              category: true,
            },
            take: 10,
          });

          return { symptoms, suggestedTests: tests };
        }

        case "get_available_slots": {
          const date = new Date(String(input.date));
          const dayStart = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
          );
          const dayEnd = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            23,
            59,
            59,
          );

          const booked = await this.prisma.agentAppointment.findMany({
            where: {
              tenantId,
              date: { gte: dayStart, lte: dayEnd },
              status: { not: "CANCELLED" },
            },
            select: { timeSlot: true },
          });
          const bookedSlots = new Set(booked.map((a) => a.timeSlot));

          const allSlots: string[] = [];
          for (let h = 7; h < 20; h++) {
            for (const m of [0, 15, 30, 45]) {
              const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
              const period = h >= 12 ? "PM" : "AM";
              const slot = `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
              if (!bookedSlots.has(slot)) allSlots.push(slot);
            }
          }

          return {
            date: String(input.date),
            availableSlots: allSlots.slice(0, 20),
          };
        }

        case "book_appointment": {
          const appointment = await this.prisma.agentAppointment.create({
            data: {
              tenantId,
              patientName: String(input.patientName),
              patientPhone: String(input.patientPhone),
              testNames: String(input.testNames),
              date: new Date(String(input.date)),
              timeSlot: String(input.timeSlot),
              notes: input.notes ? String(input.notes) : null,
              source: "VOICE_AGENT",
              status: "BOOKED",
            },
          });

          await this.prisma.agentSession.update({
            where: { id: sessionId },
            data: {
              visitorName: String(input.patientName),
              visitorPhone: String(input.patientPhone),
              appointmentId: appointment.id,
            },
          });

          return {
            success: true,
            appointmentId: appointment.id,
            patientName: input.patientName,
            testNames: input.testNames,
            date: input.date,
            timeSlot: input.timeSlot,
            message: `Appointment booked for ${input.patientName} on ${input.date} at ${input.timeSlot}`,
          };
        }

        case "check_report_status": {
          const patient = await this.prisma.patient.findFirst({
            where: {
              tenantId,
              OR: [
                ...(input.phone ? [{ phone: String(input.phone) }] : []),
                ...(input.mrn ? [{ mrn: String(input.mrn) }] : []),
              ],
            },
            select: { id: true, firstName: true, lastName: true, mrn: true },
          });

          if (!patient) {
            return {
              found: false,
              message: "No patient found with this phone/MRN",
            };
          }

          const orders = await this.prisma.order.findMany({
            where: { tenantId, patientId: patient.id },
            orderBy: { createdAt: "desc" },
            take: 3,
            include: {
              items: {
                include: {
                  testCatalog: {
                    select: { name: true, turnaroundHours: true },
                  },
                },
              },
            },
          });

          return {
            found: true,
            patientName: `${patient.firstName} ${patient.lastName}`,
            mrn: patient.mrn,
            orders: orders.map((o) => ({
              orderNumber: o.orderNumber,
              status: o.status,
              createdAt: o.createdAt,
              tests: o.items.map((i) => ({
                name: i.testCatalog?.name,
              })),
            })),
          };
        }

        case "get_lab_info": {
          const widgetConfig = await this.prisma.agentWidgetConfig.findFirst({
            where: { tenantId },
          });
          const tenant = await this.prisma.tenant.findFirst({
            where: { id: tenantId },
            select: { name: true, adminEmail: true },
          });
          return {
            labName: widgetConfig?.labName ?? tenant?.name,
            workingHours: widgetConfig?.workingHours,
            phone: widgetConfig?.phoneNumber,
            whatsapp: widgetConfig?.whatsappNumber,
            email: tenant?.adminEmail,
          };
        }

        default:
          return { error: `Unknown tool: ${name}` };
      }
    } catch (err: unknown) {
      this.logger.error(
        `Tool error [${name}]: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ── Quick-reply suggestion chips ──
  private _getSuggestions(userMsg: string): string[] {
    const msg = userMsg.toLowerCase();
    if (
      msg.includes("symptom") ||
      msg.includes("feel") ||
      msg.includes("pain")
    ) {
      return ["Book appointment", "View test prices", "Call the lab"];
    }
    if (msg.includes("book") || msg.includes("appointment")) {
      return ["What tests do I need?", "What are your timings?"];
    }
    if (msg.includes("report") || msg.includes("result")) {
      return ["Book follow-up", "Call us"];
    }
    return [
      "Check test prices",
      "Book appointment",
      "Report status",
      "Call us",
    ];
  }

  // ── Admin: Widget config CRUD ──
  async getWidgetConfig(tenantId: string) {
    return this.prisma.agentWidgetConfig.findFirst({ where: { tenantId } });
  }

  async saveWidgetConfig(tenantId: string, dto: Record<string, unknown>) {
    const {
      labName,
      labTagline,
      primaryColor,
      greetingMessage,
      enableVoice,
      enableBooking,
      enableReportStatus,
      languages,
      whatsappNumber,
      phoneNumber,
      workingHours,
      offlineMessage,
    } = dto;

    const data = {
      labName: labName ? String(labName) : "Lab Assistant",
      labTagline: labTagline ? String(labTagline) : null,
      primaryColor: primaryColor ? String(primaryColor) : "#0d7377",
      greetingMessage: greetingMessage
        ? String(greetingMessage)
        : "Hi! I'm your lab assistant. How can I help you today?",
      enableVoice: enableVoice !== false,
      enableBooking: enableBooking !== false,
      enableReportStatus: enableReportStatus !== false,
      languages: languages ? String(languages) : "en,hi",
      whatsappNumber: whatsappNumber ? String(whatsappNumber) : undefined,
      phoneNumber: phoneNumber ? String(phoneNumber) : undefined,
      workingHours: workingHours ? String(workingHours) : "Mon-Sat 7am-9pm",
      offlineMessage: offlineMessage ? String(offlineMessage) : undefined,
    };

    return this.prisma.agentWidgetConfig.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });
  }

  async publishWidget(tenantId: string) {
    return this.prisma.agentWidgetConfig.update({
      where: { tenantId },
      data: { isPublished: true },
    });
  }

  // ── Session history ──
  async getSessionHistory(sessionToken: string, tenantId: string) {
    return this.prisma.agentSession.findFirst({
      where: { sessionToken, tenantId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
  }

  // ── Analytics ──
  async getAgentAnalytics(tenantId: string) {
    const [totalSessions, totalMessages, appointments, escalations] =
      await Promise.all([
        this.prisma.agentSession.count({ where: { tenantId } }),
        this.prisma.agentMessage.count({
          where: { session: { tenantId } },
        }),
        this.prisma.agentAppointment.count({
          where: { tenantId, source: "VOICE_AGENT" },
        }),
        this.prisma.agentSession.count({
          where: { tenantId, status: "ESCALATED" },
        }),
      ]);
    return { totalSessions, totalMessages, appointments, escalations };
  }
}
