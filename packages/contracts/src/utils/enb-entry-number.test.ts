import { describe, expect, it } from "vitest"

import {
	formatEnbEntryNumber,
	parseDocumentNoFromActNumber,
	resolveNotarialBookFooterFields,
} from "./enb-entry-number.js"

describe("formatEnbEntryNumber", () => {
	it("formats ACT-YYYY-NNN with page and date", () => {
		expect(
			formatEnbEntryNumber({
				actNumber: "ACT-2026-003",
				pageNo: "3",
				executedAt: "2026-04-06T08:00:00.000Z",
			})
		).toBe("3-003-04-2026")
	})

	it("returns canonical value when actNumber is already SC format", () => {
		expect(
			formatEnbEntryNumber({
				actNumber: "5-010-12-2025",
				pageNo: "99",
				executedAt: "2026-01-01T00:00:00.000Z",
			})
		).toBe("5-010-12-2025")
	})

	it("accepts executedAt as a Date instance", () => {
		expect(
			formatEnbEntryNumber({
				actNumber: "ACT-2026-007",
				pageNo: "7",
				executedAt: new Date("2026-07-15T12:00:00.000Z"),
			})
		).toBe("7-007-07-2026")
	})

	it("returns em dash when date is invalid and act number is empty", () => {
		expect(
			formatEnbEntryNumber({
				actNumber: "  ",
				pageNo: "1",
				executedAt: "not-a-date",
			})
		).toBe("—")
	})

	it("defaults page number when pageNo is missing", () => {
		expect(
			formatEnbEntryNumber({
				actNumber: "ACT-2026-002",
				pageNo: null,
				executedAt: "2026-03-01T00:00:00.000Z",
			})
		).toBe("2-001-03-2026")
	})

	it("uses monthly book page as document and page numbers (e.g. 106th July entry)", () => {
		expect(
			formatEnbEntryNumber({
				actNumber: "ACT-2026-003",
				pageNo: "106",
				executedAt: "2026-07-15T12:00:00.000Z",
			})
		).toBe("106-106-07-2026")
	})
})

describe("resolveNotarialBookFooterFields", () => {
	it("maps July book 7 with 106th chronological entry", () => {
		expect(
			resolveNotarialBookFooterFields({
				bookNo: "7",
				pageNo: "106",
				executedAt: "2026-07-15T12:00:00.000Z",
				entryNumber: "106-106-07-2026",
			})
		).toEqual({
			docNo: "106",
			pageNo: "106",
			bookNo: "7",
			seriesYear: "2026",
		})
	})

	it("returns null when book or page is missing", () => {
		expect(
			resolveNotarialBookFooterFields({
				bookNo: null,
				pageNo: "3",
				executedAt: "2026-04-01T00:00:00.000Z",
			})
		).toBeNull()
	})
})

describe("parseDocumentNoFromActNumber", () => {
	it("parses trailing sequence from ACT number", () => {
		expect(parseDocumentNoFromActNumber("ACT-2026-012")).toBe("12")
	})

	it("falls back to trimmed act number when trailing segment is not numeric", () => {
		expect(parseDocumentNoFromActNumber("ACT-2026-XYZ")).toBe("ACT-2026-XYZ")
	})

	it('returns "1" when act number is blank after trim', () => {
		expect(parseDocumentNoFromActNumber("   ")).toBe("1")
	})
})
