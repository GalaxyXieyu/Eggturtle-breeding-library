import { Controller, Get } from '@nestjs/common';
import { ErrorCode, healthResponseSchema } from '@eggturtle/shared';

@Controller()
export class HealthController {
  @Get('health')
  getHealth() {
    return healthResponseSchema.parse({
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
      errorCode: ErrorCode.None
    });
  }
}
