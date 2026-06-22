import { resolveTlpeSigningAlgorithm, signTlpeJwt, verifyTlpeJwt } from "./tlpe-jwt"

const RSA_PUBLIC =
	"MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAIRHI2ZSIieqxavc7DY1M0F55XrDI1mxUpCQfXezD59cobeB501MBNo9bGWe6p7toCeXdhBG7qynhVw94VuIyH0CAwEAAQ=="
const RSA_PRIVATE =
	"MIIBVAIBADANBgkqhkiG9w0BAQEFAASCAT4wggE6AgEAAkEAhEcjZlIiJ6rFq9zsNjUzQXnlesMjWbFSkJB9d7MPn1yht4HnTUwE2j1sZZ7qnu2gJ5d2EEburKeFXD3hW4jIfQIDAQABAkAg2dn8y2EYIN0+tXska0nzdOZ8+oGJAPTUWk4OsDWtCeHk++1+PYkazukp+BL1SNE6jcLeWJbXcVWSkfDANccxAiEA7btwnGO58TTSBVarkjah3TijhE9NEjIwXc0D/itO1ZcCIQCOcT+/ZXcIoXSmxvTnVAp6t5qVRHnv2wlqUEGS4BidCwIgJSYSLc4Do2aOnxjxDJMO7iPIoYdG0t4W4sGDqzcXRZcCIQCJchG3F6sictjizPwn81ohS+Unv2mB3nNZWJPNq9tUPQIgHgK5/9A7+pR85HoO3cCWDW43CUj9cPZMpHjBc5iO1o0="

describe("tlpe-jwt", () => {
	it("uses HS256 for plain string secrets", () => {
		expect(resolveTlpeSigningAlgorithm("plain-hmac-secret")).toBe("HS256")
		const token = signTlpeJwt({ foo: "bar" }, "plain-hmac-secret")
		const decoded = verifyTlpeJwt<{ foo: string }>(token, "plain-hmac-secret")
		expect(decoded?.foo).toBe("bar")
	})

	it("uses RS256 for PKCS#8 RSA secrets on live API and verifies with authorization public key", () => {
		expect(resolveTlpeSigningAlgorithm(RSA_PRIVATE, "https://api.tlpe.io")).toBe("RS256")
		const token = signTlpeJwt({ data: { payment: { amount: "100" } } }, RSA_PRIVATE, {
			algorithm: "RS256",
		})
		const decoded = verifyTlpeJwt<{ data: { payment: { amount: string } } }>(
			token,
			RSA_PRIVATE,
			RSA_PUBLIC
		)
		expect(decoded?.data.payment.amount).toBe("100")
	})

	it("uses HS256 on test-api even when secret is RSA-shaped", () => {
		expect(resolveTlpeSigningAlgorithm(RSA_PRIVATE, "https://test-api.tlpe.io")).toBe("HS256")
	})
})
