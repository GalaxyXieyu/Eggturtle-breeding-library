import { z } from 'zod';

import { ErrorCode } from './error-codes';

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  service: z.enum(['api', 'web']),
  timestamp: z.string(),
  errorCode: z.nativeEnum(ErrorCode)
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
