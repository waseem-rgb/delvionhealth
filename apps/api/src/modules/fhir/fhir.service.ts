import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LoincMappingService } from '../standards/loinc-mapping.service';

@Injectable()
export class FhirService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loincService: LoincMappingService,
  ) {}

  getCapabilityStatement(): object {
    return {
      resourceType: 'CapabilityStatement',
      status: 'active',
      date: new Date().toISOString().split('T')[0],
      kind: 'instance',
      fhirVersion: '4.0.1',
      format: ['application/fhir+json'],
      rest: [{
        mode: 'server',
        resource: [
          { type: 'Patient', interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'create' }] },
          { type: 'DiagnosticReport', interaction: [{ code: 'read' }, { code: 'search-type' }] },
          { type: 'Observation', interaction: [{ code: 'read' }, { code: 'search-type' }] },
          { type: 'ServiceRequest', interaction: [{ code: 'read' }, { code: 'create' }] },
        ],
      }],
    };
  }

  async getPatient(id: string, tenantId: string): Promise<object> {
    const patient = await this.prisma.patient.findFirst({ where: { id, tenantId } });
    if (!patient) throw new NotFoundException(`Patient/${id} not found`);
    return this.mapPatientToFhir(patient);
  }

  async searchPatients(query: { name?: string; identifier?: string }, tenantId: string): Promise<object> {
    const patients = await this.prisma.patient.findMany({
      where: {
        tenantId,
        ...(query.identifier ? { mrn: query.identifier } : {}),
        ...(query.name ? {
          OR: [
            { firstName: { contains: query.name, mode: 'insensitive' as const } },
            { lastName: { contains: query.name, mode: 'insensitive' as const } },
          ],
        } : {}),
      },
      take: 50,
    });
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: patients.length,
      entry: patients.map(p => ({ resource: this.mapPatientToFhir(p) })),
    };
  }

  async createPatient(fhirPatient: Record<string, unknown>, tenantId: string): Promise<object> {
    const name = (fhirPatient.name as Array<{ given?: string[]; family?: string }> | undefined)?.[0];
    const identifiers = fhirPatient.identifier as Array<{ value?: string }> | undefined;

    // Get a branch for the tenant
    const branch = await this.prisma.tenantBranch.findFirst({ where: { tenantId, isActive: true } });
    if (!branch) throw new NotFoundException('No active branch found for tenant');

    const patient = await this.prisma.patient.create({
      data: {
        tenantId,
        branchId: branch.id,
        firstName: name?.given?.[0] ?? 'Unknown',
        lastName: name?.family ?? '',
        dob: new Date((fhirPatient.birthDate as string | undefined) ?? '2000-01-01'),
        gender: this.mapFhirGender((fhirPatient.gender as string | undefined) ?? 'unknown'),
        mrn: (identifiers?.[0]?.value) ?? `FHIR-${Date.now()}`,
        phone: '',
      },
    });
    return this.mapPatientToFhir(patient);
  }

  async getDiagnosticReport(orderId: string, tenantId: string): Promise<object> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        patient: true,
        items: { include: { testCatalog: true, testResults: true } },
        labReports: true,
      },
    });
    if (!order) throw new NotFoundException(`Order/${orderId} not found`);

    return {
      resourceType: 'DiagnosticReport',
      id: order.id,
      status: this.mapOrderStatusToFhir(order.status),
      code: { text: 'Laboratory Report' },
      subject: { reference: `Patient/${order.patientId}`, display: `${order.patient.firstName} ${order.patient.lastName}` },
      effectiveDateTime: order.createdAt.toISOString(),
      issued: order.updatedAt.toISOString(),
      result: order.items.flatMap(item =>
        item.testResults.map(r => ({ reference: `Observation/${r.id}` }))
      ),
      presentedForm: order.labReports.map(report => ({
        url: report.pdfUrl ?? undefined,
        title: report.reportNumber,
      })),
    };
  }

  async getObservation(resultId: string, tenantId: string): Promise<object> {
    const result = await this.prisma.testResult.findFirst({
      where: { id: resultId, tenantId },
      include: { orderItem: { include: { testCatalog: true } } },
    });
    if (!result) throw new NotFoundException(`Observation/${resultId} not found`);
    return this.mapResultToFhir(result);
  }

  async searchObservations(patientId: string, tenantId: string): Promise<object> {
    const results = await this.prisma.testResult.findMany({
      where: { tenantId, order: { patientId } },
      include: { orderItem: { include: { testCatalog: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: results.length,
      entry: results.map(r => ({ resource: this.mapResultToFhir(r) })),
    };
  }

  async getServiceRequest(orderId: string, tenantId: string): Promise<object> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: { patient: true, items: { include: { testCatalog: true } } },
    });
    if (!order) throw new NotFoundException(`ServiceRequest/${orderId} not found`);

    return {
      resourceType: 'ServiceRequest',
      id: order.id,
      status: 'active',
      intent: 'order',
      subject: { reference: `Patient/${order.patientId}` },
      code: {
        coding: order.items.map(item => ({
          system: 'https://delvion.health/tests',
          code: item.testCatalog.code,
          display: item.testCatalog.name,
        })),
      },
      authoredOn: order.createdAt.toISOString(),
    };
  }

  async createServiceRequest(fhirSR: Record<string, unknown>, tenantId: string): Promise<object> {
    // Extract patient reference
    const subjectRef = (fhirSR.subject as { reference?: string } | undefined)?.reference ?? '';
    const patientId = subjectRef.replace('Patient/', '');

    const patient = await this.prisma.patient.findFirst({ where: { id: patientId, tenantId } });
    if (!patient) throw new NotFoundException('Patient not found');

    // Map FHIR code to test catalog
    const codings = (fhirSR.code as { coding?: Array<{ code?: string }> } | undefined)?.coding ?? [];
    const testCodes = codings.map(c => c.code).filter((c): c is string => Boolean(c));

    const tests = await this.prisma.testCatalog.findMany({
      where: { tenantId, code: { in: testCodes } },
    });

    if (!tests.length) throw new NotFoundException('No matching tests found in catalog');

    // Create order (simplified — no invoice/payment flow)
    const branch = await this.prisma.tenantBranch.findFirst({ where: { tenantId, isActive: true } });
    if (!branch) throw new NotFoundException('No branch found');

    const orderNumber = `FHIR-${Date.now()}`;
    const order = await this.prisma.order.create({
      data: {
        tenantId,
        branchId: branch.id,
        patientId: patient.id,
        orderNumber,
        status: 'PENDING',
        priority: 'ROUTINE',
        totalAmount: 0,
        createdById: 'fhir-api',
        items: {
          create: tests.map(t => ({
            testCatalogId: t.id,
            price: t.price,
          })),
        },
      },
    });

    return this.getServiceRequest(order.id, tenantId);
  }

  // ─── Private mappers ──────────────────────────────────────────────────────

  private mapPatientToFhir(patient: {
    id: string;
    firstName: string;
    lastName: string;
    mrn: string;
    dob: Date;
    gender: string;
    phone: string;
    email?: string | null;
  }): object {
    return {
      resourceType: 'Patient',
      id: patient.id,
      identifier: [{
        system: 'https://delvion.health/mrn',
        value: patient.mrn,
      }],
      name: [{ family: patient.lastName, given: [patient.firstName] }],
      gender: this.mapGenderToFhir(patient.gender),
      birthDate: patient.dob.toISOString().split('T')[0],
      telecom: [
        ...(patient.phone ? [{ system: 'phone', value: patient.phone }] : []),
        ...(patient.email ? [{ system: 'email', value: patient.email }] : []),
      ],
    };
  }

  private mapResultToFhir(result: {
    id: string;
    value: string;
    numericValue?: number | null;
    unit?: string | null;
    interpretation: string;
    createdAt: Date;
    orderId: string;
    orderItem: {
      testCatalog: { id: string; name: string; code: string; loincCode?: string | null };
    };
  }): object {
    const catalog = result.orderItem.testCatalog;
    const loinc = catalog.loincCode ? this.loincService.findByLoincCode(catalog.loincCode) : null;

    return {
      resourceType: 'Observation',
      id: result.id,
      status: 'final',
      code: {
        coding: [
          ...(loinc ? [{ system: 'http://loinc.org', code: loinc.loincCode, display: loinc.loincDisplay }] : []),
          { system: 'https://delvion.health/tests', code: catalog.code, display: catalog.name },
        ],
        text: catalog.name,
      },
      subject: { reference: `Patient/${result.orderId}` },
      effectiveDateTime: result.createdAt.toISOString(),
      valueQuantity: result.numericValue != null ? {
        value: result.numericValue,
        unit: result.unit ?? '',
        system: 'http://unitsofmeasure.org',
      } : undefined,
      valueString: result.numericValue == null ? result.value : undefined,
      interpretation: result.interpretation ? [{
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: result.interpretation }],
      }] : undefined,
    };
  }

  private mapGenderToFhir(gender: string): string {
    switch (gender.toUpperCase()) {
      case 'MALE': return 'male';
      case 'FEMALE': return 'female';
      default: return 'unknown';
    }
  }

  private mapFhirGender(fhirGender: string): string {
    switch (fhirGender.toLowerCase()) {
      case 'male': return 'MALE';
      case 'female': return 'FEMALE';
      default: return 'OTHER';
    }
  }

  private mapOrderStatusToFhir(status: string): string {
    switch (status) {
      case 'RESULTED':
      case 'COMPLETED': return 'final';
      case 'IN_PROGRESS':
      case 'SAMPLE_COLLECTED': return 'partial';
      case 'PENDING': return 'registered';
      default: return 'unknown';
    }
  }
}
