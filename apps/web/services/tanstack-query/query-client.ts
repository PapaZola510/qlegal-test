import { cache } from "react"
import { StandardRPCJsonSerializer } from "@orpc/client/standard"
import { defaultShouldDehydrateQuery, isServer, QueryClient } from "@tanstack/react-query"

const serializer = new StandardRPCJsonSerializer({ customJsonSerializers: [] })

/**
 * Creates a QueryClient with oRPC-compatible key hashing and dehydration/hydration.
 * Safe for both oRPC and non-oRPC queries (e.g. session).
 */
export const createQueryClient = () =>
	new QueryClient({
		defaultOptions: {
			queries: {
				queryKeyHashFn(queryKey) {
					const [json, meta] = serializer.serialize(queryKey)
					return JSON.stringify({ json, meta })
				},
				// With SSR, we usually want to set some default staleTime
				// above 0 to avoid refetching immediately on the client
				staleTime: 30 * 1000,
			},
			dehydrate: {
				shouldDehydrateQuery: query =>
					defaultShouldDehydrateQuery(query) || query.state.status === "pending",
				serializeData(data) {
					const [json, meta] = serializer.serialize(data)
					return { json, meta }
				},
			},
			hydrate: {
				deserializeData(data: { json: unknown; meta: unknown }) {
					return serializer.deserialize(
						data.json,
						data.meta as Parameters<typeof serializer.deserialize>[1]
					)
				},
			},
		},
	})

const getServerQueryClient = cache(createQueryClient)

let clientQueryClientSingleton: QueryClient | undefined = undefined

/**
 * Returns a QueryClient: per-request cached on server, singleton on client.
 */
export const getQueryClient = () => {
	if (isServer) return getServerQueryClient()
	clientQueryClientSingleton ??= createQueryClient()
	return clientQueryClientSingleton
}
