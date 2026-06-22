import { Injectable, Logger } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"
import { sql } from "drizzle-orm"

import { db } from "@/common/database/database.client"
import { env } from "@/config/env.config"

/**
 * G1 / E4: persists `appointments.can_start` every minute (same window rule as session start validation).
 * In-process `@nestjs/schedule` — see `docs/g1-hardening-runbook.md` for multi-instance limits.
 */
@Injectable()
export class AppointmentsCanStartCron {
	private readonly log = new Logger(AppointmentsCanStartCron.name)

	@Cron(CronExpression.EVERY_MINUTE)
	async refreshCanStart(): Promise<void> {
		const lead = env.APPOINTMENT_SESSION_LEAD_MINUTES
		try {
			await db.execute(sql`
				UPDATE appointments
				SET
					can_start = (
						status = 'confirmed'
						AND NOW() >= scheduled_at - (interval '1 minute' * ${lead})
						AND NOW() < scheduled_at + (duration_minutes * interval '1 minute')
					),
					updated_at = NOW()
				WHERE status = 'confirmed' OR can_start = true
			`)
		} catch (error) {
			this.log.error("appointments can_start refresh failed", error as Error)
		}
	}
}
