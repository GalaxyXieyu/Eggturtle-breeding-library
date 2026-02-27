import { z } from 'zod';

import { storageObjectKeySchema } from './storage';

export const aiQuotaUnitSchema = z.enum([
  'analysis_request',
  'input_image',
  'input_token',
  'output_token'
]);

export const aiQuotaWindowSchema = z.enum(['daily', 'monthly', 'lifetime']);

export const aiQuotaSummarySchema = z.object({
  unit: aiQuotaUnitSchema,
  limit: z.number().int().positive().nullable(),
  used: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative().nullable(),
  window: aiQuotaWindowSchema,
  resetAt: z.string().datetime().nullable()
});

export const aiQuotaStatusResponseSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  items: z.array(aiQuotaSummarySchema),
  checkedAt: z.string().datetime()
});

export const turtleAnalysisImageInputSchema = z.object({
  key: storageObjectKeySchema,
  contentType: z.string().trim().min(1).max(255).optional()
});

export const turtleAnalysisEnvironmentSchema = z.object({
  waterTempC: z.number().min(0).max(50).optional(),
  baskingTempC: z.number().min(0).max(80).optional(),
  tankSizeLiters: z.number().min(0).max(20000).optional(),
  diet: z.string().trim().min(1).max(500).optional()
});

export const turtleAnalysisRequestSchema = z.object({
  images: z.array(turtleAnalysisImageInputSchema).min(1).max(3),
  species: z.string().trim().min(1).max(120).optional(),
  ageRange: z.string().trim().min(1).max(120).optional(),
  weightGrams: z.number().positive().max(50000).optional(),
  environment: turtleAnalysisEnvironmentSchema.optional(),
  question: z.string().trim().min(1).max(1000).optional()
});

export const turtleAnalysisResultSchema = z.object({
  observations: z.array(z.string().min(1)).min(1),
  riskNotes: z.array(z.string().min(1)).min(1),
  careChecklist: z.array(z.string().min(1)).min(1),
  followUp: z.array(z.string().min(1)).min(1),
  disclaimer: z.string().min(1)
});

export const turtleAnalysisResponseSchema = z.object({
  analysisId: z.string().min(1),
  result: turtleAnalysisResultSchema,
  quota: aiQuotaSummarySchema,
  modelId: z.string().min(1)
});

export type AiQuotaUnit = z.infer<typeof aiQuotaUnitSchema>;
export type AiQuotaSummary = z.infer<typeof aiQuotaSummarySchema>;
export type AiQuotaStatusResponse = z.infer<typeof aiQuotaStatusResponseSchema>;
export type TurtleAnalysisRequest = z.infer<typeof turtleAnalysisRequestSchema>;
export type TurtleAnalysisResponse = z.infer<typeof turtleAnalysisResponseSchema>;
