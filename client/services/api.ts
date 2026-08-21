"use client";

import { useCallback, useState } from "react";
import axios from "@gorth/structure/cores/axios";
import { toast } from "@gorth/primitive/cores/sonner";

export interface ApiResponseEnvelope {
  data?: unknown
  message?: string
}

export interface BaseQueryApi {
  signal?: AbortSignal
}

export interface FetchArgs {
  url: string
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  params?: Record<string, string | number | boolean | null | undefined>
  headers?: HeadersInit
}

export interface FetchBaseQueryError {
  status: number | "FETCH_ERROR"
  data?: unknown
  error?: string
}

export type EndpointFunctions<TEndpoints extends Record<string, unknown>> = {
  [K in keyof TEndpoints]: TEndpoints[K] extends QueryDefinition<
    infer TResult,
    infer TArg,
    "query" | "mutation"
  >
  ? (
    arg: TArg,
    api?: BaseQueryApi,
  ) => Promise<QueryReturnValue<TResult, FetchBaseQueryError>>
  : never
}

export interface EndpointBuilder {
  query<TResult, TArg>(
    definition: Omit<QueryDefinition<TResult, TArg, "query">, "type">,
  ): QueryDefinition<TResult, TArg, "query">
  mutation<TResult, TArg>(
    definition: Omit<QueryDefinition<TResult, TArg, "mutation">, "type">,
  ): QueryDefinition<TResult, TArg, "mutation">
}

export interface CreateApiConfig<TEndpoints extends Record<string, unknown>> {
  baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>
  reducerPath: string
  tagTypes: string[]
  endpoints: (builder: EndpointBuilder) => TEndpoints
}

export type BaseQueryFn<TArgs, TResult, TError> = (
  args: TArgs,
  api: BaseQueryApi,
  extraOptions?: unknown,
) => Promise<QueryReturnValue<TResult, TError>>

export interface QueryHookState<TResult> {
  data?: TResult
  error?: FetchBaseQueryError
  isUninitialized: boolean
  isLoading: boolean
  isFetching: boolean
  isSuccess: boolean
  isError: boolean
}

export interface QueryMeta {
  response?: {
    status: number
  }
}

export interface QueryReturnValue<TResult, TError> {
  data?: TResult
  error?: TError
  meta?: QueryMeta
}

export type BivariantQuery<TArg> = {
  bivarianceHack: (arg: TArg) => string | FetchArgs
}["bivarianceHack"]

export interface QueryDefinition<
  TResult = unknown,
  TArg = unknown,
  TType extends "query" | "mutation" = "query",
> {
  type: TType
  query: BivariantQuery<TArg>
  transformResponse?: (raw: unknown) => TResult
}

export interface FetchBaseQueryConfig {
  baseUrl?: string
  prepareHeaders?: (headers: Headers) => Promise<Headers> | Headers
}

export interface ParamRequest {
  id: string
}

export interface QueryRequest {
  q: string
}

const createApi = <TEndpoints extends Record<string, unknown>>(
  config: CreateApiConfig<TEndpoints>,
) => {
  const builder: EndpointBuilder = {
    query: (definition) => ({
      type: "query",
      ...definition,
    }),
    mutation: (definition) => ({
      type: "mutation",
      ...definition,
    }),
  };

  const endpoints = config.endpoints(builder);
  const endpointFunctions = Object.entries(endpoints).reduce(
    (acc, [key, definition]) => {
      const endpointDefinition = definition as QueryDefinition<unknown, unknown>;
      acc[key as keyof TEndpoints] = (async (
        arg: unknown,
        api: BaseQueryApi = {},
      ) => {
        const result = await config.baseQuery(
          endpointDefinition.query(arg),
          api,
          undefined,
        );

        if (result.data && endpointDefinition.transformResponse) {
          return {
            ...result,
            data: endpointDefinition.transformResponse(result.data),
          };
        }

        return result;
      }) as EndpointFunctions<TEndpoints>[keyof TEndpoints];

      return acc;
    },
    {} as EndpointFunctions<TEndpoints>,
  );

  return {
    reducerPath: config.reducerPath,
    tagTypes: config.tagTypes,
    baseQuery: config.baseQuery,
    endpoints,
    ...endpointFunctions,
  };
};

const useEndpointQuery = <TArg, TResult>(
  requester: (arg: TArg, api?: BaseQueryApi) => Promise<QueryReturnValue<TResult, FetchBaseQueryError>>,
  arg: TArg,
) => {
  const [state, setState] = useState<QueryHookState<TResult>>({
    data: undefined,
    error: undefined,
    isUninitialized: true,
    isLoading: false,
    isFetching: false,
    isSuccess: false,
    isError: false,
  });

  const refetch = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isLoading: prev.isUninitialized,
      isFetching: true,
      isError: false,
      error: undefined,
    }));

    const result = await requester(arg);

    if (result.error) {
      setState((prev) => ({
        ...prev,
        isUninitialized: false,
        isLoading: false,
        isFetching: false,
        isSuccess: false,
        isError: true,
        error: result.error,
      }));
      return result;
    }

    setState({
      data: result.data,
      error: undefined,
      isUninitialized: false,
      isLoading: false,
      isFetching: false,
      isSuccess: true,
      isError: false,
    });

    return result;
  }, [arg, requester]);

  return {
    ...state,
    refetch,
  };
};

const fetchBaseQuery = ({ baseUrl, prepareHeaders }: FetchBaseQueryConfig) => {
  const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> =
    async (args) => {
      const request: FetchArgs =
        typeof args === "string" ? { url: args, method: "GET" } : args;

      const headers = new Headers(request.headers);
      if (prepareHeaders) {
        await prepareHeaders(headers);
      }

      try {
        const response = await new axios.Axios({
          baseURL: baseUrl,
        }).request({
          url: request.url,
          method: request.method ?? "GET",
          headers: Object.fromEntries(headers.entries()),
          data: request.body,
          params: request.params,
        });

        return {
          data: response.data,
          meta: {
            response: {
              status: response.status,
            },
          },
        };
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          const axiosError = error as {
            response?: { status?: number; data?: unknown };
            message: string;
          };

          return {
            error: {
              status: axiosError.response?.status ?? "FETCH_ERROR",
              data: axiosError.response?.data,
              error: axiosError.message,
            },
            meta: {
              response: {
                status: axiosError.response?.status ?? 0,
              },
            },
          };
        }

        return {
          error: {
            status: "FETCH_ERROR",
            error: error instanceof Error ? error.message : "Unknown error",
          },
        };
      }
    };

  return baseQuery;
};

const authorizeBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const baseQuery = fetchBaseQuery({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
    prepareHeaders: async (headers) => {
      return headers;
    },
  });

  try {
    const result = await baseQuery(args, api, extraOptions);

    if (result.error) {
      const errorData = result.error.data as { message?: string } | undefined;
      const errorMessage =
        errorData?.message ||
        result.error.status.toString() ||
        "An error occurred";
      toast.error(`Error: ${errorMessage}`);
    }

    const isMutationRequest =
      (args as FetchArgs).method && (args as FetchArgs).method !== "GET";

    if (isMutationRequest) {
      const responseBody = result.data as ApiResponseEnvelope | undefined;
      const successMessage = responseBody?.message;
      if (successMessage) toast.success(successMessage);
    }

    if (result.data) {
      const responseBody = result.data as ApiResponseEnvelope;
      result.data = responseBody.data;
    } else if (
      result.error?.status === 204 ||
      result.meta?.response?.status === 24
    ) {
      return { data: null };
    }

    return result;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return { error: { status: "FETCH_ERROR", error: errorMessage } };
  }
};

export const api = createApi({
  baseQuery: authorizeBaseQuery,
  reducerPath: "api",
  tagTypes: [
    "Auth",
    "User",
    "Restaurant",
    "Order",
    "Menu",
    "Category",
    "Recipe",
    "Inventory",
    "Table",
    "Reservation",
    "Promotion",
    "Voucher",
    "Analytics",
    "Delivery",
    "Feedback",
    "Conversation",
    "Message",
    "Finance",
    "Marketplace",
    "Cart",
    "Notification",
    "Organization",
    "RestaurantRole",
    "Supply",
    "Wallet"
  ],
  endpoints: (build) => ({
    // ========== GRAPHQL API ENDPOINTS ==========
    health: build.query<unknown, void>({
      query: () => ({
        url: "/health",
        method: "GET",
      }),
    }),
    param: build.query<unknown, ParamRequest>({
      query: ({ id }) => ({
        url: `/param/${id}`,
        method: "GET",
      }),
    }),
    query: build.query<unknown, QueryRequest>({
      query: ({ q }) => ({
        url: "/query",
        method: "GET",
        params: { q },
      }),
    }),
    graphqlSecond: build.mutation<unknown, unknown>({
      query: (data: unknown) => ({
        url: "/graphql",
        method: "POST",
        body: data,
      }),
    }),
  }),
});

const { health: healthRequest, param: paramRequest, query: queryRequest, graphqlSecond } = api;

const useHealth = () => useEndpointQuery<void, unknown>(healthRequest, undefined);
const useParam = (arg: ParamRequest) => useEndpointQuery<ParamRequest, unknown>(paramRequest, arg);
const useQuery = (arg: QueryRequest) => useEndpointQuery<QueryRequest, unknown>(queryRequest, arg);

export const health = useHealth;
export const param = useParam;
export const query = useQuery;

export { graphqlSecond };
