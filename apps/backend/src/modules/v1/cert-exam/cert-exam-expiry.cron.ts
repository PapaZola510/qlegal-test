import { Injectable, Logger } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"

import { CertExamService } from "./cert-exam.service"

@Injectable()
export class CertExamExpiryCron {
	private readonly log = new Logger(CertExamExpiryCron.name)

	constructor(private readonly certExam: CertExamService) {}

	@Cron(CronExpression.EVERY_MINUTE)
	async sweep(): Promise<void> {
		try {
			await this.certExam.sweepExpiredExamAttempts()
		} catch (error) {
			this.log.error("cert exam expiry sweep failed", error as Error)
		}
	}
}
