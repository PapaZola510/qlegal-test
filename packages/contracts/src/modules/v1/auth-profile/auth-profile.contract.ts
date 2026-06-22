import { oc } from "@orpc/contract"
import { z } from "zod"

import {
	BootstrapRoleSchema,
	DismissCommissionExpiryWarningSchema,
	DismissGovernmentIdExpiryWarningSchema,
	HypervergeTransactionSchema,
	SnoozeCommissionExpiryWarningSchema,
	SnoozeGovernmentIdExpiryWarningSchema,
	UpdateProfileSchema,
	UserProfileSchema,
} from "./auth-profile.schema.js"

/** Paths avoid `/auth/*` under `/api/v1` — Better Auth owns `/api/v1/auth/*` and would intercept those URLs. */
export const authProfileContract = {
	me: oc
		.route({
			method: "GET",
			path: "/profile/me",
			summary: "Get current user profile",
			tags: ["Auth Profile"],
		})
		.output(UserProfileSchema),

	update: oc
		.route({
			method: "PUT",
			path: "/profile/me",
			summary: "Update current user profile",
			tags: ["Auth Profile"],
		})
		.input(UpdateProfileSchema)
		.output(UserProfileSchema),

	bootstrapRole: oc
		.route({
			method: "POST",
			path: "/profile/me/bootstrap-role",
			summary: "Create ENP workspace (client profile is auto-created on sign-in)",
			tags: ["Auth Profile"],
		})
		.input(BootstrapRoleSchema)
		.output(UserProfileSchema),

	ensureClientProfile: oc
		.route({
			method: "POST",
			path: "/profile/me/ensure-client",
			summary: "Ensure client profile exists (idempotent; every account is a client by default)",
			tags: ["Auth Profile"],
		})
		.output(UserProfileSchema),

	cancelEnpOnboarding: oc
		.route({
			method: "POST",
			path: "/profile/me/cancel-enp-onboarding",
			summary: "Abandon in-progress ENP setup and return to client-only account",
			tags: ["Auth Profile"],
		})
		.output(UserProfileSchema),

	identityHistory: oc
		.route({
			method: "GET",
			path: "/profile/identity-history",
			summary: "Get identity verification history (HyperVerge)",
			tags: ["Auth Profile"],
		})
		.output(z.array(HypervergeTransactionSchema)),

	dismissIdentityExpiryNotice: oc
		.route({
			method: "POST",
			path: "/profile/me/identity-expiry-dismiss",
			summary: "Clear post-expiry identity notice flag (ENP; quanby dismissKycExpiryNotice parity)",
			tags: ["Auth Profile"],
		})
		.output(z.object({ ok: z.literal(true) })),

	dismissCommissionExpiryWarning: oc
		.route({
			method: "POST",
			path: "/profile/me/commission-expiry-dismiss",
			summary: "Dismiss proactive ENP commission expiry warning for the current tier",
			tags: ["Auth Profile"],
		})
		.input(DismissCommissionExpiryWarningSchema)
		.output(UserProfileSchema),

	snoozeCommissionExpiryWarning: oc
		.route({
			method: "POST",
			path: "/profile/me/commission-expiry-snooze",
			summary: "Snooze proactive ENP commission expiry warning (Remind me later)",
			tags: ["Auth Profile"],
		})
		.input(SnoozeCommissionExpiryWarningSchema)
		.output(UserProfileSchema),

	dismissGovernmentIdExpiryWarning: oc
		.route({
			method: "POST",
			path: "/profile/me/government-id-expiry-dismiss",
			summary: "Dismiss proactive government ID expiry warning for the current tier",
			tags: ["Auth Profile"],
		})
		.input(DismissGovernmentIdExpiryWarningSchema)
		.output(UserProfileSchema),

	snoozeGovernmentIdExpiryWarning: oc
		.route({
			method: "POST",
			path: "/profile/me/government-id-expiry-snooze",
			summary: "Snooze proactive government ID expiry warning (Remind me later)",
			tags: ["Auth Profile"],
		})
		.input(SnoozeGovernmentIdExpiryWarningSchema)
		.output(UserProfileSchema),

	acceptTerms: oc
		.route({
			method: "POST",
			path: "/profile/me/accept-terms",
			summary: "Record explicit T&C / Data Privacy Act acceptance for the current user",
			tags: ["Auth Profile"],
		})
		.output(z.object({ acceptedAt: z.string().datetime() })),
}
