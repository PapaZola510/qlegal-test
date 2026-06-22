import {
	BadGatewayException,
	Injectable,
	InternalServerErrorException,
	Logger,
} from "@nestjs/common"
import { createReadStream, promises as fs } from "node:fs"
import * as path from "node:path"
import { Readable } from "node:stream"
import { GetObjectCommand, S3Client, type S3ClientConfig } from "@aws-sdk/client-s3"
import { Upload } from "@aws-sdk/lib-storage"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import type { Env } from "@/config/env.config"

import type { QlegalFileBucket } from "./file-buckets"

export const FILE_STORAGE_ADAPTER = Symbol("FILE_STORAGE_ADAPTER")

export interface FileStoragePutParams {
	bucket: QlegalFileBucket
	/** Must start with `<sub_org_id>/` (enforced here). */
	key: string
	subOrgId: string
	filePath: string
	contentType: string
}

export interface FileStorageGetSignedUrlParams {
	bucket: QlegalFileBucket
	key: string
	expiresSeconds: number
}

export interface FileStorageOpenStreamResult {
	stream: Readable
	contentType: string
	contentLength: number
}

export interface FileStorageAdapter {
	putObjectFromFile(params: FileStoragePutParams): Promise<void>
	getSignedGetUrl(params: FileStorageGetSignedUrlParams): Promise<string>
	openReadStream(bucket: QlegalFileBucket, key: string): Promise<FileStorageOpenStreamResult>
}

function assertTenantKeyPrefix(key: string, subOrgId: string): void {
	const prefix = `${subOrgId}/`
	if (!key.startsWith(prefix) || key.length <= prefix.length) {
		throw new InternalServerErrorException("Storage key must use <sub_org_id>/ prefix")
	}
}

function s3ClientFromEnv(e: Env): S3Client {
	const endpoint = e.S3_ENDPOINT
	const region = e.S3_REGION ?? "us-east-1"
	const accessKeyId = e.S3_ACCESS_KEY_ID
	const secretAccessKey = e.S3_SECRET_ACCESS_KEY
	if (!endpoint || !accessKeyId || !secretAccessKey) {
		throw new InternalServerErrorException("S3 configuration is incomplete")
	}
	const cfg: S3ClientConfig = {
		region,
		endpoint,
		credentials: { accessKeyId, secretAccessKey },
		forcePathStyle: e.S3_FORCE_PATH_STYLE === "true",
	}
	return new S3Client(cfg)
}

@Injectable()
export class S3FileStorageAdapter implements FileStorageAdapter {
	private readonly log = new Logger(S3FileStorageAdapter.name)

	constructor(private readonly client: S3Client) {}

	async putObjectFromFile(params: FileStoragePutParams): Promise<void> {
		assertTenantKeyPrefix(params.key, params.subOrgId)
		const body = createReadStream(params.filePath)
		const upload = new Upload({
			client: this.client,
			params: {
				Bucket: params.bucket,
				Key: params.key,
				Body: body,
				ContentType: params.contentType,
			},
		})
		try {
			await upload.done()
		} catch (err) {
			this.log.warn(`S3 upload failed: ${err instanceof Error ? err.message : String(err)}`)
			throw new BadGatewayException("Object storage upload failed")
		}
	}

	async getSignedGetUrl(params: FileStorageGetSignedUrlParams): Promise<string> {
		const cmd = new GetObjectCommand({ Bucket: params.bucket, Key: params.key })
		return getSignedUrl(this.client, cmd, { expiresIn: params.expiresSeconds })
	}

	async openReadStream(
		bucket: QlegalFileBucket,
		key: string
	): Promise<FileStorageOpenStreamResult> {
		let out
		try {
			out = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
		} catch (err) {
			this.log.warn(`S3 getObject failed: ${err instanceof Error ? err.message : String(err)}`)
			throw new BadGatewayException("Object storage read failed")
		}
		const stream = out.Body
		if (!stream || !(stream instanceof Readable)) {
			throw new BadGatewayException("Object storage returned empty body")
		}
		const contentLength = Number(out.ContentLength ?? 0)
		const contentType = out.ContentType ?? "application/octet-stream"
		return { stream, contentType, contentLength }
	}
}

/**
 * Disk-backed storage for local dev / tests when S3 env vars are not set.
 * Persists bytes under `<rootDir>/<bucket>/<key>` so files survive backend restarts.
 * Content-type is stored alongside as a sidecar `<key>.meta.json` file.
 */
@Injectable()
export class DiskFileStorageAdapter implements FileStorageAdapter {
	private readonly log = new Logger(DiskFileStorageAdapter.name)

	constructor(private readonly rootDir: string) {}

	private objectPath(bucket: QlegalFileBucket, key: string): string {
		return path.join(this.rootDir, bucket, key)
	}

	async putObjectFromFile(params: FileStoragePutParams): Promise<void> {
		assertTenantKeyPrefix(params.key, params.subOrgId)
		const dest = this.objectPath(params.bucket, params.key)
		try {
			await fs.mkdir(path.dirname(dest), { recursive: true })
			// Copy (not rename) — `params.filePath` lives in os.tmpdir() and gets unlinked
			// by the caller after this returns, so we need our own persistent copy.
			await fs.copyFile(params.filePath, dest)
			await fs.writeFile(
				`${dest}.meta.json`,
				JSON.stringify({ contentType: params.contentType }),
				"utf8"
			)
		} catch (err) {
			this.log.warn(`Disk write failed: ${err instanceof Error ? err.message : String(err)}`)
			throw new BadGatewayException("Local disk storage write failed")
		}
	}

	async getSignedGetUrl(params: FileStorageGetSignedUrlParams): Promise<string> {
		return `file://local/${encodeURIComponent(params.bucket)}/${encodeURIComponent(params.key)}?expires=${params.expiresSeconds}`
	}

	async openReadStream(
		bucket: QlegalFileBucket,
		key: string
	): Promise<FileStorageOpenStreamResult> {
		const src = this.objectPath(bucket, key)
		let stats
		try {
			stats = await fs.stat(src)
		} catch {
			throw new BadGatewayException("Object not found in local disk storage")
		}
		let contentType = "application/octet-stream"
		try {
			const raw = await fs.readFile(`${src}.meta.json`, "utf8")
			const parsed = JSON.parse(raw) as { contentType?: unknown }
			if (typeof parsed.contentType === "string") contentType = parsed.contentType
		} catch {
			// Missing or unreadable sidecar — fall back to octet-stream.
		}
		return {
			stream: createReadStream(src),
			contentType,
			contentLength: stats.size,
		}
	}
}

export function createFileStorageAdapter(e: Env): FileStorageAdapter {
	const hasS3 =
		Boolean(e.S3_ENDPOINT) && Boolean(e.S3_ACCESS_KEY_ID) && Boolean(e.S3_SECRET_ACCESS_KEY)
	if (hasS3) {
		return new S3FileStorageAdapter(s3ClientFromEnv(e))
	}
	if (e.NODE_ENV === "production") {
		throw new Error(
			"S3 storage is required in production (set S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION)"
		)
	}
	// Default to a stable path inside the backend workspace so uploads survive restarts
	// during local development. Override with `LOCAL_FILE_STORAGE_DIR` if needed.
	const rootDir = e.LOCAL_FILE_STORAGE_DIR ?? path.resolve(process.cwd(), ".local-storage")
	return new DiskFileStorageAdapter(rootDir)
}
