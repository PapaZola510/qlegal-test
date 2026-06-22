import {
	isTlpeBrandUnavailableOnTestApi,
	tlpeBrandUnavailableMessage,
} from "./tlpe-brand-availability"
import { tlpeTestMode } from "./tlpe.client"

jest.mock("./tlpe.client", () => ({
	tlpeTestMode: jest.fn(),
}))

const testMode = tlpeTestMode as jest.Mock

describe("isTlpeBrandUnavailableOnTestApi", () => {
	beforeEach(() => {
		testMode.mockReturnValue(true)
	})

	it("flags GrabPay on test API", () => {
		expect(isTlpeBrandUnavailableOnTestApi("GrabPay")).toBe(true)
	})

	it("allows Maya on test API", () => {
		expect(isTlpeBrandUnavailableOnTestApi("Maya")).toBe(false)
	})

	it("allows all brands on live API", () => {
		testMode.mockReturnValue(false)
		expect(isTlpeBrandUnavailableOnTestApi("GrabPay")).toBe(false)
	})
})

describe("tlpeBrandUnavailableMessage", () => {
	it("mentions alternatives and AltPayNet", () => {
		const msg = tlpeBrandUnavailableMessage("GrabPay")
		expect(msg).toContain("GrabPay")
		expect(msg).toContain("Maya")
		expect(msg).toContain("AltPayNet")
	})
})
