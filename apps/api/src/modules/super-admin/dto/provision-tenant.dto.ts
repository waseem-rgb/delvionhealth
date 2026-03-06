export class ProvisionTenantDto {
  labName: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  adminPassword?: string;
  planName: 'STARTER' | 'PRO' | 'ENTERPRISE';
  billingCycle?: 'MONTHLY' | 'ANNUAL';
  trialDays?: number;
  city?: string;
}
