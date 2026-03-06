import { Module } from '@nestjs/common';
import { LoincMappingService } from './loinc-mapping.service';
import { StandardsController } from './standards.controller';

@Module({
  providers: [LoincMappingService],
  controllers: [StandardsController],
  exports: [LoincMappingService],
})
export class StandardsModule {}
