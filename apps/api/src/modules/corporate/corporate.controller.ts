import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CorporateService } from './corporate.service';
import { MemberService } from './member.service';
import { PackageService } from './package.service';
import { EventService } from './event.service';
import { InvoiceService } from './invoice.service';
import { WellnessService } from './wellness.service';
import { CorporatePortalService } from './portal.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Corporate')
@Controller('corporate')
export class CorporateController {
  constructor(
    private readonly corporate: CorporateService,
    private readonly members: MemberService,
    private readonly packages: PackageService,
    private readonly events: EventService,
    private readonly invoices: InvoiceService,
    private readonly wellness: WellnessService,
    private readonly portal: CorporatePortalService,
  ) {}

  // ── Dashboard ──────────────────────────────────────────────────────────────

  @Get('dashboard')
  @UseGuards(JwtAuthGuard)
  getDashboard(@TenantId() tenantId: string) {
    return this.corporate.getDashboard(tenantId);
  }

  // ── Corporates ─────────────────────────────────────────────────────────────

  @Post('corporates')
  @UseGuards(JwtAuthGuard)
  create(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() dto: any) {
    return this.corporate.create(tenantId, user.id, dto);
  }

  @Get('corporates')
  @UseGuards(JwtAuthGuard)
  findAll(@TenantId() tenantId: string, @Query() query: any) {
    return this.corporate.findAll(tenantId, query);
  }

  @Get('corporates/:id')
  @UseGuards(JwtAuthGuard)
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.corporate.findOne(tenantId, id);
  }

  @Patch('corporates/:id')
  @UseGuards(JwtAuthGuard)
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: any) {
    return this.corporate.update(tenantId, id, dto);
  }

  // ── Locations ──────────────────────────────────────────────────────────────

  @Post('locations')
  @UseGuards(JwtAuthGuard)
  addLocation(@TenantId() tenantId: string, @Body() dto: any) {
    return this.corporate.addLocation(tenantId, dto.corporateId, dto);
  }

  @Patch('locations/:id')
  @UseGuards(JwtAuthGuard)
  updateLocation(@Param('id') id: string, @Body() dto: any) {
    return this.corporate.updateLocation(id, dto);
  }

  // ── Groups ─────────────────────────────────────────────────────────────────

  @Post('groups')
  @UseGuards(JwtAuthGuard)
  createGroup(@TenantId() tenantId: string, @Body() dto: any) {
    return this.corporate.createGroup(tenantId, dto.corporateId, dto);
  }

  @Patch('groups/:id')
  @UseGuards(JwtAuthGuard)
  updateGroup(@Param('id') id: string, @Body() dto: any) {
    return this.corporate.updateGroup(id, dto);
  }

  // ── Members ────────────────────────────────────────────────────────────────

  @Get('corporates/:id/members')
  @UseGuards(JwtAuthGuard)
  getMembers(@TenantId() tenantId: string, @Param('id') id: string, @Query() query: any) {
    return this.members.getMembers(tenantId, id, query);
  }

  @Patch('members/:id/exit')
  @UseGuards(JwtAuthGuard)
  exitMember(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.members.exitMember(tenantId, id);
  }

  @Get('members')
  @UseGuards(JwtAuthGuard)
  globalMembers(@TenantId() tenantId: string, @Query() query: any) {
    return this.members.globalSearch(tenantId, query);
  }

  @Get('members/:id/orders')
  @UseGuards(JwtAuthGuard)
  memberOrders(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.members.getMemberOrders(tenantId, id);
  }

  // ── Dependents ─────────────────────────────────────────────────────────────

  @Post('dependents')
  @UseGuards(JwtAuthGuard)
  addDependent(@TenantId() tenantId: string, @Body() dto: any) {
    return this.members.addDependent(tenantId, dto);
  }

  @Get('dependents')
  @UseGuards(JwtAuthGuard)
  getDependents(@TenantId() tenantId: string, @Query('memberId') memberId: string) {
    return this.members.getDependents(tenantId, memberId);
  }

  // ── Packages ───────────────────────────────────────────────────────────────

  @Post('packages')
  @UseGuards(JwtAuthGuard)
  createPackage(@TenantId() tenantId: string, @Body() dto: any) {
    return this.packages.create(tenantId, dto);
  }

  @Get('packages')
  @UseGuards(JwtAuthGuard)
  listPackages(@TenantId() tenantId: string, @Query() query: any) {
    return this.packages.findAll(tenantId, query);
  }

  @Get('packages/for-patient/:patientId')
  @UseGuards(JwtAuthGuard)
  packagesForPatient(@TenantId() tenantId: string, @Param('patientId') patientId: string) {
    return this.packages.getForPatient(tenantId, patientId);
  }

  @Patch('packages/:id')
  @UseGuards(JwtAuthGuard)
  updatePackage(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: any) {
    return this.packages.update(tenantId, id, dto);
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  @Post('events')
  @UseGuards(JwtAuthGuard)
  createEvent(@TenantId() tenantId: string, @Body() dto: any) {
    return this.events.create(tenantId, dto);
  }

  @Get('events')
  @UseGuards(JwtAuthGuard)
  listEvents(@TenantId() tenantId: string, @Query() query: any) {
    return this.events.findAll(tenantId, query);
  }

  @Get('events/:id')
  @UseGuards(JwtAuthGuard)
  getEvent(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.events.findOne(tenantId, id);
  }

  @Patch('events/:id')
  @UseGuards(JwtAuthGuard)
  updateEvent(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: any) {
    return this.events.update(tenantId, id, dto);
  }

  // ── Invoices ───────────────────────────────────────────────────────────────

  @Post('invoices/b2b')
  @UseGuards(JwtAuthGuard)
  generateB2B(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() dto: any) {
    return this.invoices.generateB2B(tenantId, user.id, dto);
  }

  @Post('invoices/lounge')
  @UseGuards(JwtAuthGuard)
  generateLounge(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() dto: any) {
    return this.invoices.generateLounge(tenantId, user.id, dto);
  }

  @Get('invoices')
  @UseGuards(JwtAuthGuard)
  listInvoices(@TenantId() tenantId: string, @Query() query: any) {
    return this.invoices.findAll(tenantId, query);
  }

  @Get('invoices/:id')
  @UseGuards(JwtAuthGuard)
  getInvoice(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.invoices.findOne(tenantId, id);
  }

  @Patch('invoices/:id/payment')
  @UseGuards(JwtAuthGuard)
  updatePayment(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: any) {
    return this.invoices.updatePayment(tenantId, id, dto);
  }

  // ── Wellness ───────────────────────────────────────────────────────────────

  @Get('wellness/:corporateId')
  @UseGuards(JwtAuthGuard)
  getWellness(
    @TenantId() tenantId: string,
    @Param('corporateId') corporateId: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.wellness.getDashboard(tenantId, corporateId, locationId);
  }

  // ── Feedback ───────────────────────────────────────────────────────────────

  @Get('feedback')
  @UseGuards(JwtAuthGuard)
  getFeedback(@TenantId() tenantId: string, @Query() query: any) {
    return this.corporate.getFeedback(tenantId, query);
  }

  @Post('feedback/:id/reply')
  @UseGuards(JwtAuthGuard)
  replyFeedback(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: any,
  ) {
    return this.corporate.replyFeedback(id, user.id, dto);
  }

  // ── Mailers ────────────────────────────────────────────────────────────────

  @Post('mailers')
  @UseGuards(JwtAuthGuard)
  sendMailer(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() dto: any) {
    return this.corporate.sendMailer(tenantId, user.id, dto);
  }

  // ── Discount Engine ────────────────────────────────────────────────────────

  @Get('discount')
  @UseGuards(JwtAuthGuard)
  getDiscount(
    @TenantId() tenantId: string,
    @Query('patientId') patientId: string,
    @Query('testId') testId: string,
  ) {
    return this.corporate.getEffectiveDiscount(tenantId, patientId, testId);
  }

  // ── Masters ────────────────────────────────────────────────────────────────

  @Get('masters/industries')
  @UseGuards(JwtAuthGuard)
  getIndustries(@TenantId() tenantId: string) {
    return this.corporate.getIndustries(tenantId);
  }

  @Post('masters/industries')
  @UseGuards(JwtAuthGuard)
  createIndustry(@TenantId() tenantId: string, @Body() dto: any) {
    return this.corporate.createIndustry(tenantId, dto);
  }

  @Patch('masters/industries/:id')
  @UseGuards(JwtAuthGuard)
  updateIndustry(@Param('id') id: string, @Body() dto: any) {
    return this.corporate.updateIndustry(id, dto);
  }

  // ── Portal ─────────────────────────────────────────────────────────────────

  @Post('portal/auth/login')
  portalLogin(@Body() dto: any) {
    return this.portal.login(dto.email, dto.password);
  }

  @Get('portal/dashboard')
  portalDashboard(@Query('corporateId') corporateId: string) {
    return this.portal.getPortalDashboard(corporateId);
  }

  @Post('portal/feedback')
  portalFeedback(@TenantId() tenantId: string, @Body() dto: any) {
    return this.portal.submitFeedback(dto.corporateId, tenantId, dto);
  }
}
