import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SopService } from './sop.service';
import { SopController } from './sop.controller';

@Module({
  imports: [PrismaModule],
  providers: [SopService],
  controllers: [SopController],
  exports: [SopService],
})
export class SopsModule {}
