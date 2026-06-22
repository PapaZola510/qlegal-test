/**
 * TLPE integration coverage — Easy Payment Link (dynamic), Direct Payment helpers.
 * Docs: https://developers.tlpe.io/
 */
import { createEasyPaymentLink } from "./tlpe-easy-payment-link"
import { buildTlpeDirectJwtPayload } from "./tlpe-payload"
import { TlpeService } from "./tlpe.service"

const tlpeRequest = jest.fn()
const fetchMock = jest.fn()

jest.mock("./tlpe.client", () => ({
	tlpeApiBaseUrl: () => "https://test-api.tlpe.io",
	tlpeSecret: () => "test-hmac-secret",
	tlpeRequest: (...args: unknown[]) => tlpeRequest(...args),
	tlpeAuthorizationHeader: () => "auth-token",
	tlpePaymentLinkUrl: () => "https://test-pay.tlpe.io/link/merchant-1",
	tlpeConfigured: () => true,
	tlpeTestMode: () => true,
	tlpeDevTestSimulateEnabled: () => true,
	tlpePaymentLinkConfigured: jest.fn(() => true),
}))

jest.mock("@/config/env.config", () => ({
	env: {
		TLPE_CALLBACK_URL: "https://example.com/appointments",
		TLPE_PAYMENT_OPTION_CODE: "",
		TLPE_PAYMENT_LINK_URL: "https://test-pay.tlpe.io/link/merchant-1",
	},
}))

global.fetch = fetchMock as unknown as typeof fetch

const { tlpePaymentLinkConfigured } = jest.requireMock("./tlpe.client") as {
	tlpePaymentLinkConfigured: jest.Mock
}

const paymentInput = {
	amountPhp: 305,
	transactionId: "intent-test-1",
	description: "Meeting fees",
	customer: { email: "pay@example.com", name: "Pay Client" },
}

describe("Direct Payment Integration", () => {
	it("builds POST /payment JWT envelope for server-to-server flow", () => {
		const envelope = buildTlpeDirectJwtPayload({
			customer: { first_name: "Jane", last_name: "Doe" },
			payment: {
				amount: 100,
				currency: "PHP",
				option: "opt-visa",
				merchant_reference_id: "INV-1",
			},
			credit_card: {
				card_holder_name: "Jane Doe",
				number: "4111111111111111",
				expiration_month: "12",
				expiration_year: "30",
				cvv: "123",
			},
			route: { callback_url: "https://example.com/cb", notify_user: false },
			time_offset: "+08:00",
		})

		expect(envelope.path).toBe("/payment")
		expect(envelope.method).toBe("POST")
	})

	it("documents that qLegal uses Easy Payment Link, not Direct Payment", () => {
		expect(buildTlpeDirectJwtPayload({}).path).toBe("/payment")
	})
})

describe("Easy Payment Link Integration", () => {
	beforeEach(() => {
		fetchMock.mockReset()
	})

	it("POST payment link URL with flat body and key (no Authorization header)", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({ link: "https://test-pay.tlpe.io/pay/session-abc" }),
		})

		const result = await createEasyPaymentLink({
			...paymentInput,
			convenienceFixedFeePhp: 20,
		})

		expect(fetchMock).toHaveBeenCalledWith(
			"https://test-pay.tlpe.io/link/merchant-1",
			expect.objectContaining({
				method: "POST",
				headers: { "Content-Type": "application/json" },
			})
		)

		const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as Record<string, unknown>
		expect(body.key).toBe("auth-token")
		expect(body).toHaveProperty("customer")
		expect(body).toHaveProperty("payment")
		expect((body.payment as Record<string, unknown>).convenienceFixedFee).toBe("20")
		expect(body).not.toHaveProperty("payload")
		expect(fetchMock.mock.calls[0]![1].headers).not.toHaveProperty("Authorization")

		expect(result.link).toBe("https://test-pay.tlpe.io/pay/session-abc")
	})

	it("throws when EPL response omits link", async () => {
		fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
		await expect(createEasyPaymentLink(paymentInput)).rejects.toThrow(/missing link/)
	})
})

describe("TlpeService integration routing", () => {
	const service = new TlpeService()

	beforeEach(() => {
		tlpeRequest.mockReset()
		fetchMock.mockReset()
		tlpePaymentLinkConfigured.mockReset()
	})

	it("uses Easy Payment Link when TLPE_PAYMENT_LINK_URL is configured", async () => {
		tlpePaymentLinkConfigured.mockReturnValue(true)
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({ link: "https://test-pay.tlpe.io/pay/epl-1" }),
		})

		const result = await service.createEasyPaymentLink(paymentInput)
		expect(fetchMock).toHaveBeenCalled()
		expect(tlpeRequest).not.toHaveBeenCalled()
		expect(result.link).toBe("https://test-pay.tlpe.io/pay/epl-1")
	})

	it("throws when TLPE_PAYMENT_LINK_URL is unset", async () => {
		tlpePaymentLinkConfigured.mockReturnValue(false)

		await expect(service.createEasyPaymentLink(paymentInput)).rejects.toThrow(
			/TLPE_PAYMENT_LINK_URL is not configured/
		)
		expect(tlpeRequest).not.toHaveBeenCalled()
		expect(fetchMock).not.toHaveBeenCalled()
	})
})
