export const ErrorCode = {
  None: 'NONE',
  ApiUnavailable: 'API_UNAVAILABLE'
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
