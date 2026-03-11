import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { QualityFormsService } from './quality-forms.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

@ApiTags('quality-forms')
@ApiBearerAuth()
@Controller('quality-forms')
@UseGuards(JwtAuthGuard, TenantGuard)
export class QualityFormsController {
  constructor(private readonly service: QualityFormsService) {}

  // ─── AI GENERATION ────────────────────────────────────────────────────────

  @Post('generate-all')
  @ApiOperation({ summary: 'Start AI generation of all 53 quality forms' })
  generateAll(@Request() req: any) {
    return this.service.startGenerationJob(req.user.tenantId);
  }

  @Get('generation-status')
  @ApiOperation({ summary: 'Get AI generation job status' })
  generationStatus(@Request() req: any) {
    return this.service.getGenerationStatus(req.user.tenantId);
  }

  // ─── STATS ────────────────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Get quality forms statistics' })
  getStats(@Request() req: any) {
    return this.service.getStats(req.user.tenantId);
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all AI-generated quality forms' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'frequency', required: false })
  @ApiQuery({ name: 'department', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Request() req: any,
    @Query('category') category?: string,
    @Query('frequency') frequency?: string,
    @Query('department') department?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(req.user.tenantId, {
      category,
      frequency,
      department,
      search,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 100,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single quality form' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.service.findOne(req.user.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a quality form (marks as customized)' })
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: {
      title?: string;
      formSchema?: unknown;
      status?: string;
      version?: string;
      sourceDocNo?: string;
    },
  ) {
    return this.service.update(req.user.tenantId, id, dto);
  }

  // ─── SUBMISSIONS ──────────────────────────────────────────────────────────

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit a filled quality form' })
  submit(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: {
      submittedData: unknown;
      notes?: string;
      periodLabel?: string;
      month?: number;
      year?: number;
    },
  ) {
    const user = req.user;
    const userName: string = user.email as string;
    return this.service.submit(user.tenantId, id, user.sub, userName, dto);
  }

  @Get(':id/submissions')
  @ApiOperation({ summary: 'Get submissions for a quality form' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getSubmissions(
    @Request() req: any,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getSubmissions(req.user.tenantId, id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Delete(':id/submissions/:subId')
  @ApiOperation({ summary: 'Delete a form submission' })
  deleteSubmission(
    @Request() req: any,
    @Param('id') id: string,
    @Param('subId') subId: string,
  ) {
    return this.service.deleteSubmission(req.user.tenantId, id, subId);
  }
}
