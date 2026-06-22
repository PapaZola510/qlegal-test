"use client"

export type NotarizationType =
	| "acknowledgment"
	| "jurat"
	| "oath_affirmation"
	| "copy_certification"
	| "signature_witnessing"

export type SessionMode = "remote" | "in-person" | "hybrid"

export interface NotaryProfile {
	id: string
	firstName: string
	lastName: string
	email: string
	phone: string
	avatarUrl: string | null
	npn: string
	commissionArea: string
	city: string
	province: string
	specializations: NotarizationType[]
	rating: number
	reviewCount: number
	baseFee: number
	availableModes: SessionMode[]
	bio: string
	yearsExperience: number
	isAvailable: boolean
}

export interface AppointmentRequest {
	title: string
	mode: SessionMode | ""
	date: string
	time: string
	purposeNote: string
}

export const NOTARIZATION_TYPES: { value: NotarizationType; label: string }[] = [
	{ value: "acknowledgment", label: "Acknowledgment" },
	{ value: "jurat", label: "Jurat" },
	{ value: "oath_affirmation", label: "Oath / Affirmation" },
	{ value: "copy_certification", label: "Copy Certification" },
	{ value: "signature_witnessing", label: "Signature Witnessing" },
]

export const SESSION_MODES: { value: SessionMode; label: string }[] = [
	{ value: "remote", label: "Remote (Online)" },
	{ value: "in-person", label: "In-Person" },
	{ value: "hybrid", label: "Hybrid" },
]

export const PROVINCES = [
	"Metro Manila",
	"Cebu",
	"Davao del Sur",
	"Pampanga",
	"Bulacan",
	"Laguna",
	"Cavite",
	"Rizal",
	"Batangas",
	"Iloilo",
]

export const FIXTURE_NOTARIES: NotaryProfile[] = [
	{
		id: "notary-001",
		firstName: "Maria",
		lastName: "Cruz",
		email: "maria.cruz@enp.ph",
		phone: "+63 917 123 4567",
		avatarUrl: null,
		npn: "NPN-2024-001234",
		commissionArea: "National Capital Region",
		city: "Makati City",
		province: "Metro Manila",
		specializations: ["acknowledgment", "jurat", "oath_affirmation"],
		rating: 4.8,
		reviewCount: 142,
		baseFee: 500,
		availableModes: ["remote", "in-person"],
		bio: "Licensed ENP with 12 years of experience specializing in corporate document notarization and real estate transactions.",
		yearsExperience: 12,
		isAvailable: true,
	},
	{
		id: "notary-002",
		firstName: "Jose",
		lastName: "Reyes",
		email: "jose.reyes@enp.ph",
		phone: "+63 918 234 5678",
		avatarUrl: null,
		npn: "NPN-2024-002345",
		commissionArea: "Region VII - Central Visayas",
		city: "Cebu City",
		province: "Cebu",
		specializations: ["acknowledgment", "copy_certification", "signature_witnessing"],
		rating: 4.6,
		reviewCount: 89,
		baseFee: 400,
		availableModes: ["remote", "in-person", "hybrid"],
		bio: "Experienced notary public serving Cebu and surrounding areas. Specializes in personal and business document notarization.",
		yearsExperience: 8,
		isAvailable: true,
	},
	{
		id: "notary-003",
		firstName: "Ana",
		lastName: "Santos",
		email: "ana.santos@enp.ph",
		phone: "+63 919 345 6789",
		avatarUrl: null,
		npn: "NPN-2024-003456",
		commissionArea: "Region XI - Davao",
		city: "Davao City",
		province: "Davao del Sur",
		specializations: ["jurat", "oath_affirmation", "signature_witnessing"],
		rating: 4.9,
		reviewCount: 203,
		baseFee: 450,
		availableModes: ["remote"],
		bio: "Top-rated remote notary specializing in affidavits, sworn statements, and government document processing.",
		yearsExperience: 15,
		isAvailable: true,
	},
	{
		id: "notary-004",
		firstName: "Miguel",
		lastName: "Garcia",
		email: "miguel.garcia@enp.ph",
		phone: "+63 920 456 7890",
		avatarUrl: null,
		npn: "NPN-2024-004567",
		commissionArea: "Region III - Central Luzon",
		city: "San Fernando",
		province: "Pampanga",
		specializations: ["acknowledgment", "jurat", "copy_certification"],
		rating: 4.5,
		reviewCount: 67,
		baseFee: 350,
		availableModes: ["in-person", "hybrid"],
		bio: "Community-focused notary providing affordable notarization services across Central Luzon.",
		yearsExperience: 6,
		isAvailable: false,
	},
	{
		id: "notary-005",
		firstName: "Carmen",
		lastName: "Lim",
		email: "carmen.lim@enp.ph",
		phone: "+63 921 567 8901",
		avatarUrl: null,
		npn: "NPN-2024-005678",
		commissionArea: "National Capital Region",
		city: "Quezon City",
		province: "Metro Manila",
		specializations: [
			"acknowledgment",
			"jurat",
			"oath_affirmation",
			"copy_certification",
			"signature_witnessing",
		],
		rating: 4.7,
		reviewCount: 178,
		baseFee: 600,
		availableModes: ["remote", "in-person", "hybrid"],
		bio: "Full-service ENP offering all notarization types. Fluent in English, Filipino, and Mandarin.",
		yearsExperience: 10,
		isAvailable: true,
	},
	{
		id: "notary-006",
		firstName: "Ricardo",
		lastName: "Tan",
		email: "ricardo.tan@enp.ph",
		phone: "+63 922 678 9012",
		avatarUrl: null,
		npn: "NPN-2024-006789",
		commissionArea: "Region IV-A - CALABARZON",
		city: "Calamba",
		province: "Laguna",
		specializations: ["acknowledgment", "jurat"],
		rating: 4.4,
		reviewCount: 45,
		baseFee: 300,
		availableModes: ["in-person"],
		bio: "Notary public serving the Laguna area with focus on property and land title documentation.",
		yearsExperience: 4,
		isAvailable: true,
	},
]

export function filterNotaries(opts: {
	province?: string
	notarizationType?: NotarizationType | ""
	maxFee?: number
}) {
	return FIXTURE_NOTARIES.filter(n => {
		if (opts.province && n.province !== opts.province) return false
		if (opts.notarizationType && !n.specializations.includes(opts.notarizationType)) return false
		if (opts.maxFee !== undefined && n.baseFee > opts.maxFee) return false
		return true
	})
}

export function getNotaryById(id: string): NotaryProfile | undefined {
	return FIXTURE_NOTARIES.find(n => n.id === id)
}

export function createEmptyRequest(): AppointmentRequest {
	return {
		title: "",
		mode: "",
		date: "",
		time: "",
		purposeNote: "",
	}
}
