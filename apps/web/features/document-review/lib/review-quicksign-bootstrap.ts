import type {
	ApproveDocumentReviewQuicksignBootstrap,
	DocumentReviewQuicksignQueue,
} from "@repo/contracts"

import type { NotarizationType, SignerPayload } from "@/features/quicksign/lib/fixtures"

const STORAGE_KEY = "qlegal-review-quicksign-bootstrap"

export type ReviewQuicksignBootstrap = ApproveDocumentReviewQuicksignBootstrap & {
	fromReview: true
}

export function saveReviewQuicksignBootstrap(payload: ReviewQuicksignBootstrap): void {
	if (typeof window === "undefined") return
	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
	} catch {
		/* quota */
	}
}

export function loadReviewQuicksignBootstrap(): ReviewQuicksignBootstrap | null {
	if (typeof window === "undefined") return null
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw) as ReviewQuicksignBootstrap
		if (!parsed?.quicksignProjectId || !parsed.queue?.reviewRequestId) return null
		return parsed
	} catch {
		return null
	}
}

export function clearReviewQuicksignBootstrap(): void {
	if (typeof window === "undefined") return
	try {
		sessionStorage.removeItem(STORAGE_KEY)
	} catch {
		/* ignore */
	}
}

export function signerFromReviewBootstrap(bootstrap: ReviewQuicksignBootstrap): SignerPayload {
	return {
		email: bootstrap.clientEmail,
		firstName: bootstrap.clientFirstName,
		lastName: bootstrap.clientLastName,
	}
}

export function notarizationFromReviewBootstrap(
	bootstrap: ReviewQuicksignBootstrap
): NotarizationType {
	return bootstrap.notarizationType
}

export function updateReviewQuicksignBootstrapQueue(
	queue: DocumentReviewQuicksignQueue,
	bootstrap: ReviewQuicksignBootstrap
): ReviewQuicksignBootstrap {
	return { ...bootstrap, queue }
}
