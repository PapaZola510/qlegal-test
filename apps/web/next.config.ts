import "dotenv/config"

import type { NextConfig } from "next"
import path from "node:path"

import "./env"

/** Nest origin for dev API proxy (server-side only; default Nest listen address). */
const DEV_BACKEND_ORIGIN = process.env.BACKEND_PROXY_ORIGIN ?? "http://localhost:3080"

/** @type {import("next").NextConfig} */
const config: NextConfig = {
	typedRoutes: true,
	output: "standalone",
	outputFileTracingRoot: path.resolve(import.meta.dirname, "../../"),

	/**
	 * Proxy `/api/*` and `/socket.io/*` through Next so the browser stays same-origin (`:3001`).
	 * Session cookies set by Better Auth on the same host then attach to `fetch("/api/...")`.
	 * Runs in dev AND prod (`pnpm start`) — set `BACKEND_PROXY_ORIGIN` to point at the Nest origin.
	 */
	async rewrites() {
		const backend = DEV_BACKEND_ORIGIN.replace(/\/$/, "")
		return [
			{ source: "/api/:path*", destination: `${backend}/api/:path*` },
			{ source: "/socket.io", destination: `${backend}/socket.io` },
			{ source: "/socket.io/:path*", destination: `${backend}/socket.io/:path*` },
		]
	},

	async redirects() {
		return [
			{ source: "/sessions", destination: "/appointments", permanent: false },
			{ source: "/sessions/:path*", destination: "/appointments", permanent: false },
		]
	},

	/** Enables hot reloading for local packages without a build step */
	transpilePackages: [
		"@repo/auth",
		"@repo/backend",
		"@repo/contracts",
		"@repo/db",
		"@t3-oss/env-core",
		"@t3-oss/env-nextjs",
	],

	images: {
		localPatterns: [{ pathname: "/**" }],
	},

	typescript: { ignoreBuildErrors: true },
	reactCompiler: true,

	devIndicators: {
		position: "bottom-right",
	},
}

export default config
