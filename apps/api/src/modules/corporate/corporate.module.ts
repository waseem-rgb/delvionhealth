import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CorporateController } from './corporate.controller';
import { CorporateService } from './corporate.service';
import { MemberService } from './member.service';
import { PackageService } from './package.service';
import { EventService } from './event.service';
import { InvoiceService } from './invoice.service';
import { WellnessService } from './wellness.service';
import { CorporatePortalService } from './portal.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'changeme'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [CorporateController],
  providers: [
    CorporateService,
    MemberService,
    PackageService,
    EventService,
    InvoiceService,
    WellnessService,
    CorporatePortalService,
  ],
  exports: [CorporateService],
})
export class CorporateModule {}
