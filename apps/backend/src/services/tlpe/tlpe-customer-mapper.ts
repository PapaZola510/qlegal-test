export interface TlpeCustomerInput {
	email?: string | null
	name?: string | null
	phone?: string | null
	address?: string | null
	city?: string | null
	province?: string | null
	zipCode?: string | null
}

export interface TlpeCustomerPayload {
	email: string
	firstName: string
	lastName: string
	mobile: string
	billingAddress: string
	billingCity: string
	billingState: string
	billingZip: string
	billingCountry: string
}

const DEFAULT_PH = {
	billingAddress: "Philippines",
	billingCity: "Manila",
	billingState: "NCR",
	billingZip: "1000",
	billingCountry: "PH",
	mobile: "09000000000",
}

function splitName(full: string): { firstName: string; lastName: string } {
	const trimmed = full.trim()
	if (!trimmed) return { firstName: "Client", lastName: "User" }
	const parts = trimmed.split(/\s+/)
	if (parts.length === 1) return { firstName: parts[0]!, lastName: "." }
	const lastName = parts.pop()!
	return { firstName: parts.join(" "), lastName }
}

export function mapToTlpeCustomer(input: TlpeCustomerInput): TlpeCustomerPayload {
	const email =
		typeof input.email === "string" && input.email.includes("@")
			? input.email.trim()
			: "client@qlegal.local"
	const { firstName, lastName } = splitName(input.name ?? "Client User")
	return {
		email,
		firstName,
		lastName,
		mobile:
			typeof input.phone === "string" && input.phone.trim().length >= 10
				? input.phone.trim()
				: DEFAULT_PH.mobile,
		billingAddress:
			typeof input.address === "string" && input.address.trim().length > 0
				? input.address.trim()
				: DEFAULT_PH.billingAddress,
		billingCity:
			typeof input.city === "string" && input.city.trim().length > 0
				? input.city.trim()
				: DEFAULT_PH.billingCity,
		billingState:
			typeof input.province === "string" && input.province.trim().length > 0
				? input.province.trim()
				: DEFAULT_PH.billingState,
		billingZip:
			typeof input.zipCode === "string" && input.zipCode.trim().length > 0
				? input.zipCode.trim()
				: DEFAULT_PH.billingZip,
		billingCountry: DEFAULT_PH.billingCountry,
	}
}
