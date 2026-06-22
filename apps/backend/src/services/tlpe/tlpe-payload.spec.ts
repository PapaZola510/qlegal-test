import { resolveTlpeSigningAlgorithm, signTlpeJwt, verifyTlpeJwt } from "./tlpe-jwt"
import {
	buildTlpeCheckoutJwtPayload,
	buildTlpeDirectJwtPayload,
	buildTlpeEasyPaymentLinkBody,
	buildTlpeRouterJwtPayload,
	buildTlpeTransactionPayload,
} from "./tlpe-payload"

const AUTH_TOKEN = "integrator-auth-token"
const HMAC_SECRET = "test-hmac-secret"

const baseInput = {
	amountPhp: 305,
	transactionId: "intent-abc-123",
	description: "Meeting fees · Test session",
	customer: { email: "client@example.com", name: "Jane Client", phone: "09171234567" },
	paymentOptionCode: "option-jwt-token",
	callbackUrl: "https://stg-qlegal.quanbyai.com/appointments",
	notifyUser: false,
}

describe("buildTlpeTransactionPayload", () => {
	it("builds nested data per TLPE API reference (customer, payment, route, time_offset)", () => {
		const { data } = buildTlpeTransactionPayload(baseInput)
		expect(data.customer).toMatchObject({
			first_name: "Jane",
			last_name: "Client",
			contact: { email: "client@example.com", mobile: "+639171234567" },
		})
		expect(data.payment).toEqual({
			description: "Meeting fees · Test session",
			amount: 305,
			currency: "PHP",
			option: "option-jwt-token",
			merchant_reference_id: "intent-abc-123",
		})
		expect(data.route).toEqual({
			callback_url: "https://stg-qlegal.quanbyai.com/appointments",
			notify_user: false,
		})
		expect(data.time_offset).toBe("+08:00")
	})

	it("defaults PH billing when customer address is missing", () => {
		const { data } = buildTlpeTransactionPayload({
			...baseInput,
			customer: { email: "x@y.com", name: "Solo" },
		})
		const billing = (data.customer as Record<string, unknown>).billing_address as Record<
			string,
			string
		>
		expect(billing.country_code).toBe("PH")
		expect(billing.city_municipality).toBe("Manila")
	})
})

describe("TLPE router JWT envelopes", () => {
	it("checkout envelope targets POST /checkout", () => {
		const envelope = buildTlpeCheckoutJwtPayload({ payment: { amount: 100 } })
		expect(envelope.method).toBe("POST")
		expect(envelope.path).toBe("/checkout")
		expect(envelope.data).toEqual({ payment: { amount: 100 } })
		expect(typeof envelope.jti).toBe("string")
		expect(envelope.iss).toBe("TLPE")
	})

	it("direct payment envelope targets POST /payment", () => {
		const envelope = buildTlpeDirectJwtPayload({
			payment: { amount: 100, currency: "PHP" },
			credit_card: { number: "4111111111111111" },
		})
		expect(envelope.method).toBe("POST")
		expect(envelope.path).toBe("/payment")
		expect(envelope.data).toMatchObject({
			payment: { amount: 100, currency: "PHP" },
		})
	})

	it("allows custom router paths for future TLPE endpoints", () => {
		const envelope = buildTlpeRouterJwtPayload("/preauthorization", { payment: { amount: 50 } })
		expect(envelope.path).toBe("/preauthorization")
	})

	it("signs checkout JWT with HS256 on test-api", () => {
		const { data } = buildTlpeTransactionPayload(baseInput)
		const envelope = buildTlpeCheckoutJwtPayload(data)
		const token = signTlpeJwt(envelope, HMAC_SECRET, {
			algorithm: resolveTlpeSigningAlgorithm(HMAC_SECRET, "https://test-api.tlpe.io"),
		})
		const decoded = verifyTlpeJwt<typeof envelope>(token, HMAC_SECRET)
		expect(decoded?.path).toBe("/checkout")
		expect(
			(decoded?.data as { payment: { merchant_reference_id: string } }).payment
				.merchant_reference_id
		).toBe("intent-abc-123")
	})
})

describe("buildTlpeEasyPaymentLinkBody", () => {
	it("builds flat EPL body with key = Authorization ([Easy Payment Link](https://developers.tlpe.io/easy-payment-link/))", () => {
		const body = buildTlpeEasyPaymentLinkBody({ ...baseInput, paymentOptionCode: "" }, AUTH_TOKEN)
		expect(body.key).toBe(AUTH_TOKEN)
		expect(body.customer).toBeDefined()
		expect(body.payment).toMatchObject({
			amount: 305,
			currency: "PHP",
			merchant_reference_id: "intent-abc-123",
		})
		expect(body.route).toMatchObject({
			callback_url: "https://stg-qlegal.quanbyai.com/appointments",
			notify_user: false,
		})
		expect(body).not.toHaveProperty("data")
	})
})
