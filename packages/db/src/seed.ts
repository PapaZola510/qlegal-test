/* eslint-disable no-console */
import "dotenv/config"

import { hashPassword } from "better-auth/crypto"
import { inArray, or } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import {
	accounts,
	clientProfiles,
	enpProfiles,
	schema,
	subOrgs,
	tickets,
	todos,
	users,
} from "./schema.js"

const ADMIN_USER_ID = "seed-user-admin"
const ADMIN_ACCOUNT_ID = "seed-account-admin-credential"
const ADMIN_NAME = "Electronic Notary Administrator"
const ADMIN_EMAIL = "admin@qlegal.local"
const ADMIN_PASSWORD = "admin12345"

const PRINCIPAL_ONE_USER_ID = "seed-user-principal-one"
const PRINCIPAL_ONE_ACCOUNT_ID = "seed-account-principal-one-credential"
const PRINCIPAL_ONE_SUB_ORG_ID = "seed-sub-org-principal-one"
const PRINCIPAL_ONE_NAME = "Maria Santos"
const PRINCIPAL_ONE_EMAIL = "principal1@qlegal.local"

const PRINCIPAL_TWO_USER_ID = "seed-user-principal-two"
const PRINCIPAL_TWO_ACCOUNT_ID = "seed-account-principal-two-credential"
const PRINCIPAL_TWO_SUB_ORG_ID = "seed-sub-org-principal-two"
const PRINCIPAL_TWO_NAME = "Juan Dela Cruz"
const PRINCIPAL_TWO_EMAIL = "principal2@qlegal.local"
const PRINCIPAL_PASSWORD = "principal12345"

const ENP_USER_ID = "seed-user-enp-lawyer"
const ENP_ACCOUNT_ID = "seed-account-enp-lawyer-credential"
const ENP_SUB_ORG_ID = "seed-sub-org-enp-lawyer"
const ENP_NAME = "Atty. Elena Reyes"
const ENP_EMAIL = "lawyer@qlegal.local"
const ENP_PASSWORD = "lawyer12345"

/** DocOnChain seal display string — matches `enp_profiles.ibp_date` text column. */
function formatIbpDateDisplay(date: Date): string {
	const label = date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	})
	return `${label} (for ${date.getFullYear() + 1})`
}

async function seedDatabase() {
	const connectionString = process.env.DATABASE_URL

	if (!connectionString) {
		throw new Error("DATABASE_URL environment variable is not set")
	}

	const pool = new Pool({ connectionString })
	const db = drizzle({ client: pool, schema })
	const now = new Date()
	const commissionValidUntil = new Date(now)
	commissionValidUntil.setFullYear(commissionValidUntil.getFullYear() + 1)

	const seedUsers: Array<typeof users.$inferInsert> = [
		{
			id: ADMIN_USER_ID,
			name: ADMIN_NAME,
			email: ADMIN_EMAIL,
			emailVerified: true,
			image: null,
			platformRole: "admin",
			deletedAt: null,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: PRINCIPAL_ONE_USER_ID,
			name: PRINCIPAL_ONE_NAME,
			email: PRINCIPAL_ONE_EMAIL,
			emailVerified: true,
			image: null,
			platformRole: "none",
			deletedAt: null,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: PRINCIPAL_TWO_USER_ID,
			name: PRINCIPAL_TWO_NAME,
			email: PRINCIPAL_TWO_EMAIL,
			emailVerified: true,
			image: null,
			platformRole: "none",
			deletedAt: null,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: ENP_USER_ID,
			name: ENP_NAME,
			email: ENP_EMAIL,
			emailVerified: true,
			image: null,
			platformRole: "none",
			deletedAt: null,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: "seed-user-alex",
			name: "Alex Johnson",
			email: "alex@turbo-template.local",
			emailVerified: true,
			image: null,
			platformRole: "none",
			deletedAt: null,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: "seed-user-sam",
			name: "Sam Rivera",
			email: "sam@turbo-template.local",
			emailVerified: true,
			image: null,
			platformRole: "none",
			deletedAt: null,
			createdAt: now,
			updatedAt: now,
		},
	]

	const seedCredentialInputs = [
		{ id: ADMIN_ACCOUNT_ID, userId: ADMIN_USER_ID, password: ADMIN_PASSWORD },
		{ id: PRINCIPAL_ONE_ACCOUNT_ID, userId: PRINCIPAL_ONE_USER_ID, password: PRINCIPAL_PASSWORD },
		{ id: PRINCIPAL_TWO_ACCOUNT_ID, userId: PRINCIPAL_TWO_USER_ID, password: PRINCIPAL_PASSWORD },
		{ id: ENP_ACCOUNT_ID, userId: ENP_USER_ID, password: ENP_PASSWORD },
	] as const

	const seedAccounts: Array<typeof accounts.$inferInsert> = await Promise.all(
		seedCredentialInputs.map(async credential => ({
			id: credential.id,
			accountId: credential.userId,
			providerId: "credential" as const,
			userId: credential.userId,
			password: await hashPassword(credential.password),
			createdAt: now,
			updatedAt: now,
		}))
	)

	const seedSubOrgs: Array<typeof subOrgs.$inferInsert> = [
		{
			id: PRINCIPAL_ONE_SUB_ORG_ID,
			ownerId: PRINCIPAL_ONE_USER_ID,
			name: `${PRINCIPAL_ONE_NAME} Personal Workspace`,
			kind: "personal",
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
		},
		{
			id: PRINCIPAL_TWO_SUB_ORG_ID,
			ownerId: PRINCIPAL_TWO_USER_ID,
			name: `${PRINCIPAL_TWO_NAME} Personal Workspace`,
			kind: "personal",
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
		},
		{
			id: ENP_SUB_ORG_ID,
			ownerId: ENP_USER_ID,
			name: "Reyes Notarial Office",
			kind: "firm",
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
		},
	]

	const seedClientProfiles: Array<typeof clientProfiles.$inferInsert> = [
		{
			userId: PRINCIPAL_ONE_USER_ID,
			subOrgId: PRINCIPAL_ONE_SUB_ORG_ID,
			firstName: "Maria",
			lastName: "Santos",
			phoneE164: "+639171110001",
			organization: "Santos Holdings",
			position: "Principal",
			identityStatus: "verified",
			identityVerifiedAt: now,
			identityLastExpiredAt: null,
			latestHypervergeTxnId: null,
			kycSkippedAt: null,
			retakeCount: 0,
			createdAt: now,
			updatedAt: now,
		},
		{
			userId: PRINCIPAL_TWO_USER_ID,
			subOrgId: PRINCIPAL_TWO_SUB_ORG_ID,
			firstName: "Juan",
			lastName: "Dela Cruz",
			phoneE164: "+639171110002",
			organization: "Dela Cruz Family Office",
			position: "Principal",
			identityStatus: "verified",
			identityVerifiedAt: now,
			identityLastExpiredAt: null,
			latestHypervergeTxnId: null,
			kycSkippedAt: null,
			retakeCount: 0,
			createdAt: now,
			updatedAt: now,
		},
	]

	const seedEnpProfiles: Array<typeof enpProfiles.$inferInsert> = [
		{
			userId: ENP_USER_ID,
			subOrgId: ENP_SUB_ORG_ID,
			prefix: "Atty.",
			firstName: "Elena",
			lastName: "Reyes",
			suffix: null,
			phoneE164: "+639171110003",
			rollNo: "ROLL-QL-0001",
			npnCommissionNo: "NPN-QL-0001",
			commissionValidUntil,
			ptrNo: "PTR-QL-0001",
			ptrLocation: "Makati City",
			ptrDate: now,
			ibpNo: "IBP-QL-0001",
			ibpDate: formatIbpDateDisplay(now),
			mcleNo: "MCLE-QL-0001",
			mclePeriod: "2026-2029",
			mcleDate: now,
			notaryAddress: "Reyes Notarial Office, Makati City",
			homeStreet: "123 Legazpi Street",
			barangay: "San Lorenzo",
			cityProvince: "Makati City, Metro Manila",
			identityStatus: "unverified",
			identityVerifiedAt: null,
			identityLastExpiredAt: null,
			latestHypervergeTxnId: null,
			certificateStatus: "certified",
			certificateId: "QL-ENP-SEED-0001",
			retakeCount: 0,
			directoryBaseFeePhp: 750,
			directorySpecializations: ["acknowledgment", "jurat", "oath_affirmation"],
			directoryOfferedModes: ["remote", "in_person"],
			bookingInviteTokenHash: null,
			bookingInviteExpiresAt: null,
			kycSkippedAt: null,
			courseCompletedAt: now,
			createdAt: now,
			updatedAt: now,
		},
	]

	const seedTodos: Array<typeof todos.$inferInsert> = [
		{
			title: "Review onboarding checklist",
			completed: true,
			authorId: ADMIN_USER_ID,
			createdAt: now,
			updatedAt: now,
		},
		{
			title: "Verify backend health endpoint",
			completed: false,
			authorId: ADMIN_USER_ID,
			createdAt: now,
			updatedAt: now,
		},
		{
			title: "Connect mobile app to local API",
			completed: false,
			authorId: "seed-user-alex",
			createdAt: now,
			updatedAt: now,
		},
		{
			title: "Draft release notes for staging",
			completed: false,
			authorId: "seed-user-sam",
			createdAt: now,
			updatedAt: now,
		},
	]

	const seedTickets: Array<typeof tickets.$inferInsert> = [
		{
			name: "Admin User",
			email: ADMIN_EMAIL,
			subject: "Initial admin setup check",
			priority: "high" as const,
			concern: "Please verify seeded admin data appears correctly across the dashboard.",
			status: "in_progress" as const,
			authorId: ADMIN_USER_ID,
			createdAt: now,
			updatedAt: now,
		},
		{
			name: "Alex Johnson",
			email: "alex@turbo-template.local",
			subject: "Mobile API connectivity",
			priority: "medium" as const,
			concern: "Android emulator needs a stable local API URL during development.",
			status: "received" as const,
			authorId: "seed-user-alex",
			createdAt: now,
			updatedAt: now,
		},
		{
			name: "Guest Reporter",
			email: "guest@turbo-template.local",
			subject: "Public feedback sample",
			priority: "low" as const,
			concern: "This anonymous ticket exists to test support workflows without a linked account.",
			status: "received" as const,
			authorId: null,
			createdAt: now,
			updatedAt: now,
		},
	]

	const seededUserIds = seedUsers.map(user => user.id)
	const seededTicketEmails = seedTickets.map(ticket => ticket.email)

	try {
		await db.transaction(async tx => {
			for (const user of seedUsers) {
				await tx
					.insert(users)
					.values(user)
					.onConflictDoUpdate({
						target: users.id,
						set: {
							name: user.name,
							email: user.email,
							emailVerified: user.emailVerified,
							image: user.image,
							platformRole: user.platformRole,
							updatedAt: now,
						},
					})
			}

			for (const account of seedAccounts) {
				await tx
					.insert(accounts)
					.values(account)
					.onConflictDoUpdate({
						target: [accounts.providerId, accounts.accountId],
						set: {
							id: account.id,
							userId: account.userId,
							password: account.password,
							updatedAt: now,
						},
					})
			}

			for (const subOrg of seedSubOrgs) {
				await tx
					.insert(subOrgs)
					.values(subOrg)
					.onConflictDoUpdate({
						target: subOrgs.id,
						set: {
							ownerId: subOrg.ownerId,
							name: subOrg.name,
							kind: subOrg.kind,
							deletedAt: null,
							updatedAt: now,
						},
					})
			}

			for (const profile of seedClientProfiles) {
				await tx
					.insert(clientProfiles)
					.values(profile)
					.onConflictDoUpdate({
						target: clientProfiles.userId,
						set: {
							subOrgId: profile.subOrgId,
							firstName: profile.firstName,
							lastName: profile.lastName,
							phoneE164: profile.phoneE164,
							organization: profile.organization,
							position: profile.position,
							identityStatus: profile.identityStatus,
							identityVerifiedAt: profile.identityVerifiedAt,
							identityLastExpiredAt: null,
							latestHypervergeTxnId: null,
							kycSkippedAt: null,
							retakeCount: profile.retakeCount,
							updatedAt: now,
						},
					})
			}

			for (const profile of seedEnpProfiles) {
				await tx
					.insert(enpProfiles)
					.values(profile)
					.onConflictDoUpdate({
						target: enpProfiles.userId,
						set: {
							subOrgId: profile.subOrgId,
							prefix: profile.prefix,
							firstName: profile.firstName,
							lastName: profile.lastName,
							suffix: profile.suffix,
							phoneE164: profile.phoneE164,
							rollNo: profile.rollNo,
							npnCommissionNo: profile.npnCommissionNo,
							commissionValidUntil: profile.commissionValidUntil,
							ptrNo: profile.ptrNo,
							ptrLocation: profile.ptrLocation,
							ptrDate: profile.ptrDate,
							ibpNo: profile.ibpNo,
							ibpDate: profile.ibpDate,
							mcleNo: profile.mcleNo,
							mclePeriod: profile.mclePeriod,
							mcleDate: profile.mcleDate,
							notaryAddress: profile.notaryAddress,
							homeStreet: profile.homeStreet,
							barangay: profile.barangay,
							cityProvince: profile.cityProvince,
							identityStatus: profile.identityStatus,
							identityVerifiedAt: profile.identityVerifiedAt,
							identityLastExpiredAt: null,
							latestHypervergeTxnId: null,
							certificateStatus: profile.certificateStatus,
							certificateId: profile.certificateId,
							retakeCount: profile.retakeCount,
							directoryBaseFeePhp: profile.directoryBaseFeePhp,
							directorySpecializations: profile.directorySpecializations,
							directoryOfferedModes: profile.directoryOfferedModes,
							bookingInviteTokenHash: null,
							bookingInviteExpiresAt: null,
							kycSkippedAt: null,
							courseCompletedAt: profile.courseCompletedAt,
							updatedAt: now,
						},
					})
			}

			await tx.delete(todos).where(inArray(todos.authorId, seededUserIds))

			await tx
				.delete(tickets)
				.where(
					or(inArray(tickets.email, seededTicketEmails), inArray(tickets.authorId, seededUserIds))
				)

			await tx.insert(todos).values(seedTodos)
			await tx.insert(tickets).values(seedTickets)
		})

		console.log(
			`Seeded ${seedUsers.length} users, ${seedAccounts.length} credential accounts, ${seedClientProfiles.length} client profiles, ${seedEnpProfiles.length} ENP profiles, ${seedTodos.length} todos, and ${seedTickets.length} tickets.`
		)
	} finally {
		await pool.end()
	}
}

void seedDatabase().catch(error => {
	console.error("Database seeding failed.")
	console.error(error)
	process.exitCode = 1
})
