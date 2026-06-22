import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

/** How long cached sealed PDFs remain valid (disk + memory). */
const NOTARIZED_PDF_BYTES_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

const memory = new Map<string, { buf: Buffer; expiresAt: number }>()

function sanitizeProjectUuid(projectUuid: string): string {
	return projectUuid.trim().replace(/[^a-zA-Z0-9_-]/g, "_")
}

function cacheDir(): string {
	return path.join(os.tmpdir(), "qlegal-notarized-pdf-cache")
}

function isPdfBuffer(buf: Buffer): boolean {
	return buf.length >= 5 && buf.subarray(0, 4).toString("ascii") === "%PDF"
}

export async function readNotarizedPdfBytesCache(projectUuid: string): Promise<Buffer | null> {
	const key = sanitizeProjectUuid(projectUuid)
	if (!key) return null

	const mem = memory.get(key)
	if (mem) {
		if (mem.expiresAt > Date.now()) return mem.buf
		memory.delete(key)
	}

	const filePath = path.join(cacheDir(), `${key}.pdf`)
	try {
		const stat = await fs.stat(filePath)
		if (Date.now() - stat.mtimeMs > NOTARIZED_PDF_BYTES_CACHE_TTL_MS) {
			await fs.unlink(filePath).catch(() => undefined)
			return null
		}
		const buf = await fs.readFile(filePath)
		if (!isPdfBuffer(buf)) return null
		memory.set(key, { buf, expiresAt: Date.now() + NOTARIZED_PDF_BYTES_CACHE_TTL_MS })
		return buf
	} catch {
		return null
	}
}

export async function writeNotarizedPdfBytesCache(projectUuid: string, buf: Buffer): Promise<void> {
	if (!isPdfBuffer(buf)) return
	const key = sanitizeProjectUuid(projectUuid)
	if (!key) return

	memory.set(key, { buf, expiresAt: Date.now() + NOTARIZED_PDF_BYTES_CACHE_TTL_MS })
	try {
		await fs.mkdir(cacheDir(), { recursive: true })
		await fs.writeFile(path.join(cacheDir(), `${key}.pdf`), buf)
	} catch {
		/* disk cache is best-effort */
	}
}

/** Drop a cached interim/sign-only PDF so the next fetch retries vault/project sealed sources. */
export async function deleteNotarizedPdfBytesCache(projectUuid: string): Promise<void> {
	const key = sanitizeProjectUuid(projectUuid)
	if (!key) return
	memory.delete(key)
	try {
		await fs.unlink(path.join(cacheDir(), `${key}.pdf`))
	} catch {
		/* ignore missing file */
	}
}
