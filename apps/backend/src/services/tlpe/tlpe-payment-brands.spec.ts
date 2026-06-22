import { fetchTlpePaymentOptions } from "./tlpe-options"
import {
	inferBrandCheckoutProcess,
	listTlpePaymentBrands,
	mapTlpeOptionToBrand,
	resolveTlpeIntegrationProcess,
} from "./tlpe-payment-brands"
import { tlpePaymentLinkConfigured, tlpeTestMode } from "./tlpe.client"

jest.mock("./tlpe.client", () => ({
	tlpePaymentLinkConfigured: jest.fn(() => true),
	tlpeTestMode: jest.fn(() => false),
}))

jest.mock("./tlpe-options", () => ({
	fetchTlpePaymentOptions: jest.fn(),
}))

const fetchOptions = fetchTlpePaymentOptions as jest.Mock
const paymentLinkConfigured = tlpePaymentLinkConfigured as jest.Mock
const testMode = tlpeTestMode as jest.Mock

const sampleOptions = [
	{ code: "opt-visa", value: "Visa", image: "https://example.com/visa.png" },
	{ code: "opt-gcash", value: "GCash" },
	{ code: "opt-qrph", value: "QR Ph" },
	{ code: "opt-maya", value: "Maya" },
	{ code: "opt-grab", value: "GrabPay" },
]

describe("inferBrandCheckoutProcess", () => {
	it("maps card brands to card_checkout", () => {
		expect(inferBrandCheckoutProcess("Visa")).toBe("card_checkout")
		expect(inferBrandCheckoutProcess("MasterCard")).toBe("card_checkout")
	})

	it("maps e-wallets to ewallet_redirect", () => {
		expect(inferBrandCheckoutProcess("GCash")).toBe("ewallet_redirect")
		expect(inferBrandCheckoutProcess("Maya")).toBe("ewallet_redirect")
		expect(inferBrandCheckoutProcess("GrabPay")).toBe("ewallet_redirect")
	})

	it("maps QR Ph to tlpe_hosted_checkout", () => {
		expect(inferBrandCheckoutProcess("QR Ph")).toBe("tlpe_hosted_checkout")
	})
})

describe("mapTlpeOptionToBrand", () => {
	it("includes process summary and client steps for checkout integration", () => {
		const brand = mapTlpeOptionToBrand(sampleOptions[2]!, "checkout")
		expect(brand.code).toBe("opt-qrph")
		expect(brand.label).toBe("QR Ph")
		expect(brand.checkoutProcess).toBe("tlpe_hosted_checkout")
		expect(brand.processSummary).toContain("QR Ph")
		expect(brand.clientSteps.length).toBeGreaterThan(0)
	})

	it("uses easy_payment_link_selector when EPL is configured", () => {
		const brand = mapTlpeOptionToBrand(sampleOptions[1]!, "easy_payment_link")
		expect(brand.checkoutProcess).toBe("easy_payment_link_selector")
		expect(brand.processSummary).toContain("AltPayNet payment page")
	})
})

describe("listTlpePaymentBrands", () => {
	beforeEach(() => {
		fetchOptions.mockReset()
		paymentLinkConfigured.mockReturnValue(true)
		testMode.mockReturnValue(false)
	})

	it("returns brands from GET /options with Easy Payment Link integration", async () => {
		fetchOptions.mockResolvedValue(sampleOptions)

		const result = await listTlpePaymentBrands()

		expect(fetchOptions).toHaveBeenCalled()
		expect(result.integrationProcess).toBe("easy_payment_link")
		expect(result.brands).toHaveLength(5)
		expect(result.brands.map(b => b.label)).toEqual(["Visa", "GCash", "QR Ph", "Maya", "GrabPay"])
		expect(result.brands.every(b => b.checkoutProcess === "easy_payment_link_selector")).toBe(true)
	})

	it("hides GrabPay on TLPE test API where hosted payment may fail", async () => {
		testMode.mockReturnValue(true)
		fetchOptions.mockResolvedValue(sampleOptions)

		const result = await listTlpePaymentBrands()

		expect(result.brands.map(b => b.label)).not.toContain("GrabPay")
		expect(result.brands).toHaveLength(4)
	})

	it("requires TLPE_PAYMENT_LINK_URL for integration process", () => {
		paymentLinkConfigured.mockReturnValue(false)
		expect(() => resolveTlpeIntegrationProcess()).toThrow(/TLPE_PAYMENT_LINK_URL/)
		paymentLinkConfigured.mockReturnValue(true)
		expect(resolveTlpeIntegrationProcess()).toBe("easy_payment_link")
	})
})
