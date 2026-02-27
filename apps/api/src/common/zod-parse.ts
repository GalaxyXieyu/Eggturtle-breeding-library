import { BadRequestException } from '@nestjs/common';
import { ErrorCode } from '@eggturtle/shared';

type SafeParseResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: {
        issues: unknown[];
      };
    };

type SafeParseSchema<T> = {
  safeParse: (payload: unknown) => SafeParseResult<T>;
};

function reduceIssuesForProduction(issues: unknown[]) {
  const firstIssue = issues[0] as
    | {
        code?: unknown;
        path?: unknown;
        message?: unknown;
      }
    | undefined;

  return {
    count: issues.length,
    first: firstIssue
      ? {
          code: firstIssue.code,
          path: firstIssue.path,
          message: firstIssue.message
        }
      : null
  };
}

export function parseOrThrow<T>(schema: SafeParseSchema<T>, payload: unknown): T {
  const result = schema.safeParse(payload);

  if (!result.success) {
    const isProduction = process.env.NODE_ENV === 'production';

    throw new BadRequestException({
      message: 'Invalid request payload.',
      errorCode: ErrorCode.InvalidRequestPayload,
      issues: isProduction ? reduceIssuesForProduction(result.error.issues) : result.error.issues
    });
  }

  return result.data;
}
