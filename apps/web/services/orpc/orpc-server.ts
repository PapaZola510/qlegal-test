import "server-only"

import { createORPCClient } from "@orpc/client"

import { getCookieHeader } from "@/core/lib/cookie-utils"

import { createOrpcLink } from "./client"

const link = createOrpcLink({
	getCookieHeader: async () => {
		const raw = await getCookieHeader()
		return raw.length > 0 ? raw : undefined
	},
})

export const orpcServer = createORPCClient(link)
