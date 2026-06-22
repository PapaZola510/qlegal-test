/**
 * Copy for ENPs whose identity verification lapsed after the configured validity window
 * (see `UserProfile.identityVerificationValidityDays`).
 */
export function identityExpiryRenewalDescription(validityDays: number): string {
	return `For security and to align with our verification provider's data retention, identity checks are only considered valid for about ${validityDays} days. Your previous verification period has ended, so we need a fresh verification.`
}
