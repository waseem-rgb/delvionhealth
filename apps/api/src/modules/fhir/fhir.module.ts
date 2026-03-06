import { Module } from '@nestjs/common';
import { FhirService } from './fhir.service';
import { FhirController } from './fhir.controller';
import { StandardsModule } from '../standards/standards.module';

@Module({
  imports: [StandardsModule],
  providers: [FhirService],
  controllers: [FhirController],
})
export class FhirModule {}
