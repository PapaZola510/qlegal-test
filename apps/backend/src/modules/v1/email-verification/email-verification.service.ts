import { Inject, Injectable, Logger } from "@nestjs/common"
import { createHash, randomInt } from "node:crypto"
import { ORPCError } from "@orpc/server"
import { and, desc, eq, isNull } from "drizzle-orm"

import { emailVerificationOtps, users } from "@repo/db/schema"

import { EMAIL_ADAPTER, type EmailAdapter } from "@/services/email/email-adapter"
import { db } from "@/common/database/database.client"
import { env } from "@/config/env.config"

const OTP_TTL_MS = 5 * 60_000

function nowPlus(ms: number): Date {
	return new Date(Date.now() + ms)
}

function generateOtp(): string {
	// crypto.randomInt is CSPRNG-backed in Node.
	return String(randomInt(0, 1_000_000)).padStart(6, "0")
}

function otpHash(userId: string, otp: string): string {
	// Pepper with BETTER_AUTH_SECRET so DB leaks don't reveal OTPs.
	const pepper = env.BETTER_AUTH_SECRET ?? ""
	return createHash("sha256").update(`${pepper}:${userId}:${otp}`, "utf8").digest("hex")
}

@Injectable()
export class EmailVerificationService {
	private readonly log = new Logger(EmailVerificationService.name)

	constructor(@Inject(EMAIL_ADAPTER) private readonly email: EmailAdapter) {}

	private async loadUser(userId: string) {
		const [row] = await db
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
				emailVerified: users.emailVerified,
			})
			.from(users)
			.where(eq(users.id, userId))
			.limit(1)
		if (!row) {
			throw new ORPCError("NOT_FOUND", { message: "User not found" })
		}
		return row
	}

	async requestOtp(opts: { userId: string; requestIp: string | null }) {
		const user = await this.loadUser(opts.userId)
		if (user.emailVerified) {
			return {
				expiresAt: new Date().toISOString(),
				resendAvailableAt: new Date().toISOString(),
			}
		}

		const now = new Date()
		const [latest] = await db
			.select()
			.from(emailVerificationOtps)
			.where(
				and(eq(emailVerificationOtps.userId, opts.userId), isNull(emailVerificationOtps.consumedAt))
			)
			.orderBy(desc(emailVerificationOtps.createdAt))
			.limit(1)

		if (latest && now < latest.resendAvailableAt) {
			throw new ORPCError("TOO_MANY_REQUESTS", {
				message: "OTP resend is not available yet. Please wait before requesting again.",
			})
		}

		const otp = generateOtp()
		const expiresAt = nowPlus(OTP_TTL_MS)
		const resendAvailableAt = expiresAt

		await db.insert(emailVerificationOtps).values({
			userId: opts.userId,
			email: user.email,
			codeHash: otpHash(opts.userId, otp),
			expiresAt,
			consumedAt: null,
			lastSentAt: now,
			resendAvailableAt,
			sendCount: 1,
			requestIp: opts.requestIp,
			createdAt: now,
			updatedAt: now,
		})

		if (env.NODE_ENV !== "production") {
			this.log.log(
				`[dev-otp] purpose=email_verification email=${user.email} userId=${opts.userId} otp=${otp} expiresAt=${expiresAt.toISOString()}`
			)
		}

		await this.email.sendTransactional(user.email, "email_verification_otp", {
			otp,
			expiresMinutes: "5",
			name: user.name ?? "",
		})

		return {
			expiresAt: expiresAt.toISOString(),
			resendAvailableAt: resendAvailableAt.toISOString(),
		}
	}

	async getStatus(opts: { userId: string }) {
		const user = await this.loadUser(opts.userId)
		if (user.emailVerified) {
			return { emailVerified: true as const, expiresAt: null, resendAvailableAt: null }
		}

		const now = new Date()
		const [latest] = await db
			.select()
			.from(emailVerificationOtps)
			.where(
				and(eq(emailVerificationOtps.userId, opts.userId), isNull(emailVerificationOtps.consumedAt))
			)
			.orderBy(desc(emailVerificationOtps.createdAt))
			.limit(1)

		if (!latest) {
			return { emailVerified: false as const, expiresAt: null, resendAvailableAt: null }
		}

		// If it's expired, treat as no active OTP (UI will enable resend).
		if (now > latest.expiresAt) {
			return { emailVerified: false as const, expiresAt: null, resendAvailableAt: null }
		}

		return {
			emailVerified: false as const,
			expiresAt: latest.expiresAt.toISOString(),
			resendAvailableAt: latest.resendAvailableAt.toISOString(),
		}
	}

	async verifyOtp(opts: { userId: string; otp: string }) {
		const user = await this.loadUser(opts.userId)
		if (user.emailVerified) return { ok: true as const }

		const now = new Date()
		const [row] = await db
			.select()
			.from(emailVerificationOtps)
			.where(
				and(eq(emailVerificationOtps.userId, opts.userId), isNull(emailVerificationOtps.consumedAt))
			)
			.orderBy(desc(emailVerificationOtps.createdAt))
			.limit(1)

		if (!row) {
			throw new ORPCError("BAD_REQUEST", {
				message: "No active OTP found. Please request a new code.",
			})
		}
		if (now > row.expiresAt) {
			throw new ORPCError("BAD_REQUEST", { message: "OTP has expired. Please request a new code." })
		}

		const submitted = opts.otp.trim()
		if (!/^\d{6}$/.test(submitted)) {
			throw new ORPCError("BAD_REQUEST", { message: "OTP must be a 6-digit code." })
		}

		const expectedHash = otpHash(opts.userId, submitted)
		if (expectedHash !== row.codeHash) {
			throw new ORPCError("BAD_REQUEST", { message: "Invalid OTP code." })
		}

		await db.transaction(async tx => {
			await tx
				.update(emailVerificationOtps)
				.set({ consumedAt: now, updatedAt: now })
				.where(
					and(
						eq(emailVerificationOtps.userId, opts.userId),
						eq(emailVerificationOtps.codeHash, row.codeHash),
						isNull(emailVerificationOtps.consumedAt)
					)
				)

			await tx
				.update(users)
				.set({ emailVerified: true, updatedAt: now })
				.where(eq(users.id, opts.userId))
		})

		return { ok: true as const }
	}
}
