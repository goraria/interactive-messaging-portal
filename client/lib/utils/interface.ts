export interface AuthPageProps {
  searchParams: Promise<{
    redirect?: string | string[]
  }>
}

export interface AuthUser {
  id: string
  email: string
  name: string
  image: string | null
}

export type CallerMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
export type CallerToastConfig =
  | boolean
  | {
      loading?: string
      success?: string
      error?: string
    }

export interface CallerOptions<TData = unknown> {
  url: string
  method?: CallerMethod
  data?: TData
  params?: Record<string, unknown>
  headers?: Record<string, string>
  timeout?: number
  toast?: CallerToastConfig
  withCredentials?: boolean
}

export interface CallerExtraOptions {
  auth?: boolean
  baseURL?: string | null
  unwrapData?: boolean
}

export type CallerConfig<TData = unknown> = CallerOptions<TData> &
  CallerExtraOptions
export type CallerRequestConfig<TData = unknown> = Omit<
  CallerOptions<TData>,
  "method" | "url"
> &
  CallerExtraOptions

export interface ApiErrorPayload {
  message?: unknown
  error?: unknown
  errors?: unknown
}

export interface EndpointFetchArgs {
  url: string
  baseUrl?: string | null
  method?: CallerMethod
  body?: unknown
  data?: unknown
  params?: Record<string, unknown>
  headers?: HeadersInit
  timeout?: number
}

export interface EndpointFetchBaseQueryError {
  status: number | "FETCH_ERROR"
  data?: unknown
  error?: string
}

export interface EndpointQueryMeta {
  response?: { status: number }
}

export interface EndpointQueryReturnValue<TResult, TError> {
  data?: TResult
  error?: TError
  meta?: EndpointQueryMeta
}

export interface AuthContextValue {
  account: AuthUser | null
  loading: boolean
  error: Error | null
  authenticated: boolean
  refresh: () => Promise<AuthUser | null>
  login: (returnTo?: string) => void
  register: (returnTo?: string) => void
  logout: (returnTo?: string) => Promise<void>
}

export interface DemoApiRequest {
  params?: Record<string, string | number | boolean | null | undefined>
  body?: unknown
  data?: unknown
  headers?: Record<string, string>
  timeout?: number
}

export interface DemoApiData {
  id: string
  source: string
  route: string
  url: string
  method: string
  status: "ok"
  generatedAt: string
  params: Record<string, string>
  body: unknown
  headers: Record<string, string>
  cookieNames: string[]
  hasAuthorization: boolean
}

export interface DemoApiError {
  status: number | "FETCH_ERROR"
  error?: string
  data?: unknown
}

export interface DemoApiResult {
  data?: DemoApiData
  error?: DemoApiError
}

export interface EndpointApiResponseEnvelope<TData = unknown> {
  data?: TData
  message?: string
}

export interface AuthMeResponse {
  user?: AuthUser | null
  gorth_app?: Record<string, unknown>
  error?: string
}

export interface AuthUserResponse {
  user?: AuthUser | null
  sso_sub?: string
  email?: string
}

export interface SsoAppContext {
  id: string
  origin: string
  redirect_uri: string
  next?: string | null
  issued_at?: number
}

export interface SsoExchangeResponse extends AuthUserResponse {
  access_token?: string
  refresh_token?: string
  id_token?: string
  expires_in?: number
  expires_at?: number
  refresh_token_expires_in?: number
  scope?: string
  gorth_app?: SsoAppContext & Record<string, unknown>
  error?: string
}

export interface AuthMeResponse {
  user?: AuthUser | null
  gorth_app?: Record<string, unknown>
  error?: string
}
