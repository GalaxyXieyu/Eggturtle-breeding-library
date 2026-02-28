import { z } from 'zod';

export const authEmailSchema = z.string().trim().email().max(255).transform((email) => email.toLowerCase());
export const authCodeSchema = z.string().trim().regex(/^\d{6}$/, 'Code must be a 6-digit number.');
export const authPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be at most 72 characters.');

export const authUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().nullable()
});

export const requestCodeRequestSchema = z.object({
  email: authEmailSchema
});

export const requestCodeResponseSchema = z.object({
  ok: z.literal(true),
  expiresAt: z.string().datetime(),
  devCode: authCodeSchema.optional()
});

export const verifyCodeRequestSchema = z.object({
  email: authEmailSchema,
  code: authCodeSchema,
  password: authPasswordSchema.optional()
});

export const verifyCodeResponseSchema = z.object({
  accessToken: z.string().min(1),
  user: authUserSchema
});

export const passwordLoginRequestSchema = z.object({
  email: authEmailSchema,
  password: authPasswordSchema
});

export const passwordLoginResponseSchema = verifyCodeResponseSchema;

export const meResponseSchema = z.object({
  user: authUserSchema,
  tenantId: z.string().min(1).nullable().optional()
});

export type RequestCodeRequest = z.infer<typeof requestCodeRequestSchema>;
export type RequestCodeResponse = z.infer<typeof requestCodeResponseSchema>;
export type VerifyCodeRequest = z.infer<typeof verifyCodeRequestSchema>;
export type VerifyCodeResponse = z.infer<typeof verifyCodeResponseSchema>;
export type PasswordLoginRequest = z.infer<typeof passwordLoginRequestSchema>;
export type PasswordLoginResponse = z.infer<typeof passwordLoginResponseSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
