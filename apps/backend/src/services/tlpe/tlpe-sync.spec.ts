import { isTlpePaymentSucceeded, TLPE_STATUS_SUCCEEDED } from "./tlpe-status"
import { syncTlpePayment } from "./tlpe-sync"

const tlpeRequest = jest.fn()

jest.mock("./tlpe.client", () => ({
	tlpeRequest: (...args: unknown[]) => tlpeRequest(...args),
}))

describe("syncTlpePayment", () => {
	beforeEach(() => {
		tlpeRequest.mockReset()
	})

	it("parses nested data.status_code from POST /sync ([docs](https://developers.tlpe.io/post-sync-payment-status/))", async () => {
		tlpeRequest.mockResolvedValue({
			data: {
				transaction_id: "TRX-100",
				status_code: TLPE_STATUS_SUCCEEDED,
				status_description: "Payment successful",
			},
		})

		const result = await syncTlpePayment("TRX-100")
		expect(tlpeRequest).toHaveBeenCalledWith("/sync", {
			method: "POST",
			body: JSON.stringify({ transaction_id: "TRX-100", notify_user: "false" }),
		})
		expect(result.paid).toBe(true)
		expect(result.statusCode).toBe(TLPE_STATUS_SUCCEEDED)
		expect(result.statusMessage).toBe("Payment successful")
	})

	it("parses flat status_code when data wrapper is absent", async () => {
		tlpeRequest.mockResolvedValue({
			transaction_id: "TRX-200",
			status_code: "OK.00.10",
			status_message: "Payment pending",
		})

		const result = await syncTlpePayment("TRX-200")
		expect(result.paid).toBe(false)
		expect(result.statusCode).toBe("OK.00.10")
	})
})

describe("isTlpePaymentSucceeded", () => {
	it("treats OK.00.00 as paid", () => {
		expect(isTlpePaymentSucceeded(TLPE_STATUS_SUCCEEDED)).toBe(true)
		expect(isTlpePaymentSucceeded("OK.00.10")).toBe(false)
		expect(isTlpePaymentSucceeded(null)).toBe(false)
	})
})
