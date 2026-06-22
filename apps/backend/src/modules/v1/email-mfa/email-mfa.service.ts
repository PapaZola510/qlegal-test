import { Inject, Injectable, Logger } from "@nestjs/common"
import { createHash, randomInt } from "node:crypto"
import { ORPCError } from "@orpc/server"
import { and, desc, eq, isNull } from "drizzle-orm"

import { emailVerificationOtps, sessions, users } from "@repo/db/schema"

import { EMAIL_ADAPTER, type EmailAdapter } from "@/services/email/email-adapter"
import { db } from "@/common/database/database.client"
import { env } from "@/config/env.config"

const OTP_TTL_MS = 5 * 60_000

function nowPlus(ms: number): Date {
	return new Date(Date.now() + ms)
}

function generateOtp(): string {
	return String(randomInt(0, 1_000_000)).padStart(6, "0")
}

function otpHash(userId: string, otp: string): string {
	const pepper = env.BETTER_AUTH_SECRET ?? ""
	return createHash("sha256").update(`${pepper}:mfa:${userId}:${otp}`, "utf8").digest("hex")
}

@Injectable()
export class EmailMfaService {
	private readonly log = new Logger(EmailMfaService.name)

	constructor(@Inject(EMAIL_ADAPTER) private readonly email: EmailAdapter) {}

	private async loadUser(userId: string) {
		const [row] = await db
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
			})
			.from(users)
			.where(eq(users.id, userId))
			.limit(1)
		if (!row) throw new ORPCError("NOT_FOUND", { message: "User not found" })
		return row
	}

	private async loadSessionMfaState(sessionId: string) {
		const [row] = await db
			.select({
				mfaRequiredAt: sessions.mfaRequiredAt,
				mfaVerifiedAt: sessions.mfaVerifiedAt,
			})
			.from(sessions)
			.where(eq(sessions.id, sessionId))
			.limit(1)
		return row ?? null
	}

	async getStatus(opts: { userId: string; sessionId: string }) {
		const session = await this.loadSessionMfaState(opts.sessionId)
		if (!session?.mfaRequiredAt || session.mfaVerifiedAt) {
			return { mfaVerified: true as const, expiresAt: null, resendAvailableAt: null }
		}

		const now = new Date()
		const [latest] = await db
			.select()
			.from(emailVerificationOtps)
			.where(
				and(
					eq(emailVerificationOtps.userId, opts.userId),
					eq(emailVerificationOtps.purpose, "login_mfa"),
					eq(emailVerificationOtps.sessionId, opts.sessionId),
					isNull(emailVerificationOtps.consumedAt)
				)
			)
			.orderBy(desc(emailVerificationOtps.createdAt))
			.limit(1)

		if (!latest || now > latest.expiresAt) {
			return { mfaVerified: false as const, expiresAt: null, resendAvailableAt: null }
		}

		return {
			mfaVerified: false as const,
			expiresAt: latest.expiresAt.toISOString(),
			resendAvailableAt: latest.resendAvailableAt.toISOString(),
		}
	}

	async requestOtp(opts: { userId: string; sessionId: string; requestIp: string | null }) {
		const session = await this.loadSessionMfaState(opts.sessionId)
		if (!session?.mfaRequiredAt || session.mfaVerifiedAt) {
			return { expiresAt: new Date().toISOString(), resendAvailableAt: new Date().toISOString() }
		}

		const user = await this.loadUser(opts.userId)
		const now = new Date()

		const [latest] = await db
			.select()
			.from(emailVerificationOtps)
			.where(
				and(
					eq(emailVerificationOtps.userId, opts.userId),
					eq(emailVerificationOtps.purpose, "login_mfa"),
					eq(emailVerificationOtps.sessionId, opts.sessionId),
					isNull(emailVerificationOtps.consumedAt)
				)
			)
			.orderBy(desc(emailVerificationOtps.createdAt))
			.limit(1)

		// If there is an active OTP still valid, don't send another email.
		if (latest && now <= latest.expiresAt) {
			return {
				expiresAt: latest.expiresAt.toISOString(),
				resendAvailableAt: latest.resendAvailableAt.toISOString(),
			}
		}

		if (latest && now < latest.resendAvailableAt) {
			throw new ORPCError("TOO_MANY_REQUESTS", { message: "OTP resend is not available yet." })
		}

		const otp = generateOtp()
		const expiresAt = nowPlus(OTP_TTL_MS)
		const resendAvailableAt = expiresAt

		const [inserted] = await db
			.insert(emailVerificationOtps)
			.values({
				userId: opts.userId,
				email: user.email,
				codeHash: otpHash(opts.userId, otp),
				expiresAt,
				consumedAt: null,
				lastSentAt: now,
				resendAvailableAt,
				sendCount: 1,
				requestIp: opts.requestIp,
				purpose: "login_mfa",
				sessionId: opts.sessionId,
				createdAt: now,
				updatedAt: now,
			})
			.returning({ id: emailVerificationOtps.id })

		if (env.NODE_ENV !== "production") {
			this.log.log(
				`[dev-otp] purpose=login_mfa email=${user.email} userId=${opts.userId} sessionId=${opts.sessionId} otp=${otp} expiresAt=${expiresAt.toISOString()}`
			)
		}

		try {
			await this.email.sendTransactional(user.email, "login_mfa_otp", {
				otp,
				expiresMinutes: "5",
				name: user.name ?? "",
			})
		} catch (error) {
			if (env.NODE_ENV !== "production") {
				const msg = error instanceof Error ? error.message : String(error)
				this.log.warn(
					`MFA email send failed in development; keeping OTP active — use [dev-otp] above. (${msg})`
				)
				return {
					expiresAt: expiresAt.toISOString(),
					resendAvailableAt: resendAvailableAt.toISOString(),
				}
			}
			if (inserted?.id) {
				await db.delete(emailVerificationOtps).where(eq(emailVerificationOtps.id, inserted.id))
			}
			throw error
		}

		return {
			expiresAt: expiresAt.toISOString(),
			resendAvailableAt: resendAvailableAt.toISOString(),
		}
	}

	async verifyOtp(opts: { userId: string; sessionId: string; otp: string }) {
		const session = await this.loadSessionMfaState(opts.sessionId)
		if (!session?.mfaRequiredAt || session.mfaVerifiedAt) return { ok: true as const }

		const now = new Date()
		const [row] = await db
			.select()
			.from(emailVerificationOtps)
			.where(
				and(
					eq(emailVerificationOtps.userId, opts.userId),
					eq(emailVerificationOtps.purpose, "login_mfa"),
					eq(emailVerificationOtps.sessionId, opts.sessionId),
					isNull(emailVerificationOtps.consumedAt)
				)
			)
			.orderBy(desc(emailVerificationOtps.createdAt))
			.limit(1)

		if (!row) throw new ORPCError("BAD_REQUEST", { message: "No active OTP found." })
		if (now > row.expiresAt) throw new ORPCError("BAD_REQUEST", { message: "OTP has expired." })

		const submitted = opts.otp.trim()
		if (!/^\d{6}$/.test(submitted))
			throw new ORPCError("BAD_REQUEST", { message: "OTP must be 6 digits." })

		const expected = otpHash(opts.userId, submitted)
		if (expected !== row.codeHash)
			throw new ORPCError("BAD_REQUEST", { message: "Invalid OTP code." })

		await db.transaction(async tx => {
			// Clear the OTP so the next login session will generate a fresh one.
			await tx
				.delete(emailVerificationOtps)
				.where(
					and(
						eq(emailVerificationOtps.userId, opts.userId),
						eq(emailVerificationOtps.purpose, "login_mfa"),
						eq(emailVerificationOtps.sessionId, opts.sessionId)
					)
				)

			await tx
				.update(sessions)
				.set({ mfaVerifiedAt: now, updatedAt: now })
				.where(eq(sessions.id, opts.sessionId))
		})

		return { ok: true as const }
	}
}
