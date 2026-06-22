import { Injectable, Logger } from "@nestjs/common"
import { eq } from "drizzle-orm"

import { enpProfiles, users } from "@repo/db/schema"

import { db } from "@/common/database/database.client"

import { buildLmsUpsertInput } from "./build-lms-upsert-input"
import { LmsClient } from "./lms.client"

/** Background QLearn sync (draft §1). Interactive handoff lives in `IntegrationService`. */
@Injectable()
export class LmsSyncService {
	private readonly log = new Logger(LmsSyncService.name)

	constructor(private readonly client: LmsClient) {}

	async syncEnpLearnerSilently(userId: string): Promise<void> {
		try {
			const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
			if (!userRow) return

			const [enpRow] = await db
				.select()
				.from(enpProfiles)
				.where(eq(enpProfiles.userId, userId))
				.limit(1)
			if (!enpRow) return

			const result = await this.client.upsertUser(buildLmsUpsertInput(userRow, enpRow))
			this.log.log(
				`QLearn upsert ok for user=${userId} lmsUserId=${result.lmsUserId} action=${result.action}`
			)
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			this.log.warn(`QLearn silent upsert threw for user=${userId}: ${msg}`)
		}
	}
}
