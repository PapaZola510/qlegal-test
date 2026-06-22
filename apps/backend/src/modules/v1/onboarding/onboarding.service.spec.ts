import { OnboardingService } from "./onboarding.service"

jest.mock("@/services/hyperverge/hyperverge-kyc-logs.service", () => ({
	__esModule: true,
	HypervergeKycLogsService: class HypervergeKycLogsService {},
}))

jest.mock("./lib/sync-government-id-expiry-from-kyc", () => ({
	syncGovernmentIdExpiryFromKyc: jest.fn(async () => ({ saved: false, expiryYmd: null })),
}))

jest.mock("@orpc/server", () => ({
	__esModule: true,
	ORPCError: class ORPCError extends Error {
		code: string
		constructor(code: string, opts?: { message?: string }) {
			super(opts?.message ?? code)
			this.code = code
		}
	},
}))

jest.mock("@repo/db/schema", () => ({
	__esModule: true,
	auditEvents: {},
	clientProfiles: { userId: "clientProfiles.userId" },
	enpProfiles: { userId: "enpProfiles.userId" },
	hypervergeTransactions: { id: "hypervergeTransactions.id", hvTransactionId: "hvTransactionId" },
}))

jest.mock("@/modules/v1/integration/integration.service", () => ({
	__esModule: true,
	IntegrationService: class IntegrationService {},
}))

jest.mock("@/services/hyperverge/hyperverge.client", () => ({
	__esModule: true,
	HypervergeClient: class HypervergeClient {},
}))

jest.mock("@/common/database/database.client", () => ({
	db: {
		select: jest.fn(),
		insert: jest.fn(),
		update: jest.fn(),
		transaction: jest.fn(),
	},
}))

jest.mock("@/modules/v1/auth-profile/lib/expire-enp-identity-if-needed", () => ({
	expireEnpIdentityIfNeeded: jest.fn(async () => {}),
	expireClientIdentityIfNeeded: jest.fn(async () => {}),
	expireIdentityIfGovernmentIdExpired: jest.fn(async () => {}),
}))

describe("OnboardingService", () => {
	const hypervergeClient = {
		startAttempt: jest.fn(),
	}
	const integration = {
		startTraining: jest.fn(),
	}

	let service: OnboardingService
	let mockDb: {
		select: jest.Mock
		insert: jest.Mock
		update: jest.Mock
		transaction: jest.Mock
	}

	beforeEach(() => {
		jest.clearAllMocks()
		mockDb = require("@/common/database/database.client").db
		service = new OnboardingService(hypervergeClient as never, integration as never, {} as never)
	})

	describe("submitStep", () => {
		it("rejects invalid step keys", async () => {
			;(service as any).getProgress = jest.fn(async () => ({
				currentStep: "profile",
				completedSteps: [],
				isComplete: false,
			}))

			await expect(service.submitStep("u1", "not-a-real-step", {})).rejects.toMatchObject({
				code: "BAD_REQUEST",
			})
		})

		it("rejects when submitting a step that is not the current step", async () => {
			;(service as any).getProgress = jest.fn(async () => ({
				currentStep: "client_profile",
				completedSteps: [],
				isComplete: false,
			}))

			await expect(service.submitStep("u1", "profile", {})).rejects.toMatchObject({
				code: "BAD_REQUEST",
			})
		})
	})

	describe("startHypervergeAttempt", () => {
		it("inserts a started hyperverge transaction and returns SDK info", async () => {
			// First two selects: enpProfiles, clientProfiles — treat as “ENP exists”.
			mockDb.select.mockReturnValueOnce({
				from: () => ({
					where: () => ({
						limit: async () => [{ userId: "u1" }],
					}),
				}),
			})
			mockDb.select.mockReturnValueOnce({
				from: () => ({
					where: () => ({
						limit: async () => [undefined],
					}),
				}),
			})

			hypervergeClient.startAttempt.mockResolvedValueOnce({
				transactionId: "tid-1",
				sdkToken: "sdk-token",
				appId: "app-id",
				workflowId: "wf-id",
				sdkVersion: "1.2.3",
			})

			const valuesFn = jest.fn(() => ({}))
			mockDb.insert.mockReturnValueOnce({ values: valuesFn })

			const out = await service.startHypervergeAttempt("u1", "onboarding")

			expect(hypervergeClient.startAttempt).toHaveBeenCalledWith("u1", "onboarding")
			expect(mockDb.insert).toHaveBeenCalledTimes(1)
			expect(valuesFn).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "u1",
					hvTransactionId: "tid-1",
					status: "started",
				})
			)
			expect(out).toEqual({
				transactionId: "tid-1",
				sdkToken: "sdk-token",
				appId: "app-id",
				workflowId: "wf-id",
				sdkVersion: "1.2.3",
			})
		})
	})
})
