import { Module, forwardRef } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { InstrumentsService } from "./instruments.service";
import { InstrumentsController } from "./instruments.controller";
import { TemperatureController } from "./temperature.controller";
import { InstrumentGatewayService } from "./instrument-gateway.service";
import { ResultsModule } from "../results/results.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    forwardRef(() => ResultsModule),
    NotificationsModule,
  ],
  providers: [InstrumentsService, InstrumentGatewayService],
  controllers: [InstrumentsController, TemperatureController],
  exports: [InstrumentsService],
})
export class InstrumentsModule {}
