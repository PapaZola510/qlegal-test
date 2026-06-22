import { createORPCClient } from "@orpc/client"
import { OpenAPILink } from "@orpc/openapi-client/fetch"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"

import { v1Contract } from "@repo/contracts"

import { getMockScenarioHeader } from "@/core/lib/mock-scenario-header"
import { env } from "@/env"

export function createOrpcLink(options?: {
	getCookieHeader?: () => string | undefined | Promise<string | undefined>
}) {
	return new OpenAPILink(v1Contract, {
		url: env.NEXT_PUBLIC_API_BASE_URL,
		fetch: async (url, init) => {
			const base = (init ?? {}) as RequestInit
			const headers = new Headers(base.headers)
			const cookie = await Promise.resolve(options?.getCookieHeader?.())
			if (cookie) headers.set("cookie", cookie)
			const mock = getMockScenarioHeader()
			if (mock) headers.set("X-Mock-Scenario", mock)
			// Cross-origin (e.g. web :3001 → API :3000): session cookies only flow when credentials are included.
			return fetch(url, { ...base, headers, credentials: "include" })
		},
	})
}

const globalThisRef = globalThis as typeof globalThis & {
	$orpc?: ReturnType<typeof createORPCClient>
}

const link = createOrpcLink()

const baseOrpc = globalThisRef.$orpc ?? createORPCClient(link)

globalThisRef.$orpc = baseOrpc

/** Imperative client (e.g. outside React). Prefer `orpc` utils in components. */
export const orpcClient = baseOrpc

export const orpc = createTanstackQueryUtils(baseOrpc)
