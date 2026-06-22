export type CertificateStatus = "valid" | "invalid" | "not_found"

export interface CertificateData {
	id: string
	holderName: string
	issuedDate: string
	expiryDate: string
	certificateType: string
	status: CertificateStatus
}

export const VALID_CERTIFICATE_IDS = ["CERT-2024-001", "CERT-2024-002", "cert-2024-001"]

export function lookupCertificate(id: string): CertificateData | null {
	const normalised = id.trim().toUpperCase()

	if (normalised === "CERT-2024-001") {
		return {
			id: "CERT-2024-001",
			holderName: "Maria Santos Cruz",
			issuedDate: "2024-12-15",
			expiryDate: "2026-12-15",
			certificateType: "Electronic Notary Public Certification",
			status: "valid",
		}
	}

	if (normalised === "CERT-2024-002") {
		return {
			id: "CERT-2024-002",
			holderName: "Juan Pedro Reyes",
			issuedDate: "2023-06-01",
			expiryDate: "2025-06-01",
			certificateType: "Electronic Notary Public Certification",
			status: "invalid",
		}
	}

	return null
}
