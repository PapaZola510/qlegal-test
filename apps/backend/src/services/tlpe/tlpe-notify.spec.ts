import { signTlpeJwt } from "./tlpe-jwt"
import {
	parseTlpeNotifyBody,
	validateTlpeNotifyAuthorization,
} from "./tlpe-notify"
import { TLPE_STATUS_SUCCEEDED } from "./tlpe-status"

function notifyClaims(data: Record<string, unknown>) {
	return {
		iss: "TLPE",
		sub: "TLPE Notification Authentication",
		aud: "TLPE Notification",
		exp: Math.floor(Date.now() / 1000) + 3600,
		iat: Math.floor(Date.now() / 1000),
		...data,
	}
}

describe("parseTlpeNotifyBody", () => {
	const secret = "test-tlpe-secret"
	const authorization = "integrator-token"

	it("parses flat JWT notify body when payment succeeded", () => {
		const token = signTlpeJwt(
			notifyClaims({
				transaction_id: "intent-abc",
				status_code: TLPE_STATUS_SUCCEEDED,
				reference: "intent-abc",
			}),
			secret
		)
		const parsed = parseTlpeNotifyBody(token, secret, authorization)
		expect(parsed).not.toBeNull()
		expect(parsed?.transactionId).toBe("intent-abc")
		expect(parsed?.referenceNumber).toBe("intent-abc")
		expect(parsed?.paid).toBe(true)
	})

	it("parses nested TLPE notify JWT (official webhook shape)", () => {
		const token = signTlpeJwt(
			notifyClaims({
				data: {
					transaction_id: "TRX-10001",
					payment: { merchant_reference_id: "intent-abc" },
					result: { statusCode: TLPE_STATUS_SUCCEEDED, message: "Payment successful" },
				},
			}),
			secret
		)
		const parsed = parseTlpeNotifyBody(
			JSON.stringify({ payload: token }),
			secret,
			authorization
		)
		expect(parsed?.transactionId).toBe("TRX-10001")
		expect(parsed?.referenceNumber).toBe("intent-abc")
		expect(parsed?.paid).toBe(true)
	})

	it("parses JSON wrapper with payload JWT", () => {
		const token = signTlpeJwt(
			notifyClaims({
				transaction_id: "txn-2",
				status_code: "ERR.01.00",
			}),
			secret
		)
		const parsed = parseTlpeNotifyBody(JSON.stringify({ payload: token }), secret, authorization)
		expect(parsed?.paid).toBe(false)
		expect(parsed?.transactionId).toBe("txn-2")
	})

	it("returns null for expired notify JWT", () => {
		const token = signTlpeJwt(
			notifyClaims({
				exp: Math.floor(Date.now() / 1000) - 120,
				transaction_id: "intent-abc",
				status_code: TLPE_STATUS_SUCCEEDED,
			}),
			secret
		)
		expect(parseTlpeNotifyBody(JSON.stringify({ payload: token }), secret, authorization)).toBeNull()
	})

	it("returns null for invalid token", () => {
		expect(parseTlpeNotifyBody("not-a-jwt", secret, authorization)).toBeNull()
	})
})

describe("validateTlpeNotifyAuthorization", () => {
	it("accepts matching Authorization header", () => {
		expect(
			validateTlpeNotifyAuthorization({ authorization: "integrator-token" }, "integrator-token")
		).toBe(true)
	})

	it("rejects missing or mismatched Authorization header", () => {
		expect(validateTlpeNotifyAuthorization({}, "integrator-token")).toBe(false)
		expect(
			validateTlpeNotifyAuthorization({ authorization: "wrong" }, "integrator-token")
		).toBe(false)
	})
})
