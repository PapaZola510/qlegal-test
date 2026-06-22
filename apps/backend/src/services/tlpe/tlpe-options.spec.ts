import { pickTlpePaymentOption, type TlpePaymentOption } from "./tlpe-options"

jest.mock("@/config/env.config", () => ({
	env: { TLPE_PAYMENT_OPTION_CODE: "" },
}))

const options: TlpePaymentOption[] = [
	{ code: "opt-visa", value: "Visa", image: "https://example.com/visa.png" },
	{ code: "opt-gcash", value: "GCash" },
	{ code: "opt-qrph", value: "QR Ph" },
	{ code: "opt-maya", value: "Maya" },
]

describe("pickTlpePaymentOption", () => {
	it("prefers explicit payment option code from env", () => {
		expect(pickTlpePaymentOption(options, "opt-visa")).toEqual(options[0])
	})

	it("matches explicit code by brand label (case-insensitive)", () => {
		expect(pickTlpePaymentOption(options, "qr ph")).toEqual(options[2])
		expect(pickTlpePaymentOption(options, "MAYA")).toEqual(options[3])
	})

	it("prefers QR Ph / QRPH-style brands for meeting session payments", () => {
		expect(pickTlpePaymentOption(options)?.value).toBe("QR Ph")
	})

	it("does not fall back to QR Ph when an explicit brand cannot be resolved", () => {
		expect(pickTlpePaymentOption(options, "expired-jwt-token")).toBeNull()
	})

	it("falls back to the first option when QR Ph is unavailable", () => {
		const withoutQr = options.filter(o => o.value !== "QR Ph")
		expect(pickTlpePaymentOption(withoutQr)?.value).toBe("Visa")
	})

	it("returns null when no options are available", () => {
		expect(pickTlpePaymentOption([])).toBeNull()
	})
})
