import { Module } from "@nestjs/common";
import { VoiceAgentService } from "./voice-agent.service";
import { VoiceAgentController } from "./voice-agent.controller";

@Module({
  controllers: [VoiceAgentController],
  providers: [VoiceAgentService],
  exports: [VoiceAgentService],
})
export class VoiceAgentModule {}
