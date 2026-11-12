export interface ServiceError extends Error {
  statusCode: number
  code: string
}

export function createServiceError(statusCode: number, code: string) {
  const error = new Error(code) as ServiceError
  error.statusCode = statusCode
  error.code = code
  return error
}
