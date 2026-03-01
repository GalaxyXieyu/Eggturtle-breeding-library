import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';

@Module({
  imports: [AuthModule, SubscriptionsModule],
  controllers: [AiAssistantController],
  providers: [AiAssistantService]
})
export class AiAssistantModule {}
