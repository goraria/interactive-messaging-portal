"use client"


import { createMutationService, defineMutation } from "@/utils/caller"
import type { DemoApiData, DemoApiRequest } from "@/utils/interface"

const demoJsonService = defineMutation<DemoApiData, DemoApiRequest>({
  query: (arg: DemoApiRequest) => ({
    baseURL: null,
    url: "/internal/demo/call",
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
