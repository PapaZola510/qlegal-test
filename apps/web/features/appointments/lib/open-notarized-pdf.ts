import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"

/** Backend returns 425 when vault has not published the sealed PDF yet. */
const RETRYABLE_NOTARIZED_PDF_STATUS = new Set([425, 503])

/** User-initiated View/Download — still patient while DC publishes the seal. */
const DEFAULT_MAX_ATTEMPTS = 10
const DEFAULT_INITIAL_RETRY_DELAY_MS = 500
const DEFAULT_MAX_RETRY_DELAY_MS = 2_500
const DEFAULT_RETRY_BACKOFF = 1.25

/** Background prefetch — fewer retries to avoid hammering the API. */
const PREFETCH_MAX_ATTEMPTS = 6
const PREFETCH_INITIAL_RETRY_DELAY_MS = 500
const PREFETCH_MAX_RETRY_DELAY_MS = 2_000

const CLIENT_BLOB_CACHE_TTL_MS = 30 * 60 * 1000

const clientBlobCache = new Map<string, { blob: Blob; expiresAt: number }>()
const inFlightByUrl = new Map<string, Promise<Blob>>()
/** After a failed prefetch, avoid repeating the same URL for a short window. */
const prefetchFailureUntil = new Map<string, number>()
const PREFETCH_FAILURE_COOLDOWN_MS = 60_000

function isPrefetchOnFailureCooldown(url: string): boolean {
	const until = prefetchFailureUntil.get(url)
	if (!until) return false
	if (until <= Date.now()) {
		prefetchFailureUntil.delete(url)
		return false
	}
	return true
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new DOMException("Aborted", "AbortError"))
			return
		}
		const id = window.setTimeout(resolve, ms)
		signal?.addEventListener(
			"abort",
			() => {
				window.clearTimeout(id)
				reject(new DOMException("Aborted", "AbortError"))
			},
			{ once: true }
		)
	})
}

function getCachedClientBlob(url: string): Blob | null {
	const hit = clientBlobCache.get(url)
	if (!hit) return null
	if (hit.expiresAt <= Date.now()) {
		clientBlobCache.delete(url)
		return null
	}
	return hit.blob
}

function setCachedClientBlob(url: string, blob: Blob): void {
	clientBlobCache.set(url, { blob, expiresAt: Date.now() + CLIENT_BLOB_CACHE_TTL_MS })
}

async function notarizedPdfErrorMessage(res: Response): Promise<string> {
	const fallback = `Could not load notarized PDF (${res.status})`
	try {
		const cloned = res.clone()
		const json = (await cloned.json()) as {
			error?: { message?: string | string[] }
			message?: string
		}
		const nested = json?.error?.message
		const msg = Array.isArray(nested) ? nested.join(" ") : (nested ?? json?.message)
		if (typeof msg === "string" && msg.trim()) return msg.trim()
	} catch {
		/* not JSON */
	}
	const text = await res.text().catch(() => "")
	return text.trim().slice(0, 240) || fallback
}

function isValidPdfBlob(blob: Blob): boolean {
	const type = blob.type.toLowerCase()
	if (type.includes("json") || type.includes("html")) return false
	return blob.size >= 256
}

type FetchNotarizedPdfOptions = {
	signal?: AbortSignal
	maxAttempts?: number
	initialRetryDelayMs?: number
	maxRetryDelayMs?: number
	retryBackoff?: number
}

async function fetchNotarizedPdfBlobFromNetwork(
	url: string,
	opts?: FetchNotarizedPdfOptions
): Promise<Blob> {
	const maxAttempts = opts?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
	let delayMs = opts?.initialRetryDelayMs ?? DEFAULT_INITIAL_RETRY_DELAY_MS
	const maxRetryDelayMs = opts?.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS
	const retryBackoff = opts?.retryBackoff ?? DEFAULT_RETRY_BACKOFF

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		if (opts?.signal?.aborted) {
			throw new DOMException("Aborted", "AbortError")
		}

		const res = await fetch(url, { credentials: "include", signal: opts?.signal })

		if (res.ok) {
			const blob = await res.blob()
			if (!isValidPdfBlob(blob)) {
				if (attempt < maxAttempts) {
					await sleep(delayMs, opts?.signal)
					delayMs = Math.min(Math.round(delayMs * retryBackoff), maxRetryDelayMs)
					continue
				}
				throw new Error(
					"has not published the sealed notarized PDF yet. Wait a moment and try View again."
				)
			}
			return blob
		}

		if (RETRYABLE_NOTARIZED_PDF_STATUS.has(res.status) && attempt < maxAttempts) {
			await sleep(delayMs, opts?.signal)
			delayMs = Math.min(Math.round(delayMs * retryBackoff), maxRetryDelayMs)
			continue
		}

		throw new Error(await notarizedPdfErrorMessage(res))
	}

	throw new Error(
		"has not published the sealed notarized PDF yet. Wait a moment and try View again."
	)
}

/**
 * Fetches the sealed PDF through our API proxy (cookies included).
 * Reuses in-session blob cache and dedupes concurrent requests for the same URL.
 */
export async function fetchNotarizedPdfBlob(
	url: string,
	opts?: FetchNotarizedPdfOptions
): Promise<Blob> {
	const cached = getCachedClientBlob(url)
	if (cached) return cached

	let inFlight = inFlightByUrl.get(url)
	if (!inFlight) {
		inFlight = fetchNotarizedPdfBlobFromNetwork(url, opts).finally(() => {
			inFlightByUrl.delete(url)
		})
		inFlightByUrl.set(url, inFlight)
	}

	try {
		const blob = await inFlight
		setCachedClientBlob(url, blob)
		prefetchFailureUntil.delete(url)
		return blob
	} catch (e) {
		if (opts?.maxAttempts !== undefined && opts.maxAttempts <= PREFETCH_MAX_ATTEMPTS) {
			prefetchFailureUntil.set(url, Date.now() + PREFETCH_FAILURE_COOLDOWN_MS)
		}
		throw e
	}
}

export function openBlobPdfInNewTab(blobUrl: string): boolean {
	const opened = window.open(blobUrl, "_blank", "noopener,noreferrer")
	return Boolean(opened)
}

export async function openNotarizedPdfFromApiUrl(
	url: string,
	opts?: { cachedBlobUrl?: string | null; signal?: AbortSignal }
): Promise<void> {
	let blobUrl = opts?.cachedBlobUrl?.trim() || null
	let ownedBlobUrl = false
	if (!blobUrl) {
		const blob = await fetchNotarizedPdfBlob(url, { signal: opts?.signal })
		blobUrl = URL.createObjectURL(blob)
		ownedBlobUrl = true
	}
	if (!openBlobPdfInNewTab(blobUrl)) {
		if (ownedBlobUrl) URL.revokeObjectURL(blobUrl)
		throw new Error("Could not open the PDF. Allow pop-ups for this site and try again.")
	}
}

export async function downloadNotarizedPdfFromApiUrl(
	url: string,
	filename: string,
	opts?: { signal?: AbortSignal }
): Promise<void> {
	const blob = await fetchNotarizedPdfBlob(url, opts)
	const blobUrl = URL.createObjectURL(blob)
	const anchor = document.createElement("a")
	anchor.href = blobUrl
	anchor.download = filename
	anchor.rel = "noopener"
	document.body.appendChild(anchor)
	anchor.click()
	anchor.remove()
	URL.revokeObjectURL(blobUrl)
}

/**
 * Optional background warm-up. Skips when the blob is already cached.
 * Registry rows should not call this on mount — only on View/Download.
 */
export function prefetchNotarizedPdfBlob(
	url: string,
	onReady: (blobUrl: string) => void,
	onError?: (err: unknown) => void
): () => void {
	const cached = getCachedClientBlob(url)
	if (cached) {
		onReady(URL.createObjectURL(cached))
		return () => undefined
	}
	if (isPrefetchOnFailureCooldown(url)) {
		onError?.(
			new Error(
				"has not published the sealed notarized PDF yet. Wait a moment and try View again."
			)
		)
		return () => undefined
	}

	const controller = new AbortController()
	let cancelled = false

	void fetchNotarizedPdfBlob(url, {
		signal: controller.signal,
		maxAttempts: PREFETCH_MAX_ATTEMPTS,
		initialRetryDelayMs: PREFETCH_INITIAL_RETRY_DELAY_MS,
		maxRetryDelayMs: PREFETCH_MAX_RETRY_DELAY_MS,
	})
		.then(blob => {
			if (cancelled) return
			onReady(URL.createObjectURL(blob))
		})
		.catch(err => {
			if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return
			onError?.(err)
		})

	return () => {
		cancelled = true
		controller.abort()
	}
}

export function notarizedPdfOpenErrorMessage(err: unknown): string {
	return getOrpcMutationErrorMessage(
		err,
		"Could not open the notarized PDF. Wait a moment and try again."
	)
}
