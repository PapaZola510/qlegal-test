import {
	extractExpiryDateFromLogs,
	extractExpiryDateFromOcr,
	findExpiryDateInNode,
	normalizeExpiryToYmd,
	pickOcrFieldsFromLogs,
} from "./hyperverge-kyc-ocr"

describe("hyperverge-kyc-ocr", () => {
	describe("normalizeExpiryToYmd", () => {
		it("accepts ISO YYYY-MM-DD", () => {
			expect(normalizeExpiryToYmd("2030-05-15")).toBe("2030-05-15")
			expect(normalizeExpiryToYmd("2030-05-15T00:00:00Z")).toBe("2030-05-15")
		})

		it("parses DD/MM/YYYY when day > 12", () => {
			expect(normalizeExpiryToYmd("25/12/2030")).toBe("2030-12-25")
		})

		it("parses ambiguous slash dates with month-first when second part > 12", () => {
			expect(normalizeExpiryToYmd("05/25/2030")).toBe("2030-05-25")
		})

		it("rejects invalid values", () => {
			expect(normalizeExpiryToYmd("")).toBeNull()
			expect(normalizeExpiryToYmd("not-a-date")).toBeNull()
			expect(normalizeExpiryToYmd("32/13/2030")).toBeNull()
		})
	})

	describe("extractExpiryDateFromOcr", () => {
		it("reads common expiry field aliases", () => {
			expect(extractExpiryDateFromOcr({ expiryDate: "2031-01-20" })).toBe("2031-01-20")
			expect(extractExpiryDateFromOcr({ date_of_expiry: "15/06/2029" })).toBe("2029-06-15")
			expect(extractExpiryDateFromOcr({ validUntil: { value: "2030-12-31" } })).toBe("2030-12-31")
		})

		it("returns null when no expiry field", () => {
			expect(extractExpiryDateFromOcr({ firstName: "Jane" })).toBeNull()
		})
	})

	describe("findExpiryDateInNode", () => {
		it("reads expiry from key-value detail arrays", () => {
			expect(
				findExpiryDateInNode([
					{ fieldName: "first_name", value: "Jane" },
					{ name: "date_of_expiry", value: "2030-08-09" },
				])
			).toBe("2030-08-09")
		})
	})

	describe("extractExpiryDateFromLogs", () => {
		it("deep-scans logs when fields are outside fieldsExtracted", () => {
			const logs = {
				status: "success",
				result: {
					userDetails: { valid_until: "2031-11-20" },
				},
			}
			expect(extractExpiryDateFromLogs(logs)).toBe("2031-11-20")
		})
	})

	describe("pickOcrFieldsFromLogs", () => {
		it("extracts fieldsExtracted from id module results", () => {
			const logs = {
				status: "success",
				result: {
					results: [
						{
							module: "id_validation",
							fieldsExtracted: {
								expiryDate: "2032-03-01",
								fullName: "DOE, JANE",
							},
						},
					],
				},
			}
			const ocr = pickOcrFieldsFromLogs(logs)
			expect(ocr).toEqual({
				expiryDate: "2032-03-01",
				fullName: "DOE, JANE",
			})
			expect(extractExpiryDateFromOcr(ocr!)).toBe("2032-03-01")
		})
	})
})
