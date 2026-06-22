import { getApiUrl } from "@/core/lib/utils"

export interface VerifyDoconchainSigner {
	name: string
	email: string
	role: string | null
	status: string
	signedAt: string | null
}

export interface VerifyDoconchainDetails {
	documentName: string | null
	verificationDate: string | null
	projectName: string | null
	projectReferenceNumber: string | null
	projectUuid: string | null
	doconchainStatus: string | null
	signers: VerifyDoconchainSigner[]
}

export interface VerifyDocumentResponse {
	isValid: boolean
	verificationStatus: string
	documentId: string | null
	documentCode: string | null
	actNumber: string | null
	title: string | null
	enpName: string | null
	executedAt: string | null
	verifiedAt: string
	reason: string | null
	message: string | null
	doconchainProjectUuid: string | null
	doconchainVerificationUuid: string | null
	certificateAccessKey: string | null
	hasCertificateOfCompletion: boolean
	doconchainDetails: VerifyDoconchainDetails | null
}

/** Stream DocOnChain Certificate of Completion PDF (15-minute access key from verify response). */
export function getCertificateOfCompletionUrl(
	accessKey: string,
	opts?: { download?: boolean }
): string {
	const base = getApiUrl()
	const key = encodeURIComponent(accessKey.trim())
	const download = opts?.download ? "?download=1" : ""
	return `${base}/verify/document/certificate/${key}${download}`
}

export async function verifyDocumentByCode(input: {
	code: string
	actNumber?: string
	projectUuid?: string
}): Promise<VerifyDocumentResponse> {
	const base = getApiUrl()
	const res = await fetch(`${base}/verify/document`, {
		method: "POST",
		headers: { "Content-Type": "application/json", "Accept": "application/json" },
		body: JSON.stringify({
			code: input.code.trim(),
			actNumber: input.actNumber?.trim() || undefined,
			projectUuid: input.projectUuid?.trim() || undefined,
		}),
	})
	const json = (await res.json().catch(() => ({}))) as VerifyDocumentResponse
	if (!res.ok) {
		const err =
			json.reason ||
			json.message ||
			(typeof json === "object" &&
			json &&
			"error" in json &&
			typeof (json as { error?: { message?: string } }).error?.message === "string"
				? (json as { error: { message: string } }).error.message
				: `Verification failed (${res.status})`)
		throw new Error(err)
	}
	return json
}

export async function verifyDocumentByUpload(input: {
	file: File
	code?: string
	actNumber?: string
	projectUuid?: string
}): Promise<VerifyDocumentResponse> {
	const base = getApiUrl()
	const form = new FormData()
	form.append("file", input.file)
	if (input.code?.trim()) form.append("code", input.code.trim())
	if (input.actNumber?.trim()) form.append("act_number", input.actNumber.trim())
	if (input.projectUuid?.trim()) form.append("project_uuid", input.projectUuid.trim())

	const res = await fetch(`${base}/verify/document/upload`, {
		method: "POST",
		body: form,
	})
	const json = (await res.json().catch(() => ({}))) as VerifyDocumentResponse & {
		message?: string
	}
	if (!res.ok) {
		const err =
			typeof json === "object" && json && "message" in json && typeof json.message === "string"
				? json.message
				: `Verification failed (${res.status})`
		throw new Error(err)
	}
	return json
}
