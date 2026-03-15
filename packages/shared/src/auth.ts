import { z } from 'zod';

import { tenantSubscriptionSchema } from './subscription';
import { tenantNameSchema, tenantSlugSchema } from './tenant';

export const authEmailSchema = z
  .string()
  .trim()
  .email()
  .max(255)
  .transform((email) => email.toLowerCase());
export const authPhoneNumberSchema = z
  .string()
  .trim()
  .regex(/^1\d{10}$/, 'Phone number must be an 11-digit mainland China mobile number.');
export const authAccountSchema = z
  .string()
  .trim()
  .min(4, 'Account must be at least 4 characters.')
  .max(32, 'Account must be at most 32 characters.')
  .regex(
    /^[a-zA-Z][a-zA-Z0-9_-]{2,30}[a-zA-Z0-9]$/,
    'Account must start with a letter, end with a letter or number, and use letters, numbers, underscores, or hyphens only.',
  )
  .transform((value) => value.toLowerCase());
export const authLoginIdentifierSchema = z
  .string()
  .trim()
  .min(1, 'Login identifier is required.')
  .max(255)
  .transform((value) => value.toLowerCase());
export const authCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Code must be a 6-digit number.');
export const authPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be at most 72 characters.');
export const authNullableAccountSchema = authAccountSchema
  .nullable()
  .optional()
  .transform((value) => value ?? null);
const authAssetUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .refine(
    (value) => value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://'),
    'Asset URL must be an absolute URL or an absolute path.',
  );

export const authUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  account: authNullableAccountSchema,
  name: z.string().nullable(),
  isSuperAdmin: z.boolean(),
});

export const requestCodeRequestSchema = z.object({
  email: authEmailSchema,
});

export const requestCodeResponseSchema = z.object({
  ok: z.literal(true),
  expiresAt: z.string().datetime(),
  devCode: authCodeSchema.optional(),
});

export const requestSmsCodePurposeSchema = z.enum(['register', 'login', 'binding', 'replace']);

export const requestSmsCodeRequestSchema = z.object({
  phoneNumber: authPhoneNumberSchema,
  purpose: requestSmsCodePurposeSchema.default('register'),
});

export const requestSmsCodeResponseSchema = z.object({
  ok: z.literal(true),
  expiresAt: z.string().datetime(),
  devCode: authCodeSchema.optional(),
});

export const verifyCodeRequestSchema = z.object({
  email: authEmailSchema,
  code: authCodeSchema,
  password: authPasswordSchema.optional(),
});

export const verifyCodeResponseSchema = z.object({
  accessToken: z.string().min(1),
  user: authUserSchema,
});

export const passwordLoginRequestSchema = z
  .object({
    account: authAccountSchema.optional(),
    phoneNumber: authPhoneNumberSchema.optional(),
    login: authLoginIdentifierSchema.optional(),
    email: authLoginIdentifierSchema.optional(),
    password: authPasswordSchema,
  })
  .refine(
    (payload) => Boolean(payload.account ?? payload.phoneNumber ?? payload.login ?? payload.email),
    {
      message: 'Login identifier is required.',
      path: ['account'],
    },
  )
  .transform((payload) => ({
    account: payload.account ?? null,
    phoneNumber: payload.phoneNumber ?? null,
    login: payload.phoneNumber ?? payload.account ?? payload.login ?? payload.email ?? '',
    password: payload.password,
  }));

export const passwordLoginResponseSchema = verifyCodeResponseSchema;

export const phoneLoginRequestSchema = z.object({
  phoneNumber: authPhoneNumberSchema,
  code: authCodeSchema,
});

export const phoneLoginResponseSchema = z.object({
  accessToken: z.string().min(1),
  user: authUserSchema,
  tenant: z.object({
    id: z.string().min(1),
    slug: tenantSlugSchema,
    name: tenantNameSchema,
  }),
  isNewUser: z.boolean(),
});

export const meResponseSchema = z.object({
  user: authUserSchema,
  tenantId: z.string().min(1).nullable().optional(),
});

export const meProfileSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  account: authNullableAccountSchema,
  name: z.string().nullable(),
  avatarUrl: authAssetUrlSchema.nullable(),
  createdAt: z.string().datetime(),
  passwordUpdatedAt: z.string().datetime().nullable(),
});

export const meProfileResponseSchema = z.object({
  profile: meProfileSchema,
});

export const updateMeProfileRequestSchema = z.object({
  name: z.string().trim().max(120).nullable(),
});

export const updateMeProfileResponseSchema = z.object({
  profile: meProfileSchema,
});

export const uploadMyAvatarResponseSchema = z.object({
  profile: meProfileSchema,
});

export const deleteMyAvatarResponseSchema = z.object({
  profile: meProfileSchema,
});

export const updateMyPasswordRequestSchema = z.object({
  currentPassword: authPasswordSchema.optional(),
  newPassword: authPasswordSchema,
});

export const updateMyPasswordResponseSchema = z.object({
  ok: z.literal(true),
  passwordUpdatedAt: z.string().datetime(),
});

export const securityProfileQuestionSchema = z.string().trim().min(2).max(120);
export const securityProfileAnswerSchema = z.string().trim().min(2).max(120);

export const mySecurityProfileSchema = z.object({
  question: securityProfileQuestionSchema,
  updatedAt: z.string().datetime(),
});

export const mySecurityProfileResponseSchema = z.object({
  profile: mySecurityProfileSchema.nullable(),
});

export const upsertMySecurityProfileRequestSchema = z.object({
  question: securityProfileQuestionSchema,
  answer: securityProfileAnswerSchema,
});

export const upsertMySecurityProfileResponseSchema = z.object({
  ok: z.literal(true),
  updatedAt: z.string().datetime(),
});

export const myPhoneBindingSchema = z.object({
  phoneNumber: authPhoneNumberSchema,
  updatedAt: z.string().datetime(),
});

export const myPhoneBindingResponseSchema = z.object({
  binding: myPhoneBindingSchema.nullable(),
});

export const upsertMyPhoneBindingRequestSchema = z.object({
  phoneNumber: authPhoneNumberSchema,
  code: authCodeSchema,
  oldCode: authCodeSchema.optional(),
});

export const upsertMyPhoneBindingResponseSchema = z.object({
  ok: z.literal(true),
  binding: myPhoneBindingSchema,
});

export const meSubscriptionResponseSchema = z.object({
  subscription: tenantSubscriptionSchema,
});

export const createWechatAuthorizeUrlRequestSchema = z.object({
  returnPath: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((value) => value.startsWith('/'), {
      message: 'returnPath must start with /.',
    }),
});

export const createWechatAuthorizeUrlResponseSchema = z.object({
  authorizeUrl: z.string().url(),
  expiresAt: z.string().datetime(),
});

// Registration schemas
export const registerRequestSchema = z.object({
  account: authAccountSchema,
  phoneNumber: authPhoneNumberSchema,
  code: authCodeSchema,
  password: authPasswordSchema,
});

export const registerResponseSchema = z.object({
  accessToken: z.string().min(1),
  user: authUserSchema,
  tenant: z.object({
    id: z.string().min(1),
    slug: tenantSlugSchema,
    name: tenantNameSchema,
  }),
  role: z.enum(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']),
});

export type RequestCodeRequest = z.infer<typeof requestCodeRequestSchema>;
export type RequestCodeResponse = z.infer<typeof requestCodeResponseSchema>;
export type RequestSmsCodeRequest = z.infer<typeof requestSmsCodeRequestSchema>;
export type RequestSmsCodePurpose = z.infer<typeof requestSmsCodePurposeSchema>;
export type RequestSmsCodeResponse = z.infer<typeof requestSmsCodeResponseSchema>;
export type VerifyCodeRequest = z.infer<typeof verifyCodeRequestSchema>;
export type VerifyCodeResponse = z.infer<typeof verifyCodeResponseSchema>;
export type PasswordLoginRequest = z.infer<typeof passwordLoginRequestSchema>;
export type PasswordLoginResponse = z.infer<typeof passwordLoginResponseSchema>;
export type PhoneLoginRequest = z.infer<typeof phoneLoginRequestSchema>;
export type PhoneLoginResponse = z.infer<typeof phoneLoginResponseSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type MeProfile = z.infer<typeof meProfileSchema>;
export type MeProfileResponse = z.infer<typeof meProfileResponseSchema>;
export type UpdateMeProfileRequest = z.infer<typeof updateMeProfileRequestSchema>;
export type UpdateMeProfileResponse = z.infer<typeof updateMeProfileResponseSchema>;
export type UploadMyAvatarResponse = z.infer<typeof uploadMyAvatarResponseSchema>;
export type DeleteMyAvatarResponse = z.infer<typeof deleteMyAvatarResponseSchema>;
export type UpdateMyPasswordRequest = z.infer<typeof updateMyPasswordRequestSchema>;
export type UpdateMyPasswordResponse = z.infer<typeof updateMyPasswordResponseSchema>;
export type MySecurityProfile = z.infer<typeof mySecurityProfileSchema>;
export type MySecurityProfileResponse = z.infer<typeof mySecurityProfileResponseSchema>;
export type UpsertMySecurityProfileRequest = z.infer<typeof upsertMySecurityProfileRequestSchema>;
export type UpsertMySecurityProfileResponse = z.infer<typeof upsertMySecurityProfileResponseSchema>;
export type MyPhoneBinding = z.infer<typeof myPhoneBindingSchema>;
export type MyPhoneBindingResponse = z.infer<typeof myPhoneBindingResponseSchema>;
export type UpsertMyPhoneBindingRequest = z.infer<typeof upsertMyPhoneBindingRequestSchema>;
export type UpsertMyPhoneBindingResponse = z.infer<typeof upsertMyPhoneBindingResponseSchema>;
export type MeSubscriptionResponse = z.infer<typeof meSubscriptionResponseSchema>;
export type CreateWechatAuthorizeUrlRequest = z.infer<typeof createWechatAuthorizeUrlRequestSchema>;
export type CreateWechatAuthorizeUrlResponse = z.infer<
  typeof createWechatAuthorizeUrlResponseSchema
>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type RegisterResponse = z.infer<typeof registerResponseSchema>;
