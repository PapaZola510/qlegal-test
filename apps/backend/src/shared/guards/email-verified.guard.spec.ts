import { ForbiddenException } from "@nestjs/common"

const mockLimit = jest.fn()
const mockWhere = jest.fn(() => ({ limit: mockLimit }))
const mockFrom = jest.fn(() => ({ where: mockWhere }))
const mockSelect = jest.fn(() => ({ from: mockFrom }))

jest.mock("@/common/database/database.client", () => ({
	db: {
		select: mockSelect,
	},
}))

jest.mock("drizzle-orm", () => ({
	eq: jest.fn(() => ({ kind: "eq" })),
}))

jest.mock("@repo/db/schema", () => ({
	sessions: {
		id: "sessions.id",
		mfaRequiredAt: "sessions.mfaRequiredAt",
		mfaVerifiedAt: "sessions.mfaVerifiedAt",
	},
	users: {
		id: "users.id",
		emailVerified: "users.emailVerified",
	},
}))

const { EmailVerifiedGuard } =
	require("./email-verified.guard") as typeof import("./email-verified.guard")

describe("EmailVerifiedGuard", () => {
	function makeContext(req: Record<string, unknown>) {
		return {
			switchToHttp: () => ({
				getRequest: () => req,
			}),
		} as Parameters<InstanceType<typeof EmailVerifiedGuard>["canActivate"]>[0]
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("allows MFA endpoints without DB checks", async () => {
		const guard = new EmailVerifiedGuard()
		await expect(
			guard.canActivate(makeContext({ originalUrl: "/api/v1/email/mfa/status" }))
		).resolves.toBe(true)
		expect(mockSelect).not.toHaveBeenCalled()
	})

	it("allows dev bootstrap endpoints without DB checks", async () => {
		const guard = new EmailVerifiedGuard()
		await expect(
			guard.canActivate(makeContext({ originalUrl: "/api/v1/dev/sync-admin-role" }))
		).resolves.toBe(true)
		expect(mockSelect).not.toHaveBeenCalled()
	})

	it("allows sessions that do not require MFA", async () => {
		mockLimit
			.mockResolvedValueOnce([{ mfaRequiredAt: null, mfaVerifiedAt: null }])
			.mockResolvedValueOnce([{ emailVerified: true }])

		const guard = new EmailVerifiedGuard()
		await expect(
			guard.canActivate(
				makeContext({
					originalUrl: "/api/v1/profile/dashboard",
					qlegalSessionContext: { userId: "u1", sessionId: "s1" },
				})
			)
		).resolves.toBe(true)
	})

	it("blocks protected APIs when an MFA-required session is not verified", async () => {
		mockLimit.mockResolvedValueOnce([{ mfaRequiredAt: new Date(), mfaVerifiedAt: null }])

		const guard = new EmailVerifiedGuard()
		await expect(
			guard.canActivate(
				makeContext({
					originalUrl: "/api/v1/profile/dashboard",
					qlegalSessionContext: { userId: "u1", sessionId: "s1" },
				})
			)
		).rejects.toThrow(ForbiddenException)
	})

	it("allows protected APIs after the required MFA session is verified", async () => {
		mockLimit
			.mockResolvedValueOnce([{ mfaRequiredAt: new Date(), mfaVerifiedAt: new Date() }])
			.mockResolvedValueOnce([{ emailVerified: true }])

		const guard = new EmailVerifiedGuard()
		await expect(
			guard.canActivate(
				makeContext({
					originalUrl: "/api/v1/profile/dashboard",
					qlegalSessionContext: { userId: "u1", sessionId: "s1" },
				})
			)
		).resolves.toBe(true)
	})
})
