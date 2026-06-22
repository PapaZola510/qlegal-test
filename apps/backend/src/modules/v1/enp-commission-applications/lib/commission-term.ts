export function computeCommissionTermEnd(commissionDate: Date): Date {
	const year = commissionDate.getUTCFullYear()
	return new Date(Date.UTC(year + 1, 11, 31, 23, 59, 59, 999))
}
