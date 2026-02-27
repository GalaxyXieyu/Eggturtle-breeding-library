import { z } from 'zod';

import { ErrorCode } from './error-codes';

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  service: z.enum(['api', 'web']),
  timestamp: z.string(),
  errorCode: z.nativeEnum(ErrorCode)
});

const healthDbCountsSchema = z.object({
  users: z.number().int().nonnegative(),
  tenants: z.number().int().nonnegative(),
  tenantMembers: z.number().int().nonnegative()
});

export const healthDbResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    database: z.literal('postgres'),
    errorCode: z.literal(ErrorCode.None),
    counts: healthDbCountsSchema.optional()
  }),
  z.object({
    status: z.literal('degraded'),
    database: z.literal('postgres'),
    errorCode: z.literal(ErrorCode.ApiUnavailable)
  })
]);

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type HealthDbResponse = z.infer<typeof healthDbResponseSchema>;
