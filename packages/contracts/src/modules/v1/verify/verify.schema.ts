import { z } from "zod"

import { TimestampFields } from "../shared/schemas.js"

export const VerifyDocumentInputSchema = z
	.object({
		/** Registry document code (e.g. from QR on sealed PDF). */
		code: z.string().min(1).optional(),
		/** Legacy alias for `code` (QR payload). */
		qrCode: z.string().min(1).optional(),
		/** Optional registry act number — used to resolve the notary / user for verification. */
		actNumber: z.string().min(1).optional(),
		/** Optional QuickSign project UUID — used to resolve the notary when verifying by code or file. */
		projectUuid: z.string().min(1).optional(),
	})
	.refine(data => Boolean(data.code?.trim() || data.qrCode?.trim()), {
		message: "Provide a document code from the notarized PDF or QR.",
	})

export const VerifySignerSchema = z.object({
	name: z.string(),
	email: z.string(),
	role: z.string().nullable(),
	status: z.string(),
	signedAt: z.string().nullable(),
})

/** Show Verification metadata (signers, project name, reference, etc.). */
export const VerifyDetailsSchema = z.object({
	documentName: z.string().nullable(),
	verificationDate: z.string().nullable(),
	projectName: z.string().nullable(),
	projectReferenceNumber: z.string().nullable(),
	projectUuid: z.string().nullable(),
	status: z.string().nullable(),
	signers: z.array(VerifySignerSchema),
})

export const VerifyDocumentResultSchema = z.object({
	isValid: z.boolean(),
	/** verification status (`verified`, `not_found`, etc.). */
	verificationStatus: z.string(),
	documentId: z.string().nullable(),
	documentCode: z.string().nullable(),
	actNumber: z.string().nullable(),
	title: z.string().nullable(),
	enpName: z.string().nullable(),
	executedAt: z.string().nullable(),
	verifiedAt: z.string(),
	reason: z.string().nullable(),
	message: z.string().nullable(),
	/** QuickSign project UUID returned by DOC Verify (used for passport / certificate). */
	doconchainProjectUuid: z.string().nullable(),
	/** verification UUID from DOC Verify (`GET /verifications/:uuid`). */
	doconchainVerificationUuid: z.string().nullable(),
	/** Short-lived key to stream Certificate of Completion via GET /verify/document/certificate/:key */
	certificateAccessKey: z.string().nullable(),
	hasCertificateOfCompletion: z.boolean(),
	/** Show Verification metadata (signers, project name, reference, etc.). */
	verificationDetails: VerifyDetailsSchema.nullable(),
	...TimestampFields,
})

export type VerifyDocumentResult = z.infer<typeof VerifyDocumentResultSchema>
