import { z } from 'zod';

import { ErrorCode } from './error-codes';

export const apiErrorSchema = z.object({
  message: z.string().min(1),
  errorCode: z.nativeEnum(ErrorCode)
});

export type ApiError = z.infer<typeof apiErrorSchema>;
