import type { Route } from "next"

/** Public document verification page with optional prefill query params. */
export function verifyDocumentPageHref(opts?: {
	code?: string
	actNumber?: string
	projectUuid?: string
}): Route {
	const params = new URLSearchParams()
	if (opts?.code?.trim()) params.set("code", opts.code.trim())
	if (opts?.actNumber?.trim()) params.set("actNumber", opts.actNumber.trim())
	if (opts?.projectUuid?.trim()) params.set("projectUuid", opts.projectUuid.trim())
	const q = params.toString()
	return (q ? `/verify/document?${q}` : "/verify/document") as Route
}
