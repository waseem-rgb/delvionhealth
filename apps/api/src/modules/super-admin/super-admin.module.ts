import { Module } from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { SuperAdminController } from './super-admin.controller';

@Module({
  providers: [SuperAdminService],
  controllers: [SuperAdminController],
  exports: [SuperAdminService],
})
export class SuperAdminModule {}
