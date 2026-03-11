import { Module } from '@nestjs/common';
import { QualityFormsService } from './quality-forms.service';
import { QualityFormsController } from './quality-forms.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [QualityFormsController],
  providers: [QualityFormsService],
  exports: [QualityFormsService],
})
export class QualityFormsModule {}
