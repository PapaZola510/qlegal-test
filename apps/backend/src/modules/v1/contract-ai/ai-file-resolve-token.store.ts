import { Injectable } from "@nestjs/common"
import { randomUUID } from "node:crypto"

export interface AiResolveTokenPayload {
	fileObjectId: string
	subOrgIds: string[]
}

@Injectable()
export class AiFileResolveTokenStore {
	private readonly map = new Map<string, { payload: AiResolveTokenPayload; expiresAt: number }>()
	private readonly ttlMs = 120_000

	mint(payload: AiResolveTokenPayload): string {
		const id = randomUUID()
		this.map.set(id, { payload, expiresAt: Date.now() + this.ttlMs })
		this.prune()
		return id
	}

	consume(token: string): AiResolveTokenPayload | null {
		const row = this.map.get(token)
		this.map.delete(token)
		if (!row || row.expiresAt < Date.now()) {
			return null
		}
		return row.payload
	}

	private prune(): void {
		const now = Date.now()
		for (const [k, v] of this.map) {
			if (v.expiresAt < now) {
				this.map.delete(k)
			}
		}
	}
}
