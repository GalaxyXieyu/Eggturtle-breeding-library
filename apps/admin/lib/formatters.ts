import { ApiError } from './api-client'

type FormatUnknownErrorOptions = {
  fallback?: string
  includeErrorCode?: boolean
}

export function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

export function formatUnknownError(error: unknown, options: FormatUnknownErrorOptions = {}) {
  const fallback = options.fallback ?? '未知错误'

  if (error instanceof ApiError) {
    if (options.includeErrorCode && error.errorCode) {
      return `${error.message} (errorCode: ${error.errorCode})`
    }

    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return fallback
}
