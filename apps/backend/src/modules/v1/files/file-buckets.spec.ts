import { BadRequestException, PayloadTooLargeException } from "@nestjs/common"

import {
	assertFileSizeForBucket,
	assertMimeAllowedForBucket,
	assertPurposeForBucket,
} from "./file-buckets"

describe("file-buckets", () => {
	it("assertPurposeForBucket rejects mismatched purpose", () => {
		expect(() => assertPurposeForBucket("qlegal-kyc", "session_recording")).toThrow(
			BadRequestException
		)
	})

	it("assertMimeAllowedForBucket allows pdf on kyc", () => {
		expect(() => assertMimeAllowedForBucket("qlegal-kyc", "application/pdf")).not.toThrow()
	})

	it("assertFileSizeForBucket rejects oversize for kyc", () => {
		expect(() => assertFileSizeForBucket("qlegal-kyc", 11 * 1024 * 1024)).toThrow(
			PayloadTooLargeException
		)
	})
})
