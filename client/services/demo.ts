"use client"

/* eslint-disable react-hooks/rules-of-hooks -- These functions build service definitions; they do not execute React hooks. */

import { createMutationService, useMutation } from "@/lib/utils/caller"
import type { DemoApiData, DemoApiRequest } from "@/lib/utils/interface"

const demoJsonService = useMutation<DemoApiData, DemoApiRequest>({
  query: (arg: DemoApiRequest) => ({
    baseURL: null,
    url: "/demo/call",
    method: "POST",
    auth: false,
    credentials: "include",
    params: arg.params,
    body: arg.body ?? arg.data,
    headers: arg.headers,
    timeout: arg.timeout,
  }),
  mutationOptions: {
    retry: false,
  },
})

export const useDemoJsonMutation = createMutationService(demoJsonService)
