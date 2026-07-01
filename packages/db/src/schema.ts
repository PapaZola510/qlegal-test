import { defineRelations, sql } from "drizzle-orm"
import { index, primaryKey, uniqueIndex, type AnyPgColumn } from "drizzle-orm/pg-core"

import { createTable } from "./utils/table.js"

// ============================================================================
// BETTER AUTH TABLES
// ============================================================================

export const users = createTable("users", t => ({
	id: t.text("id").primaryKey(),
	name: t.text("name").notNull(),
	email: t.text("email").notNull().unique(),
	emailVerified: t.boolean("email_verified").default(true).notNull(),
	image: t.text("image"),
	/** Platform operators; ENP/client roles still come from profiles */
	platformRole: t
		.text("platform_role")
		.notNull()
		.default("none")
		.$type<"none" | "admin" | "super_admin" | "sub_org_admin">(),
	/** Grant for read-only data-sharing audit access (GF-16, GF-26). NOT a role. */
	complianceAuditAccess: t.boolean("compliance_audit_access").notNull().default(false),
	/** Timestamp when the user explicitly accepted the Terms & Conditions / Data Privacy Act consent. Null = not yet accepted. */
	termsAcceptedAt: t.timestamp("terms_accepted_at"),
	deletedAt: t.timestamp("deleted_at"),
	createdAt: t.timestamp("created_at").notNull().defaultNow(),
	updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
}))

export const sessions = createTable("sessions", t => ({
	id: t.text("id").primaryKey(),
	token: t.text("token").notNull().unique(),
	userId: t
		.text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	expiresAt: t.timestamp("expires_at").notNull(),
	ipAddress: t.text("ip_address"),
	userAgent: t.text("user_agent"),
	/** Set when this session must complete email OTP MFA before app access. */
	mfaRequiredAt: t.timestamp("mfa_required_at"),
	/** Set after email OTP MFA succeeds for this session. */
	mfaVerifiedAt: t.timestamp("mfa_verified_at"),
	createdAt: t.timestamp("created_at").notNull().defaultNow(),
	updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
}))

export const accounts = createTable(
	"accounts",
	t => ({
		id: t.text("id"),
		accountId: t.text("account_id").notNull(),
		providerId: t.text("provider_id").notNull(),
		userId: t
			.text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		accessToken: t.text("access_token"),
		refreshToken: t.text("refresh_token"),
		idToken: t.text("id_token"),
		accessTokenExpiresAt: t.timestamp("access_token_expires_at"),
		refreshTokenExpiresAt: t.timestamp("refresh_token_expires_at"),
		scope: t.text("scope"),
		password: t.text("password"), // For email/password auth
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
	}),
	t => [
		// Composite primary key on provider and account
		primaryKey({ columns: [t.providerId, t.accountId] }),
		index("account_user_id_idx").on(t.userId),
	]
)

export const verifications = createTable(
	"verifications",
	t => ({
		id: t.text("id"),
		identifier: t.text("identifier").notNull(),
		value: t.text("value").notNull(),
		expiresAt: t.timestamp("expires_at").notNull(),
		createdAt: t.timestamp("created_at").defaultNow(),
		updatedAt: t.timestamp("updated_at").defaultNow(),
	}),
	t => [
		// Composite primary key on identifier and value
		primaryKey({ columns: [t.identifier, t.value] }),
	]
)

export const emailVerificationOtps = createTable(
	"email_verification_otps",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		userId: t
			.text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		email: t.text("email").notNull(),
		/** SHA-256 hex of the 6-digit OTP (never store raw codes). */
		codeHash: t.text("code_hash").notNull(),
		expiresAt: t.timestamp("expires_at").notNull(),
		/** Non-null once an OTP is successfully used. */
		consumedAt: t.timestamp("consumed_at"),
		/** When the OTP email was last sent for this row. */
		lastSentAt: t.timestamp("last_sent_at").notNull().defaultNow(),
		/** Next time a resend is allowed (5 min window to match frontend timer). */
		resendAvailableAt: t.timestamp("resend_available_at").notNull(),
		sendCount: t.integer("send_count").notNull().default(1),
		requestIp: t.text("request_ip"),
		/** Purpose of the OTP (email verification vs login MFA). */
		purpose: t
			.text("purpose")
			.notNull()
			.default("email_verification")
			.$type<"email_verification" | "login_mfa">(),
		sessionId: t.text("session_id"),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
	}),
	t => [
		index("email_verification_otps_user_id_idx").on(t.userId),
		index("email_verification_otps_email_idx").on(t.email),
		index("email_verification_otps_expires_at_idx").on(t.expiresAt),
		index("email_verification_otps_purpose_idx").on(t.purpose),
		index("email_verification_otps_session_id_idx").on(t.sessionId),
	]
)

// ============================================================================
// TODOs
// ============================================================================

export const todos = createTable("todos", t => ({
	id: t.serial("id").primaryKey(),
	title: t.text("title").notNull(),
	completed: t.boolean("completed").notNull().default(false),
	authorId: t
		.text("author_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	createdAt: t.timestamp("created_at").notNull().defaultNow(),
	updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
}))

// ============================================================================
// TICKETS
// ============================================================================

export const tickets = createTable("tickets", t => ({
	id: t.serial("id").primaryKey(),
	name: t.text("name").notNull(),
	email: t.text("email").notNull(),
	subject: t.text("subject").notNull(),
	priority: t
		.text("priority")
		.notNull()
		.default("medium")
		.$type<"low" | "medium" | "high" | "urgent">(),
	concern: t.text("concern").notNull(),
	status: t
		.text("status")
		.notNull()
		.default("received")
		.$type<"received" | "in_progress" | "resolved" | "closed">(),
	authorId: t.text("author_id").references(() => users.id, { onDelete: "set null" }),
	createdAt: t.timestamp("created_at").notNull().defaultNow(),
	updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
}))

// ============================================================================
// PHASE 0 — Foundations (D1)
// ============================================================================

export const subOrgs = createTable(
	"sub_orgs",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		ownerId: t
			.text("owner_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		name: t.text("name").notNull(),
		kind: t.text("kind").notNull().$type<"personal" | "firm">(),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
		deletedAt: t.timestamp("deleted_at"),
	}),
	t => [index("sub_orgs_owner_id_idx").on(t.ownerId), index("sub_orgs_kind_idx").on(t.kind)]
)

export const fileObjects = createTable(
	"file_objects",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		subOrgId: t
			.text("sub_org_id")
			.notNull()
			.references(() => subOrgs.id, { onDelete: "restrict" }),
		ownerUserId: t
			.text("owner_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		bucket: t
			.text("bucket")
			.notNull()
			.$type<"qlegal-kyc" | "qlegal-documents" | "qlegal-sessions">(),
		s3Key: t.text("s3_key").notNull().unique(),
		mime: t.text("mime").notNull(),
		sizeBytes: t.bigint("size_bytes", { mode: "number" }).notNull(),
		sha256: t.text("sha256").notNull(),
		purpose: t
			.text("purpose")
			.notNull()
			.$type<
				| "kyc_id"
				| "kyc_liveness"
				| "kyc_national_id"
				| "qs_original"
				| "qs_signed"
				| "ai_analysis"
				| "session_recording"
				| "generated_certificate"
				| "registry_pdf"
				| "appointment_attachment"
				| "commission_application"
				| "commission_opposition"
				| "compliance_export"
			>(),
		virusScanStatus: t
			.text("virus_scan_status")
			.notNull()
			.default("pending")
			.$type<"pending" | "clean" | "infected" | "skipped">(),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		deletedAt: t.timestamp("deleted_at"),
	}),
	t => [
		index("file_objects_sub_org_id_idx").on(t.subOrgId),
		index("file_objects_owner_user_id_idx").on(t.ownerUserId),
	]
)

export const hypervergeTransactions = createTable(
	"hyperverge_transactions",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		userId: t
			.text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		hvTransactionId: t.text("hv_transaction_id").unique(),
		status: t.text("status").notNull().$type<"started" | "success" | "fail" | "needs_review">(),
		sdkCallbackAt: t.timestamp("sdk_callback_at"),
		webhookReceivedAt: t.timestamp("webhook_received_at"),
		rawResponseJson: t.jsonb("raw_response_json"),
		selfieFileId: t
			.text("selfie_file_id")
			.references(() => fileObjects.id, { onDelete: "set null" }),
		idImageFileId: t
			.text("id_image_file_id")
			.references(() => fileObjects.id, { onDelete: "set null" }),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
		deletedAt: t.timestamp("deleted_at"),
	}),
	t => [index("hyperverge_transactions_user_id_idx").on(t.userId)]
)

export const clientProfiles = createTable("client_profiles", t => ({
	userId: t
		.text("user_id")
		.primaryKey()
		.references(() => users.id, { onDelete: "restrict" }),
	subOrgId: t.text("sub_org_id").references(() => subOrgs.id, { onDelete: "set null" }),
	firstName: t.text("first_name").notNull(),
	lastName: t.text("last_name").notNull(),
	phoneE164: t.text("phone_e164"),
	/** Principal home / mailing address */
	homeStreet: t.text("home_street"),
	organization: t.text("organization"),
	position: t.text("position"),
	identityStatus: t
		.text("identity_status")
		.notNull()
		.default("unverified")
		.$type<"unverified" | "pending" | "verified" | "failed">(),
	identityVerifiedAt: t.timestamp("identity_verified_at"),
	identityLastExpiredAt: t.timestamp("identity_last_expired_at"),
	/** Expiration date of the government-issued ID on file (`YYYY-MM-DD` in profile). */
	governmentIdValidUntil: t.timestamp("government_id_valid_until"),
	governmentIdExpiryNoticeDismissals: t
		.text("government_id_expiry_notice_dismissals")
		.array()
		.notNull()
		.default(sql`ARRAY[]::text[]`),
	governmentIdExpiryNoticeSnoozeUntil: t.timestamp("government_id_expiry_notice_snooze_until"),
	latestHypervergeTxnId: t
		.text("latest_hyperverge_txn_id")
		.references(() => hypervergeTransactions.id, { onDelete: "set null" }),
	kycSkippedAt: t.timestamp("kyc_skipped_at"),
	retakeCount: t.integer("retake_count").notNull().default(0),
	createdAt: t.timestamp("created_at").notNull().defaultNow(),
	updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
}))

export const enpProfiles = createTable("enp_profiles", t => ({
	userId: t
		.text("user_id")
		.primaryKey()
		.references(() => users.id, { onDelete: "restrict" }),
	subOrgId: t
		.text("sub_org_id")
		.notNull()
		.references(() => subOrgs.id, { onDelete: "restrict" }),
	prefix: t.text("prefix"),
	firstName: t.text("first_name").notNull(),
	lastName: t.text("last_name").notNull(),
	suffix: t.text("suffix"),
	phoneE164: t.text("phone_e164"),
	rollNo: t.text("roll_no"),
	/** Date admitted to the Roll of Attorneys (Roll of Attorneys date). */
	rollDate: t.timestamp("roll_date"),
	npnCommissionNo: t.text("npn_commission_no"),
	commissionValidUntil: t.timestamp("commission_valid_until"),
	/** Dismissed commission expiry warnings keyed as `YYYY-MM-DD:tier`, e.g. `2027-03-13:30`. */
	commissionExpiryNoticeDismissals: t
		.text("commission_expiry_notice_dismissals")
		.array()
		.notNull()
		.default(sql`ARRAY[]::text[]`),
	/** Hide proactive expiry pop-ups until this time (`Remind me later`). */
	commissionExpiryNoticeSnoozeUntil: t.timestamp("commission_expiry_notice_snooze_until"),
	/** Last Supreme Court `/cs` commission status (active, inactive, cancelled, revoked, disqualified). */
	scCommissionStatus: t.text("sc_commission_status"),
	/** When `sc_commission_status` was last fetched from SC or set by admin. */
	scCommissionStatusSyncedAt: t.timestamp("sc_commission_status_synced_at"),
	/** When true, skip automatic SC refresh so admin override is preserved. */
	scCommissionStatusAdminOverride: t
		.boolean("sc_commission_status_admin_override")
		.notNull()
		.default(false),
	ptrNo: t.text("ptr_no"),
	ptrLocation: t.text("ptr_location"),
	ptrDate: t.timestamp("ptr_date"),
	ibpNo: t.text("ibp_no"),
	/** Display string for DocOnChain seal, e.g. `Dec 18, 2024 (for 2025)` */
	ibpDate: t.text("ibp_date"),
	mcleNo: t.text("mcle_no"),
	mclePeriod: t.text("mcle_period"),
	mcleDate: t.timestamp("mcle_date"),
	notaryAddress: t.text("notary_address"),
	homeStreet: t.text("home_street"),
	barangay: t.text("barangay"),
	cityProvince: t.text("city_province"),
	identityStatus: t
		.text("identity_status")
		.notNull()
		.default("pending")
		.$type<"unverified" | "pending" | "verified" | "failed">(),
	/** Set when Hyperverge identity verification succeeds; cleared on expiry revert (quanby kycVerifiedAt parity). */
	identityVerifiedAt: t.timestamp("identity_verified_at"),
	/** Post-expiry notice flag (quanby kycLastExpiredAt parity); cleared on dismiss or new verification. */
	identityLastExpiredAt: t.timestamp("identity_last_expired_at"),
	governmentIdValidUntil: t.timestamp("government_id_valid_until"),
	governmentIdExpiryNoticeDismissals: t
		.text("government_id_expiry_notice_dismissals")
		.array()
		.notNull()
		.default(sql`ARRAY[]::text[]`),
	governmentIdExpiryNoticeSnoozeUntil: t.timestamp("government_id_expiry_notice_snooze_until"),
	latestHypervergeTxnId: t
		.text("latest_hyperverge_txn_id")
		.references(() => hypervergeTransactions.id, { onDelete: "set null" }),
	certificateStatus: t
		.text("certificate_status")
		.notNull()
		.default("none")
		.$type<"none" | "certified" | "revoked">(),
	certificateId: t.text("certificate_id").unique(),
	/** Stored ENP certification PDF (`file_objects`); legacy column — do not drop. */
	certificateFileObjectId: t
		.text("certificate_file_object_id")
		.references(() => fileObjects.id, { onDelete: "set null" }),
	retakeCount: t.integer("retake_count").notNull().default(0),
	/** Public directory: base fee in PHP for “find a notary” filters */
	directoryBaseFeePhp: t.integer("directory_base_fee_php").notNull().default(500),
	/** Notarization types this ENP offers (matches API enums, snake_case) */
	directorySpecializations: t
		.text("directory_specializations")
		.array()
		.notNull()
		.default(sql`ARRAY[]::text[]`),
	directoryOfferedModes: t
		.text("directory_offered_modes")
		.array()
		.notNull()
		.default(sql`ARRAY['remote'::text, 'in_person'::text]`),
	/** SHA-256 hex of the active booking invite token (nullable = no invite) */
	bookingInviteTokenHash: t.text("booking_invite_token_hash").unique(),
	bookingInviteExpiresAt: t.timestamp("booking_invite_expires_at"),
	/** Set when ENP explicitly skips KYC during onboarding (can verify later). */
	kycSkippedAt: t.timestamp("kyc_skipped_at"),
	/** ENP certification course (read-through modules) marked complete. */
	courseCompletedAt: t.timestamp("course_completed_at"),
	createdAt: t.timestamp("created_at").notNull().defaultNow(),
	updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
}))

export const auditEvents = createTable(
	"audit_events",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		actorUserId: t.text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
		subOrgId: t.text("sub_org_id").references(() => subOrgs.id, { onDelete: "set null" }),
		eventType: t.text("event_type").notNull(),
		targetTable: t.text("target_table"),
		targetId: t.text("target_id"),
		payload: t.jsonb("payload"),
		occurredAt: t.timestamp("occurred_at").notNull().defaultNow(),
	}),
	t => [
		index("audit_events_actor_user_id_idx").on(t.actorUserId),
		index("audit_events_sub_org_id_idx").on(t.subOrgId),
		index("audit_events_event_type_idx").on(t.eventType),
	]
)

// ============================================================================
// COMPLIANCE AUDIT — tamper-evident data-sharing access trail (GF-16, GF-26)
// Electronic Notarization Data Sharing Guidelines
// ============================================================================

/** Append-only, hash-chained. rowHash = sha256(prevHash || canonicalJson(core)). */
export const complianceAccessLog = createTable(
	"compliance_access_log",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		actorUserId: t
			.text("actor_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		/** Session role at access time: admin | sub_org_admin | client | none. */
		actorRole: t.text("actor_role"),
		/** view_commission | view_enb | request_enb_copy | view_document | view_recording | list_query | export | verify_chain */
		action: t.text("action").notNull(),
		/** enp_profile | registry_act | file_object | enb | compliance_export */
		targetType: t.text("target_type"),
		targetId: t.text("target_id"),
		/** filters, ip, userAgent, exportId, format, etc. */
		context: t.jsonb("context"),
		prevHash: t.text("prev_hash"),
		rowHash: t.text("row_hash").notNull().unique(),
		occurredAt: t.timestamp("occurred_at").notNull().defaultNow(),
	}),
	t => [
		index("compliance_access_log_actor_idx").on(t.actorUserId),
		index("compliance_access_log_action_idx").on(t.action),
		index("compliance_access_log_occurred_at_idx").on(t.occurredAt),
	]
)

/** One row per export job (S-02). The export action is also appended to the access log. */
export const complianceExports = createTable(
	"compliance_exports",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		actorUserId: t
			.text("actor_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		/** commission_records | enb | notarized_documents | av_recordings */
		dataset: t.text("dataset").notNull(),
		format: t.text("format").notNull().$type<"csv" | "json">(),
		filter: t.jsonb("filter"),
		rowCount: t.integer("row_count").notNull().default(0),
		fileObjectId: t.text("file_object_id").references(() => fileObjects.id, {
			onDelete: "set null",
		}),
		/** sha256 of the export artifact bytes */
		exportSha256: t.text("export_sha256").notNull(),
		/** access-log head rowHash at export time (binds export to the trail) */
		chainHeadHash: t.text("chain_head_hash"),
		/** HMAC of the manifest (admissibility) */
		manifestSignature: t.text("manifest_signature"),
		manifest: t.jsonb("manifest"),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
	}),
	t => [
		index("compliance_exports_actor_idx").on(t.actorUserId),
		index("compliance_exports_dataset_idx").on(t.dataset),
	]
)

export const maintenanceWindows = createTable(
	"maintenance_windows",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		title: t.text("title").notNull(),
		message: t.text("message").notNull(),
		audience: t.text("audience").notNull().default("all").$type<"all" | "enp" | "client">(),
		startsAt: t.timestamp("starts_at").notNull(),
		endsAt: t.timestamp("ends_at").notNull(),
		createdByUserId: t.text("created_by_user_id").references(() => users.id, {
			onDelete: "set null",
		}),
		cancelledAt: t.timestamp("cancelled_at"),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
	}),
	t => [
		index("maintenance_windows_starts_at_idx").on(t.startsAt),
		index("maintenance_windows_cancelled_at_idx").on(t.cancelledAt),
	]
)

/**
 * Live maintenance-mode kill switch (single row, id = "singleton").
 * When `enabled` is true, the web middleware locks non-admins to `/maintenance`
 * and the backend `MaintenanceGuard` returns 503 for non-admin routes.
 * Distinct from `maintenanceWindows` (scheduled banner notices).
 */
export const maintenanceMode = createTable("maintenance_mode", t => ({
	id: t.text("id").primaryKey().default("singleton"),
	enabled: t.boolean("enabled").notNull().default(false),
	message: t.text("message"),
	updatedByUserId: t.text("updated_by_user_id").references(() => users.id, {
		onDelete: "set null",
	}),
	updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
}))

// ============================================================================
// CERT EXAM + PAYMENTS (E3)
// ============================================================================

export const paymentIntents = createTable(
	"payment_intents",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		userId: t
			.text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		amount: t.integer("amount").notNull(),
		currency: t.text("currency").notNull().default("PHP"),
		status: t
			.text("status")
			.notNull()
			.default("pending")
			.$type<"pending" | "processing" | "succeeded" | "failed" | "refunded" | "cancelled">(),
		description: t.text("description").notNull(),
		purpose: t
			.text("purpose")
			.notNull()
			.$type<"exam_retake" | "meeting_session" | "commission_hearing" | "ctc_request" | "other">(),
		provider: t
			.text("provider")
			.notNull()
			.default("stub")
			.$type<"stub" | "paymongo" | "hitpay" | "tlpe">(),
		appointmentId: t
			.text("appointment_id")
			.references(() => appointments.id, { onDelete: "set null" }),
		hearingRoomId: t
			.text("hearing_room_id")
			.references((): AnyPgColumn => commissionHearingRooms.id, { onDelete: "set null" }),
		enbAccessRequestId: t
			.text("enb_access_request_id")
			.references((): AnyPgColumn => enbAccessRequests.id, { onDelete: "set null" }),
		externalId: t.text("external_id"),
		metadata: t.jsonb("metadata").$type<Record<string, unknown> | null>(),
		paidAt: t.timestamp("paid_at"),
		paidViaAdminOverride: t.boolean("paid_via_admin_override").notNull().default(false),
		adminActorId: t.text("admin_actor_id").references(() => users.id, { onDelete: "set null" }),
		consumedAt: t.timestamp("consumed_at"),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
	}),
	t => [
		index("payment_intents_user_id_idx").on(t.userId),
		index("payment_intents_status_idx").on(t.status),
		index("payment_intents_purpose_idx").on(t.purpose),
		index("payment_intents_appointment_id_idx").on(t.appointmentId),
		index("payment_intents_hearing_room_id_idx").on(t.hearingRoomId),
		index("payment_intents_enb_access_request_id_idx").on(t.enbAccessRequestId),
	]
)

export const examVersions = createTable(
	"exam_versions",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		title: t.text("title").notNull(),
		durationMinutes: t.integer("duration_minutes").notNull().default(60),
		passingScorePct: t.integer("passing_score_pct").notNull().default(70),
		sectionCount: t.integer("section_count").notNull().default(5),
		questionsPerSection: t.integer("questions_per_section").notNull().default(10),
		isActive: t.boolean("is_active").notNull().default(true),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
	}),
	t => [index("exam_versions_is_active_idx").on(t.isActive)]
)

export const examQuestions = createTable(
	"exam_questions",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		examVersionId: t
			.text("exam_version_id")
			.notNull()
			.references(() => examVersions.id, { onDelete: "cascade" }),
		legacyStableId: t.text("legacy_stable_id").notNull(),
		sectionIndex: t.integer("section_index").notNull(),
		displayOrder: t.integer("display_order").notNull(),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
	}),
	t => [
		index("exam_questions_version_idx").on(t.examVersionId),
		uniqueIndex("exam_questions_version_stable_uidx").on(t.examVersionId, t.legacyStableId),
	]
)

export const examQuestionRevisions = createTable(
	"exam_question_revisions",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		questionId: t
			.text("question_id")
			.notNull()
			.references(() => examQuestions.id, { onDelete: "cascade" }),
		promptText: t.text("prompt_text").notNull(),
		choicesJson: t.jsonb("choices_json").notNull().$type<[string, string, string, string]>(),
		correctChoiceIndex: t.integer("correct_choice_index").notNull(),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
	}),
	t => [index("exam_question_revisions_question_idx").on(t.questionId)]
)

export const examAttempts = createTable(
	"exam_attempts",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		userId: t
			.text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		examVersionId: t
			.text("exam_version_id")
			.notNull()
			.references(() => examVersions.id, { onDelete: "restrict" }),
		status: t
			.text("status")
			.notNull()
			.default("in_progress")
			.$type<"in_progress" | "submitted" | "expired" | "abandoned">(),
		startedAt: t.timestamp("started_at").notNull().defaultNow(),
		expiresAt: t.timestamp("expires_at").notNull(),
		resumeTokenHash: t.text("resume_token_hash"),
		resumeUsed: t.boolean("resume_used").notNull().default(false),
		sectionsCompleted: t.integer("sections_completed").notNull().default(0),
		score: t.integer("score"),
		passed: t.boolean("passed"),
		paymentIntentId: t
			.text("payment_intent_id")
			.references(() => paymentIntents.id, { onDelete: "set null" }),
		completedAt: t.timestamp("completed_at"),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
	}),
	t => [
		index("exam_attempts_user_id_idx").on(t.userId),
		index("exam_attempts_version_idx").on(t.examVersionId),
		index("exam_attempts_status_idx").on(t.status),
	]
)

// ============================================================================
// APPOINTMENTS (E4)
// ============================================================================

export const appointments = createTable(
	"appointments",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		clientUserId: t
			.text("client_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		enpUserId: t
			.text("enp_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		title: t.text("title").notNull(),
		description: t.text("description"),
		status: t
			.text("status")
			.notNull()
			.default("pending")
			.$type<
				"pending" | "quote_sent" | "confirmed" | "in_session" | "ended" | "declined" | "cancelled"
			>(),
		scheduledAt: t.timestamp("scheduled_at").notNull(),
		durationMinutes: t.integer("duration_minutes").notNull().default(60),
		location: t.text("location"),
		meetingUrl: t.text("meeting_url"),
		notes: t.text("notes"),
		kind: t
			.text("kind")
			.notNull()
			.default("standard")
			.$type<"standard" | "quicksign" | "commission_hearing">(),
		notarizationType: t
			.text("notarization_type")
			.notNull()
			.$type<
				| "acknowledgment"
				| "jurat"
				| "oath_affirmation"
				| "copy_certification"
				| "signature_witnessing"
			>(),
		sessionMode: t.text("session_mode").notNull().$type<"remote" | "in_person" | "hybrid">(),
		declineReason: t.text("decline_reason"),
		/** When the ENP sent a per-document booking quote to the client. */
		quoteSentAt: t.timestamp("quote_sent_at"),
		quoteNotes: t.text("quote_notes"),
		confirmedAt: t.timestamp("confirmed_at"),
		canStart: t.boolean("can_start").notNull().default(false),
		canRejoin: t.boolean("can_rejoin").notNull().default(false),
		/** Section 4 ENB principal e-sign phase before session may end. */
		enbSigningStatus: t
			.text("enb_signing_status")
			.notNull()
			.default("not_started")
			.$type<"not_started" | "active" | "completed">(),
		enbSigningStartedAt: t.timestamp("enb_signing_started_at"),
		enbSigningCompletedAt: t.timestamp("enb_signing_completed_at"),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
	}),
	t => [
		index("appointments_client_user_id_idx").on(t.clientUserId),
		index("appointments_enp_user_id_idx").on(t.enpUserId),
		index("appointments_status_idx").on(t.status),
		index("appointments_scheduled_at_idx").on(t.scheduledAt),
		index("appointments_kind_idx").on(t.kind),
	]
)

/** Per-appointment HyperVerge hosted liveness (`workflow_liveness`) — quanby-legal parity. */
export const livenessValidations = createTable(
	"liveness_validations",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		userId: t
			.text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		appointmentId: t
			.text("appointment_id")
			.notNull()
			.references(() => appointments.id, { onDelete: "cascade" }),
		transactionId: t.text("transaction_id").notNull().unique(),
		attemptNumber: t.integer("attempt_number").notNull().default(1),
		status: t.text("status").notNull().$type<"pending" | "pass" | "fail">(),
		errorMessage: t.text("error_message"),
		decisionJson: t.jsonb("decision_json"),
		rawResultJson: t.jsonb("raw_result_json"),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
	}),
	t => [
		index("liveness_validations_user_id_idx").on(t.userId),
		index("liveness_validations_appointment_id_idx").on(t.appointmentId),
		index("liveness_validations_user_appointment_idx").on(t.userId, t.appointmentId),
	]
)

// ============================================================================
// QUICKSIGN (E6)
// ============================================================================

export type SignatureField = {
	signerEmail: string
	pageIndex: number
	x: number
	y: number
	width: number
	height: number
}

export const quicksignProjects = createTable(
	"quicksign_projects",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		enpUserId: t
			.text("enp_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		documentFileObjectId: t
			.text("document_file_object_id")
			.notNull()
			.references(() => fileObjects.id, { onDelete: "restrict" }),
		title: t.text("title").notNull(),
		description: t.text("description"),
		status: t
			.text("status")
			.notNull()
			.default("draft")
			.$type<
				"draft" | "pending_signatures" | "partially_signed" | "completed" | "expired" | "cancelled"
			>(),
		doconchainProjectUuid: t.text("doconchain_project_uuid"),
		/** JSON array of signature field positions placed by the ENP during plotting. */
		signatureFields: t
			.jsonb("signature_fields")
			.$type<SignatureField[] | null>(),
		/** Sealed notarized PDF copied from Registry into our object storage. */
		notarizedFileObjectId: t
			.text("notarized_file_object_id")
			.references(() => fileObjects.id, { onDelete: "set null" }),
		plotCompletedAt: t.timestamp("plot_completed_at"),
		appointmentId: t
			.text("appointment_id")
			.unique()
			.references(() => appointments.id, { onDelete: "set null" }),
		expiresAt: t.timestamp("expires_at"),
		completedAt: t.timestamp("completed_at"),
		/** Set after principal/witness notarized PDF delivery emails are sent. */
		notarizedPdfEmailedAt: t.timestamp("notarized_pdf_emailed_at"),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
	}),
	t => [
		index("quicksign_projects_enp_user_id_idx").on(t.enpUserId),
		index("quicksign_projects_doconchain_uuid_idx").on(t.doconchainProjectUuid),
		index("quicksign_projects_notarized_file_object_id_idx").on(t.notarizedFileObjectId),
	]
)

export const quicksignSigners = createTable(
	"quicksign_signers",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		projectId: t
			.text("project_id")
			.notNull()
			.references(() => quicksignProjects.id, { onDelete: "cascade" }),
		firstName: t.text("first_name").notNull(),
		lastName: t.text("last_name").notNull(),
		email: t.text("email").notNull(),
		sequenceOrder: t.integer("sequence_order").notNull().default(1),
		signedAt: t.timestamp("signed_at"),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
	}),
	t => [
		index("quicksign_signers_project_id_idx").on(t.projectId),
		index("quicksign_signers_email_idx").on(t.email),
	]
)

export const quicksignProjectDocumentTypes = createTable(
	"quicksign_project_document_types",
	t => ({
		projectId: t
			.text("project_id")
			.notNull()
			.references(() => quicksignProjects.id, { onDelete: "cascade" }),
		enpDocumentTypeId: t
			.text("enp_document_type_id")
			.notNull()
			.references(() => enpDocumentTypes.id, { onDelete: "restrict" }),
		/** Freeze the price at QuickSign creation time for auditability. */
		pricePhpSnapshot: t.integer("price_php_snapshot").notNull(),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
	}),
	t => [
		primaryKey({ columns: [t.projectId, t.enpDocumentTypeId] }),
		index("quicksign_project_document_types_project_id_idx").on(t.projectId),
	]
)

/** IEN checkbox acknowledgments captured before Signing (ENP, principal, witness). */
export const ienNotarialAttestations = createTable(
	"ien_notarial_attestations",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		quicksignProjectId: t
			.text("quicksign_project_id")
			.notNull()
			.references(() => quicksignProjects.id, { onDelete: "cascade" }),
		appointmentId: t
			.text("appointment_id")
			.references(() => appointments.id, { onDelete: "cascade" }),
		documentFileObjectId: t
			.text("document_file_object_id")
			.notNull()
			.references(() => fileObjects.id, { onDelete: "restrict" }),
		role: t.text("role").notNull().$type<"enp" | "principal" | "witness">(),
		userId: t
			.text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		signerEmail: t.text("signer_email").notNull(),
		signerName: t.text("signer_name").notNull().default(""),
		acknowledgmentText: t.text("acknowledgment_text").notNull().default(""),
		confirmedAt: t.timestamp("confirmed_at").notNull().defaultNow(),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
	}),
	t => [
		index("ien_notarial_attestations_project_id_idx").on(t.quicksignProjectId),
		index("ien_notarial_attestations_appointment_id_idx").on(t.appointmentId),
		uniqueIndex("ien_notarial_attestations_project_role_user_uidx").on(
			t.quicksignProjectId,
			t.role,
			t.userId
		),
	]
)

/** In-session signing state: one row per (appointment, document file, signer user). Status pending | signed. */
export const meetingSignatureRequests = createTable(
	"meeting_signature_requests",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		appointmentId: t
			.text("appointment_id")
			.notNull()
			.references(() => appointments.id, { onDelete: "cascade" }),
		documentFileObjectId: t
			.text("document_file_object_id")
			.notNull()
			.references(() => fileObjects.id, { onDelete: "cascade" }),
		signerUserId: t
			.text("signer_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		signerRole: t
			.text("signer_role")
			.notNull()
			.default("principal")
			.$type<"notary" | "principal" | "witness">(),
		signingOrder: t.integer("signing_order").notNull().default(1),
		status: t.text("status").notNull().default("pending").$type<"pending" | "signed">(),
		signedAt: t.timestamp("signed_at"),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
	}),
	t => [
		index("meeting_sig_req_appt_doc_idx").on(t.appointmentId, t.documentFileObjectId),
		uniqueIndex("meeting_sig_req_meeting_doc_signer_uidx").on(
			t.appointmentId,
			t.documentFileObjectId,
			t.signerUserId
		),
	]
)

// ============================================================================
// REGISTRY + SUPREME COURT SYNC (E7)
// ============================================================================

export const registryActs = createTable(
	"registry_acts",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		enpUserId: t
			.text("enp_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		appointmentId: t
			.text("appointment_id")
			.references(() => appointments.id, { onDelete: "set null" }),
		actNumber: t.text("act_number").notNull(),
		actType: t
			.text("act_type")
			.notNull()
			.$type<
				| "deed_of_sale"
				| "affidavit"
				| "special_power_of_attorney"
				| "general_power_of_attorney"
				| "acknowledgment"
				| "jurat"
				| "oath"
				| "certification"
				| "protest"
				| "deposition"
				| "other"
			>(),
		title: t.text("title").notNull(),
		parties: t.jsonb("parties").notNull().$type<{ name: string; role: string }[]>(),
		executedAt: t.timestamp("executed_at").notNull(),
		documentUrl: t.text("document_url"),
		bookNo: t.text("book_no"),
		pageNo: t.text("page_no"),
		feePhp: t.integer("fee_php"),
		description: t.text("description"),
		scStatus: t
			.text("sc_status")
			.notNull()
			.default("draft")
			.$type<
				| "draft"
				| "pending_upload"
				| "uploaded"
				| "pending_review"
				| "approved"
				| "rejected"
				| "synced"
				| "sync_failed"
			>(),
		scSubmittedAt: t.timestamp("sc_submitted_at"),
		scSyncedAt: t.timestamp("sc_synced_at"),
		scRejectionReason: t.text("sc_rejection_reason"),
		scExternalRef: t.text("sc_external_ref"),
		/** Canonical ENB entry number (SC format: doc-page-month-year). */
		entryNumber: t.text("entry_number"),
		completionStatus: t
			.text("completion_status")
			.notNull()
			.default("completed")
			.$type<"completed" | "incomplete">(),
		/** Rule 24-10-14-SC (b): reasons when act was not completed. */
		incompleteReason: t.text("incomplete_reason"),
		incompleteCircumstances: t.text("incomplete_circumstances"),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
	}),
	t => [
		index("registry_acts_enp_user_id_idx").on(t.enpUserId),
		index("registry_acts_appointment_id_idx").on(t.appointmentId),
		index("registry_acts_sc_status_idx").on(t.scStatus),
		index("registry_acts_entry_number_idx").on(t.entryNumber),
		index("registry_acts_completion_status_idx").on(t.completionStatus),
	]
)

/** Principal e-signatures on ENB entries during the live session (Rule §4). */
export const meetingEnbSignatureRequests = createTable(
	"meeting_enb_signature_requests",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		appointmentId: t
			.text("appointment_id")
			.notNull()
			.references(() => appointments.id, { onDelete: "cascade" }),
		registryActId: t
			.text("registry_act_id")
			.notNull()
			.references(() => registryActs.id, { onDelete: "cascade" }),
		signerUserId: t
			.text("signer_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		signerRole: t
			.text("signer_role")
			.notNull()
			.default("principal")
			.$type<"principal" | "witness">(),
		signerName: t.text("signer_name").notNull(),
		entryNumber: t.text("entry_number").notNull(),
		documentTitle: t.text("document_title").notNull(),
		status: t.text("status").notNull().default("pending").$type<"pending" | "signed">(),
		signatureAcknowledgment: t.text("signature_acknowledgment"),
		/** PNG data URL from in-app signature pad. */
		signatureImageData: t.text("signature_image_data"),
		signedAt: t.timestamp("signed_at"),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
	}),
	t => [
		index("meeting_enb_sig_req_appointment_idx").on(t.appointmentId),
		index("meeting_enb_sig_req_registry_act_idx").on(t.registryActId),
		uniqueIndex("meeting_enb_sig_req_act_signer_uidx").on(t.registryActId, t.signerUserId),
	]
)

/** Rule 24-10-14-SC (c): inspect/copy requests to the Electronic Notarial Book. */
export const enbAccessRequests = createTable(
	"enb_access_requests",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		enpUserId: t
			.text("enp_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		registryActId: t
			.text("registry_act_id")
			.references(() => registryActs.id, { onDelete: "set null" }),
		bookNo: t.text("book_no"),
		requestType: t.text("request_type").notNull().$type<"inspect" | "copy">(),
		/** Principal-initiated certified true copy of a notarized document. */
		certifiedTrueCopy: t.boolean("certified_true_copy").notNull().default(false),
		/** Logged-in client who submitted the request (when applicable). */
		requesterUserId: t
			.text("requester_user_id")
			.references(() => users.id, { onDelete: "set null" }),
		appointmentId: t
			.text("appointment_id")
			.references(() => appointments.id, { onDelete: "set null" }),
		documentFileObjectId: t
			.text("document_file_object_id")
			.references(() => fileObjects.id, { onDelete: "set null" }),
		requesterName: t.text("requester_name").notNull(),
		requesterAddress: t.text("requester_address").notNull(),
		lawfulPurpose: t.text("lawful_purpose").notNull(),
		/** PNG data URL from in-app signature pad (Rule §4 access log). */
		requesterSignatureImageData: t.text("requester_signature_image_data"),
		/** Uploaded e-signature image or capture reference. */
		requesterSignatureFileObjectId: t
			.text("requester_signature_file_object_id")
			.references(() => fileObjects.id, { onDelete: "set null" }),
		identityEvidenceFileObjectId: t
			.text("identity_evidence_file_object_id")
			.references(() => fileObjects.id, { onDelete: "set null" }),
		outcome: t
			.text("outcome")
			.notNull()
			.default("pending")
			.$type<"pending" | "granted" | "refused">(),
		refusalReason: t.text("refusal_reason"),
		/** ENP e-signature when granting a certified true copy (Rule 24-10-14-SC access log). */
		enpSignatureImageData: t.text("enp_signature_image_data"),
		/** ENP-completed CTC compliance form fields at grant time. */
		ctcComplianceForm: t
			.jsonb("ctc_compliance_form")
			.$type<{
				requestingPartyIdentityCheck: string
				notarialActDate: string
				documentType: string
				principalNames: string
				witnessNames: string | null
				purposeOfRequest: string
				entryRequested: string
				lawEnforcementCourtOrderAttached: boolean
				lawEnforcementNotes: string | null
				paymentMethod: "cash" | "online"
			}>(),
		/** Client-selected payment method when requesting a certified true copy. */
		requesterPaymentMethod: t.text("requester_payment_method").$type<"cash" | "online" | null>(),
		paymentIntentId: t
			.text("payment_intent_id")
			.references(() => paymentIntents.id, { onDelete: "set null" }),
		requestedAt: t.timestamp("requested_at").notNull().defaultNow(),
		decidedAt: t.timestamp("decided_at"),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
	}),
	t => [
		index("enb_access_requests_enp_user_id_idx").on(t.enpUserId),
		index("enb_access_requests_registry_act_id_idx").on(t.registryActId),
		index("enb_access_requests_requester_user_id_idx").on(t.requesterUserId),
		index("enb_access_requests_outcome_idx").on(t.outcome),
	]
)

/** Rule 24-10-14-SC (e): full protest proceedings for drafts, bills, notes. */
export const registryProtestProceedings = createTable("registry_protest_proceedings", t => ({
	registryActId: t
		.text("registry_act_id")
		.primaryKey()
		.references(() => registryActs.id, { onDelete: "cascade" }),
	demandBy: t.text("demand_by"),
	demandWhen: t.text("demand_when"),
	demandWhere: t.text("demand_where"),
	sumDemanded: t.text("sum_demanded"),
	presented: t.boolean("presented"),
	presentationNotes: t.text("presentation_notes"),
	notices: t
		.jsonb("notices")
		.notNull()
		.default(sql`'[]'::jsonb`)
		.$type<
			{
				toWhom: string
				manner: string
				whereMade: string
				whenDirected: string
				whereDirected: string
			}[]
		>(),
	otherFacts: t.text("other_facts"),
	createdAt: t.timestamp("created_at").notNull().defaultNow(),
	updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
}))

export const appointmentDocuments = createTable(
	"appointment_documents",
	t => ({
		appointmentId: t
			.text("appointment_id")
			.notNull()
			.references(() => appointments.id, { onDelete: "cascade" }),
		fileObjectId: t
			.text("file_object_id")
			.notNull()
			.references(() => fileObjects.id, { onDelete: "restrict" }),
		/** ENP-provided label at upload time; falls back to storage key when null */
		displayName: t.text("display_name"),
		/** Preset (e.g. JURAT) or custom act type entered by ENP */
		documentType: t.text("document_type"),
		/** Booked ENP service type this instrument belongs to (from client booking). */
		enpDocumentTypeId: t
			.text("enp_document_type_id")
			.references(() => enpDocumentTypes.id, { onDelete: "restrict" }),
		/** Notarial fee in PHP (ENP sets at upload or when initiating signing). */
		feePhp: t.integer("fee_php"),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
	}),
	t => [
		primaryKey({ columns: [t.appointmentId, t.fileObjectId] }),
		index("appointment_documents_file_object_id_idx").on(t.fileObjectId),
		index("appointment_documents_enp_document_type_id_idx").on(t.enpDocumentTypeId),
	]
)

// ============================================================================
// DOCUMENT REVIEW REQUESTS
// Client uploads a document and picks a notary to review it. Notary reviews,
// then either approves (auto-creates a confirmed appointment with the docs
// attached) or rejects with a reason. Decoupled from the standard booking
// flow at /find-notary; this is the "Upload Document" quick-action path.
// ============================================================================

export const documentReviewRequests = createTable(
	"document_review_requests",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		clientUserId: t
			.text("client_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		enpUserId: t
			.text("enp_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		title: t.text("title").notNull(),
		note: t.text("note"),
		notarizationType: t
			.text("notarization_type")
			.$type<
				| "acknowledgment"
				| "jurat"
				| "oath_affirmation"
				| "copy_certification"
				| "signature_witnessing"
			>(),
		sessionMode: t
			.text("session_mode")
			.notNull()
			.default("remote")
			.$type<"remote" | "in_person" | "hybrid">(),
		status: t
			.text("status")
			.notNull()
			.default("pending")
			.$type<"pending" | "approved" | "rejected" | "cancelled">(),
		/** Optional ISO timestamps the client suggests; ENP is not forced to pick one */
		proposedSlots: t
			.jsonb("proposed_slots")
			.notNull()
			.default(sql`'[]'::jsonb`)
			.$type<string[]>(),
		rejectionReason: t.text("rejection_reason"),
		/** When approved, the appointment row that was auto-created */
		approvedAppointmentId: t
			.text("approved_appointment_id")
			.references(() => appointments.id, { onDelete: "set null" }),
		/** `meeting` = REN video session; `quicksign` = IEN in-person e-sign queue */
		approvedPath: t.text("approved_path").$type<"meeting" | "quicksign">(),
		/** Active QuickSign project while processing the IEN document queue */
		activeQuicksignProjectId: t
			.text("active_quicksign_project_id")
			.references(() => quicksignProjects.id, { onDelete: "set null" }),
		respondedAt: t.timestamp("responded_at"),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
	}),
	t => [
		index("document_review_requests_client_user_id_idx").on(t.clientUserId),
		index("document_review_requests_enp_user_id_idx").on(t.enpUserId),
		index("document_review_requests_status_idx").on(t.status),
	]
)

export const documentReviewRequestFiles = createTable(
	"document_review_request_files",
	t => ({
		reviewRequestId: t
			.text("review_request_id")
			.notNull()
			.references(() => documentReviewRequests.id, { onDelete: "cascade" }),
		fileObjectId: t
			.text("file_object_id")
			.notNull()
			.references(() => fileObjects.id, { onDelete: "restrict" }),
		displayName: t.text("display_name"),
		/** Stable order within the review request (0-based). */
		sortOrder: t.integer("sort_order").notNull().default(0),
		/** QuickSign project created when this file enters the IEN queue */
		quicksignProjectId: t
			.text("quicksign_project_id")
			.references(() => quicksignProjects.id, { onDelete: "set null" }),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
	}),
	t => [
		primaryKey({ columns: [t.reviewRequestId, t.fileObjectId] }),
		index("document_review_request_files_file_object_id_idx").on(t.fileObjectId),
		index("document_review_request_files_quicksign_project_id_idx").on(t.quicksignProjectId),
	]
)

// ============================================================================
// ENP COMMISSION APPLICATIONS (ENA review)
// ============================================================================

export const enpCommissionApplicationStatusEnum = [
	"submitted",
	"under_review",
	"hearing_scheduled",
	"approved",
	"rejected",
] as const

export const enpCommissionStatusEnum = ["active", "revoked", "resigned", "expired"] as const

export const commissionHearingOppositionStatusEnum = [
	"filed",
	"forwarded",
	"access_granted",
	"appeared",
	"denied_no_show",
	"sustained",
	"overruled",
] as const

export const enpCommissionApplicationRequirementEnum = [
	"good_moral",
	"passport_photo",
	"filing_fee",
	"enf_video_certification",
] as const

export const enpCommissionApplications = createTable(
	"enp_commission_applications",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		applicantUserId: t
			.text("applicant_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		subOrgId: t
			.text("sub_org_id")
			.notNull()
			.references(() => subOrgs.id, { onDelete: "restrict" }),
		citizenship: t.text("citizenship").notNull(),
		ulasComplianceNumber: t.text("ulas_compliance_number"),
		qualificationsStatement: t.text("qualifications_statement").notNull(),
		undertakingRules: t.boolean("undertaking_rules").notNull(),
		undertakingDataSharing: t.boolean("undertaking_data_sharing").notNull(),
		status: t
			.text("status")
			.notNull()
			.default("submitted")
			.$type<(typeof enpCommissionApplicationStatusEnum)[number]>(),
		decisionReason: t.text("decision_reason"),
		submittedAt: t.timestamp("submitted_at").notNull().defaultNow(),
		summaryHearingScheduledAt: t.timestamp("summary_hearing_scheduled_at"),
		summaryHearingRoomId: t
			.text("summary_hearing_room_id")
			.references((): AnyPgColumn => commissionHearingRooms.id, { onDelete: "set null" }),
		/** @deprecated Use summaryHearingRoomId for dedicated ENA commission hearings. */
		summaryHearingAppointmentId: t
			.text("summary_hearing_appointment_id")
			.references(() => appointments.id, { onDelete: "set null" }),
		/** @deprecated Use summaryHearingAppointmentId — legacy external videoconference URLs */
		summaryHearingMeetingUrl: t.text("summary_hearing_meeting_url"),
		summaryHearingInstructions: t.text("summary_hearing_instructions"),
		summaryHearingScheduledByUserId: t
			.text("summary_hearing_scheduled_by_user_id")
			.references(() => users.id, { onDelete: "set null" }),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
	}),
	t => [
		index("enp_commission_applications_applicant_user_id_idx").on(t.applicantUserId),
		index("enp_commission_applications_sub_org_id_idx").on(t.subOrgId),
		index("enp_commission_applications_status_idx").on(t.status),
		index("enp_commission_applications_submitted_at_idx").on(t.submittedAt),
		index("enp_commission_applications_summary_hearing_scheduled_at_idx").on(
			t.summaryHearingScheduledAt
		),
		index("enp_commission_applications_summary_hearing_room_id_idx").on(t.summaryHearingRoomId),
		index("enp_commission_applications_summary_hearing_appointment_id_idx").on(
			t.summaryHearingAppointmentId
		),
	]
)

export const enpCommissionApplicationDocuments = createTable(
	"enp_commission_application_documents",
	t => ({
		applicationId: t
			.text("application_id")
			.notNull()
			.references((): AnyPgColumn => enpCommissionApplications.id, { onDelete: "cascade" }),
		requirementKey: t
			.text("requirement_key")
			.notNull()
			.$type<(typeof enpCommissionApplicationRequirementEnum)[number]>(),
		fileObjectId: t
			.text("file_object_id")
			.notNull()
			.references(() => fileObjects.id, { onDelete: "restrict" }),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
	}),
	t => [
		primaryKey({ columns: [t.applicationId, t.requirementKey] }),
		index("enp_commission_application_documents_file_object_id_idx").on(t.fileObjectId),
	]
)

export const commissionHearingRooms = createTable(
	"commission_hearing_rooms",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		applicationId: t
			.text("application_id")
			.notNull()
			.references(() => enpCommissionApplications.id, { onDelete: "cascade" }),
		enaUserId: t
			.text("ena_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		applicantUserId: t
			.text("applicant_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		livekitRoomName: t.text("livekit_room_name").notNull().unique(),
		scheduledAt: t.timestamp("scheduled_at"),
		instructions: t.text("instructions"),
		status: t
			.text("status")
			.notNull()
			.default("scheduled")
			.$type<"scheduled" | "in_session" | "ended" | "cancelled">(),
		startedAt: t.timestamp("started_at"),
		endedAt: t.timestamp("ended_at"),
		recordingEgressId: t.text("recording_egress_id"),
		recordingFileObjectId: t
			.text("recording_file_object_id")
			.references(() => fileObjects.id, { onDelete: "set null" }),
		recordingStartedAt: t.timestamp("recording_started_at"),
		recordingStoppedAt: t.timestamp("recording_stopped_at"),
		applicantInviteTokenHash: t.text("applicant_invite_token_hash"),
		applicantInviteExpiresAt: t.timestamp("applicant_invite_expires_at"),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
	}),
	t => [
		uniqueIndex("commission_hearing_rooms_application_id_uidx").on(t.applicationId),
		index("commission_hearing_rooms_ena_user_id_idx").on(t.enaUserId),
		index("commission_hearing_rooms_applicant_user_id_idx").on(t.applicantUserId),
		index("commission_hearing_rooms_status_idx").on(t.status),
		index("commission_hearing_rooms_scheduled_at_idx").on(t.scheduledAt),
	]
)

export const commissionHearingOppositions = createTable(
	"commission_hearing_oppositions",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		applicationId: t
			.text("application_id")
			.notNull()
			.references(() => enpCommissionApplications.id, { onDelete: "cascade" }),
		hearingRoomId: t
			.text("hearing_room_id")
			.references(() => commissionHearingRooms.id, { onDelete: "set null" }),
		oppositorName: t.text("oppositor_name").notNull(),
		oppositorEmail: t.text("oppositor_email").notNull(),
		oppositorUserId: t.text("oppositor_user_id").references(() => users.id, {
			onDelete: "set null",
		}),
		grounds: t.text("grounds").notNull(),
		verifiedDocumentFileObjectId: t
			.text("verified_document_file_object_id")
			.notNull()
			.references(() => fileObjects.id, { onDelete: "restrict" }),
		representativeDocumentFileObjectId: t
			.text("representative_document_file_object_id")
			.references(() => fileObjects.id, { onDelete: "set null" }),
		status: t
			.text("status")
			.notNull()
			.default("filed")
			.$type<(typeof commissionHearingOppositionStatusEnum)[number]>(),
		accessTokenHash: t.text("access_token_hash"),
		accessExpiresAt: t.timestamp("access_expires_at"),
		nonAppearanceExcused: t.boolean("non_appearance_excused").notNull().default(false),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
	}),
	t => [
		index("commission_hearing_oppositions_application_id_idx").on(t.applicationId),
		index("commission_hearing_oppositions_hearing_room_id_idx").on(t.hearingRoomId),
		index("commission_hearing_oppositions_status_idx").on(t.status),
		index("commission_hearing_oppositions_oppositor_email_idx").on(t.oppositorEmail),
	]
)

export const enpCommissions = createTable(
	"enp_commissions",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		applicationId: t
			.text("application_id")
			.notNull()
			.references(() => enpCommissionApplications.id, { onDelete: "cascade" }),
		enpUserId: t
			.text("enp_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		commissionedName: t.text("commissioned_name").notNull(),
		placeOfWork: t.text("place_of_work").notNull(),
		commissionDate: t.timestamp("commission_date").notNull(),
		termEndDate: t.timestamp("term_end_date").notNull(),
		status: t
			.text("status")
			.notNull()
			.default("active")
			.$type<(typeof enpCommissionStatusEnum)[number]>(),
		certificateFileObjectId: t
			.text("certificate_file_object_id")
			.references(() => fileObjects.id, { onDelete: "set null" }),
		issuedByUserId: t
			.text("issued_by_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		amNumber: t.text("am_number").notNull().default("A.M. No. 24-10-14-SC"),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
	}),
	t => [
		uniqueIndex("enp_commissions_application_id_uidx").on(t.applicationId),
		index("enp_commissions_enp_user_id_idx").on(t.enpUserId),
		index("enp_commissions_status_idx").on(t.status),
	]
)

export const commissionHearingMessages = createTable(
	"commission_hearing_messages",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		hearingRoomId: t
			.text("hearing_room_id")
			.notNull()
			.references(() => commissionHearingRooms.id, { onDelete: "cascade" }),
		senderUserId: t
			.text("sender_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		body: t.text("body").notNull(),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
	}),
	t => [
		index("commission_hearing_messages_room_created_at_idx").on(t.hearingRoomId, t.createdAt),
		index("commission_hearing_messages_sender_user_id_idx").on(t.senderUserId),
	]
)

export const commissionHearingRoomParticipants = createTable(
	"commission_hearing_room_participants",
	t => ({
		hearingRoomId: t
			.text("hearing_room_id")
			.notNull()
			.references(() => commissionHearingRooms.id, { onDelete: "cascade" }),
		userId: t
			.text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		joinedAt: t.timestamp("joined_at").notNull().defaultNow(),
	}),
	t => [
		primaryKey({ columns: [t.hearingRoomId, t.userId] }),
		index("commission_hearing_room_participants_user_id_idx").on(t.userId),
	]
)

// ============================================================================
// ENP DOCUMENT TYPES (custom catalog + pricing)
// ============================================================================

export const enpDocumentTypes = createTable(
	"enp_document_types",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		enpUserId: t
			.text("enp_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		name: t.text("name").notNull(),
		pricePhp: t.integer("price_php").notNull(),
		isActive: t.boolean("is_active").notNull().default(true),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
	}),
	t => [
		index("enp_document_types_enp_user_id_idx").on(t.enpUserId),
		index("enp_document_types_is_active_idx").on(t.isActive),
	]
)

export const appointmentDocumentTypes = createTable(
	"appointment_document_types",
	t => ({
		appointmentId: t
			.text("appointment_id")
			.notNull()
			.references(() => appointments.id, { onDelete: "cascade" }),
		enpDocumentTypeId: t
			.text("enp_document_type_id")
			.notNull()
			.references(() => enpDocumentTypes.id, { onDelete: "restrict" }),
		/** Freeze the price at booking time for auditability. */
		pricePhpSnapshot: t.integer("price_php_snapshot").notNull(),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
	}),
	t => [
		primaryKey({ columns: [t.appointmentId, t.enpDocumentTypeId] }),
		index("appointment_document_types_appointment_id_idx").on(t.appointmentId),
		index("appointment_document_types_enp_document_type_id_idx").on(t.enpDocumentTypeId),
	]
)

export const documentReviewRequestDocumentTypes = createTable(
	"document_review_request_document_types",
	t => ({
		reviewRequestId: t
			.text("review_request_id")
			.notNull()
			.references(() => documentReviewRequests.id, { onDelete: "cascade" }),
		enpDocumentTypeId: t
			.text("enp_document_type_id")
			.notNull()
			.references(() => enpDocumentTypes.id, { onDelete: "restrict" }),
		/** Freeze the price at request time for auditability. */
		pricePhpSnapshot: t.integer("price_php_snapshot").notNull(),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
	}),
	t => [
		primaryKey({ columns: [t.reviewRequestId, t.enpDocumentTypeId] }),
		index("document_review_request_document_types_review_request_id_idx").on(t.reviewRequestId),
		index("document_review_request_document_types_enp_document_type_id_idx").on(
			t.enpDocumentTypeId
		),
	]
)

// ============================================================================
// NOTARIAL VIDEO SESSIONS + IN-SESSION CHAT (E5)
// ============================================================================

export const sessionRooms = createTable(
	"session_rooms",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		appointmentId: t
			.text("appointment_id")
			.notNull()
			.references(() => appointments.id, { onDelete: "cascade" }),
		livekitRoomName: t.text("livekit_room_name").notNull().unique(),
		guestInviteTokenHash: t.text("guest_invite_token_hash"),
		guestInviteExpiresAt: t.timestamp("guest_invite_expires_at"),
		/** principal | witness — set when ENP mints a session guest invite link */
		guestInviteIntendedRole: t.text("guest_invite_intended_role").$type<"principal" | "witness">(),
		startedAt: t.timestamp("started_at").notNull().defaultNow(),
		endedAt: t.timestamp("ended_at"),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
	}),
	t => [
		uniqueIndex("session_rooms_appointment_id_uidx").on(t.appointmentId),
		index("session_rooms_livekit_room_name_idx").on(t.livekitRoomName),
	]
)

/** In-session chat (E5). DM channels use a separate flow in E8. */
export const sessionMessages = createTable(
	"messages",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		sessionRoomId: t
			.text("session_room_id")
			.notNull()
			.references(() => sessionRooms.id, { onDelete: "cascade" }),
		senderUserId: t
			.text("sender_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		body: t.text("body").notNull(),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
	}),
	t => [
		index("messages_session_room_id_created_at_idx").on(t.sessionRoomId, t.createdAt),
		index("messages_sender_user_id_idx").on(t.senderUserId),
	]
)

// ============================================================================
// DIRECT MESSAGES (E8)
// ============================================================================

export const dmConversations = createTable(
	"dm_conversations",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		/** `min(userA,userB) + ':' + max(userA,userB)` (lexicographic on user ids) */
		convKey: t.text("conv_key").notNull().unique(),
		lowUserId: t
			.text("low_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		highUserId: t
			.text("high_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		lastMessagePreview: t.text("last_message_preview"),
		lastMessageAt: t.timestamp("last_message_at"),
		lowUserLastReadAt: t.timestamp("low_user_last_read_at"),
		highUserLastReadAt: t.timestamp("high_user_last_read_at"),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
	}),
	t => [
		index("dm_conversations_low_user_id_idx").on(t.lowUserId),
		index("dm_conversations_high_user_id_idx").on(t.highUserId),
	]
)

export const dmMessages = createTable(
	"dm_messages",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		conversationId: t
			.text("conversation_id")
			.notNull()
			.references(() => dmConversations.id, { onDelete: "cascade" }),
		senderUserId: t
			.text("sender_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		type: t
			.text("type")
			.notNull()
			.default("text")
			.$type<"text" | "file" | "system" | "notification">(),
		content: t.text("content").notNull(),
		fileUrl: t.text("file_url"),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
	}),
	t => [index("dm_messages_conversation_id_created_at_idx").on(t.conversationId, t.createdAt)]
)

export const sessionRoomGuests = createTable(
	"session_room_guests",
	t => ({
		sessionRoomId: t
			.text("session_room_id")
			.notNull()
			.references(() => sessionRooms.id, { onDelete: "cascade" }),
		userId: t
			.text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
	}),
	t => [
		primaryKey({ columns: [t.sessionRoomId, t.userId] }),
		index("session_room_guests_user_id_idx").on(t.userId),
	]
)

export const examAttemptAnswers = createTable(
	"exam_attempt_answers",
	t => ({
		attemptId: t
			.text("attempt_id")
			.notNull()
			.references(() => examAttempts.id, { onDelete: "cascade" }),
		questionId: t
			.text("question_id")
			.notNull()
			.references(() => examQuestions.id, { onDelete: "restrict" }),
		choiceKey: t.text("choice_key").notNull(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
	}),
	t => [
		primaryKey({ columns: [t.attemptId, t.questionId] }),
		index("exam_attempt_answers_attempt_idx").on(t.attemptId),
	]
)

// ============================================================================
// LEGAL TEMPLATE DRAFTS
// ============================================================================

/**
 * Persists a lawyer/ENP's in-progress form data for a legal document template.
 * One row per user per template (upsert on save). The `data` column holds the
 * full JSON form state so the lawyer can resume editing from any device.
 */
export const legalTemplateDrafts = createTable(
	"legal_template_drafts",
	t => ({
		id: t
			.text("id")
			.primaryKey()
			.default(sql`gen_random_uuid()::text`),
		userId: t
			.text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		/** Matches TemplateId in the frontend: affidavit-of-loss | affidavit-of-discrepancy | sworn-affidavit-name-discrepancy */
		templateId: t.text("template_id").notNull(),
		/** Full form-field JSON blob */
		data: t.jsonb("data").notNull(),
		updatedAt: t.timestamp("updated_at").notNull().defaultNow(),
		createdAt: t.timestamp("created_at").notNull().defaultNow(),
	}),
	t => [
		uniqueIndex("legal_template_drafts_user_template_uidx").on(t.userId, t.templateId),
		index("legal_template_drafts_user_id_idx").on(t.userId),
	]
)

// ============================================================================
// RELATIONS
// ============================================================================
export const relations = defineRelations(
	{
		users,
		sessions,
		accounts,
		verifications,
		emailVerificationOtps,
		todos,
		tickets,
		subOrgs,
		fileObjects,
		hypervergeTransactions,
		clientProfiles,
		enpProfiles,
		auditEvents,
		complianceAccessLog,
		complianceExports,
		maintenanceWindows,
		maintenanceMode,
		paymentIntents,
		examVersions,
		examQuestions,
		examQuestionRevisions,
		examAttempts,
		examAttemptAnswers,
		appointments,
		livenessValidations,
		appointmentDocuments,
		documentReviewRequests,
		documentReviewRequestFiles,
		enpCommissionApplications,
		enpCommissionApplicationDocuments,
		enpCommissions,
		commissionHearingRooms,
		commissionHearingOppositions,
		commissionHearingMessages,
		commissionHearingRoomParticipants,
		enpDocumentTypes,
		appointmentDocumentTypes,
		documentReviewRequestDocumentTypes,
		quicksignProjects,
		quicksignSigners,
		quicksignProjectDocumentTypes,
		ienNotarialAttestations,
		meetingSignatureRequests,
		meetingEnbSignatureRequests,
		sessionRooms,
		sessionMessages,
		sessionRoomGuests,
		registryActs,
		dmConversations,
		dmMessages,
	},
	r => ({
		users: {
			sessions: r.many.sessions(),
			accounts: r.many.accounts(),
			ownedSubOrgs: r.many.subOrgs(),
			registryActsAsEnp: r.many.registryActs({
				from: r.users.id,
				to: r.registryActs.enpUserId,
			}),
			clientProfile: r.one.clientProfiles({
				from: r.users.id,
				to: r.clientProfiles.userId,
			}),
			enpProfile: r.one.enpProfiles({
				from: r.users.id,
				to: r.enpProfiles.userId,
			}),
			appointmentsAsClient: r.many.appointments({
				from: r.users.id,
				to: r.appointments.clientUserId,
			}),
			appointmentsAsEnp: r.many.appointments({
				from: r.users.id,
				to: r.appointments.enpUserId,
			}),
			quicksignProjectsAsEnp: r.many.quicksignProjects({
				from: r.users.id,
				to: r.quicksignProjects.enpUserId,
			}),
			commissionHearingsAsEna: r.many.commissionHearingRooms({
				from: r.users.id,
				to: r.commissionHearingRooms.enaUserId,
			}),
			commissionHearingsAsApplicant: r.many.commissionHearingRooms({
				from: r.users.id,
				to: r.commissionHearingRooms.applicantUserId,
			}),
			enpCommissions: r.many.enpCommissions({
				from: r.users.id,
				to: r.enpCommissions.enpUserId,
			}),
			issuedEnpCommissions: r.many.enpCommissions({
				from: r.users.id,
				to: r.enpCommissions.issuedByUserId,
			}),
		},
		sessions: {
			user: r.one.users({
				from: r.sessions.userId,
				to: r.users.id,
			}),
		},
		accounts: {
			user: r.one.users({
				from: r.accounts.userId,
				to: r.users.id,
			}),
		},
		emailVerificationOtps: {
			user: r.one.users({
				from: r.emailVerificationOtps.userId,
				to: r.users.id,
			}),
		},
		todos: {
			author: r.one.users({
				from: r.todos.authorId,
				to: r.users.id,
			}),
		},
		tickets: {
			author: r.one.users({
				from: r.tickets.authorId,
				to: r.users.id,
			}),
		},
		subOrgs: {
			owner: r.one.users({
				from: r.subOrgs.ownerId,
				to: r.users.id,
			}),
		},
		fileObjects: {
			subOrg: r.one.subOrgs({
				from: r.fileObjects.subOrgId,
				to: r.subOrgs.id,
			}),
			owner: r.one.users({
				from: r.fileObjects.ownerUserId,
				to: r.users.id,
			}),
			appointmentDocumentLinks: r.many.appointmentDocuments({
				from: r.fileObjects.id,
				to: r.appointmentDocuments.fileObjectId,
			}),
			quicksignOriginalDocuments: r.many.quicksignProjects({
				from: r.fileObjects.id,
				to: r.quicksignProjects.documentFileObjectId,
			}),
		},
		hypervergeTransactions: {
			user: r.one.users({
				from: r.hypervergeTransactions.userId,
				to: r.users.id,
			}),
			selfieFile: r.one.fileObjects({
				from: r.hypervergeTransactions.selfieFileId,
				to: r.fileObjects.id,
			}),
			idImageFile: r.one.fileObjects({
				from: r.hypervergeTransactions.idImageFileId,
				to: r.fileObjects.id,
			}),
		},
		clientProfiles: {
			user: r.one.users({
				from: r.clientProfiles.userId,
				to: r.users.id,
			}),
			subOrg: r.one.subOrgs({
				from: r.clientProfiles.subOrgId,
				to: r.subOrgs.id,
			}),
			latestHypervergeTxn: r.one.hypervergeTransactions({
				from: r.clientProfiles.latestHypervergeTxnId,
				to: r.hypervergeTransactions.id,
			}),
		},
		enpProfiles: {
			user: r.one.users({
				from: r.enpProfiles.userId,
				to: r.users.id,
			}),
			subOrg: r.one.subOrgs({
				from: r.enpProfiles.subOrgId,
				to: r.subOrgs.id,
			}),
			latestHypervergeTxn: r.one.hypervergeTransactions({
				from: r.enpProfiles.latestHypervergeTxnId,
				to: r.hypervergeTransactions.id,
			}),
		},
		auditEvents: {
			actor: r.one.users({
				from: r.auditEvents.actorUserId,
				to: r.users.id,
			}),
			subOrg: r.one.subOrgs({
				from: r.auditEvents.subOrgId,
				to: r.subOrgs.id,
			}),
		},
		complianceAccessLog: {
			actor: r.one.users({
				from: r.complianceAccessLog.actorUserId,
				to: r.users.id,
			}),
		},
		complianceExports: {
			actor: r.one.users({
				from: r.complianceExports.actorUserId,
				to: r.users.id,
			}),
			fileObject: r.one.fileObjects({
				from: r.complianceExports.fileObjectId,
				to: r.fileObjects.id,
			}),
		},
		paymentIntents: {
			user: r.one.users({
				from: r.paymentIntents.userId,
				to: r.users.id,
			}),
			adminActor: r.one.users({
				from: r.paymentIntents.adminActorId,
				to: r.users.id,
			}),
			appointment: r.one.appointments({
				from: r.paymentIntents.appointmentId,
				to: r.appointments.id,
			}),
		},
		examVersions: {
			questions: r.many.examQuestions(),
			attempts: r.many.examAttempts(),
		},
		examQuestions: {
			version: r.one.examVersions({
				from: r.examQuestions.examVersionId,
				to: r.examVersions.id,
			}),
			revisions: r.many.examQuestionRevisions(),
		},
		examQuestionRevisions: {
			question: r.one.examQuestions({
				from: r.examQuestionRevisions.questionId,
				to: r.examQuestions.id,
			}),
		},
		examAttempts: {
			user: r.one.users({
				from: r.examAttempts.userId,
				to: r.users.id,
			}),
			version: r.one.examVersions({
				from: r.examAttempts.examVersionId,
				to: r.examVersions.id,
			}),
			paymentIntent: r.one.paymentIntents({
				from: r.examAttempts.paymentIntentId,
				to: r.paymentIntents.id,
			}),
			answers: r.many.examAttemptAnswers(),
		},
		examAttemptAnswers: {
			attempt: r.one.examAttempts({
				from: r.examAttemptAnswers.attemptId,
				to: r.examAttempts.id,
			}),
			question: r.one.examQuestions({
				from: r.examAttemptAnswers.questionId,
				to: r.examQuestions.id,
			}),
		},
		appointments: {
			client: r.one.users({
				from: r.appointments.clientUserId,
				to: r.users.id,
			}),
			enp: r.one.users({
				from: r.appointments.enpUserId,
				to: r.users.id,
			}),
			documents: r.many.appointmentDocuments(),
			sessionRoom: r.one.sessionRooms({
				from: r.appointments.id,
				to: r.sessionRooms.appointmentId,
			}),
			quicksignProject: r.one.quicksignProjects({
				from: r.appointments.id,
				to: r.quicksignProjects.appointmentId,
			}),
			registryActs: r.many.registryActs({
				from: r.appointments.id,
				to: r.registryActs.appointmentId,
			}),
			paymentIntents: r.many.paymentIntents({
				from: r.appointments.id,
				to: r.paymentIntents.appointmentId,
			}),
		},
		quicksignProjects: {
			enp: r.one.users({
				from: r.quicksignProjects.enpUserId,
				to: r.users.id,
			}),
			documentFile: r.one.fileObjects({
				from: r.quicksignProjects.documentFileObjectId,
				to: r.fileObjects.id,
			}),
			appointment: r.one.appointments({
				from: r.quicksignProjects.appointmentId,
				to: r.appointments.id,
			}),
			signers: r.many.quicksignSigners(),
			documentTypes: r.many.quicksignProjectDocumentTypes(),
		},
		quicksignSigners: {
			project: r.one.quicksignProjects({
				from: r.quicksignSigners.projectId,
				to: r.quicksignProjects.id,
			}),
		},
		quicksignProjectDocumentTypes: {
			project: r.one.quicksignProjects({
				from: r.quicksignProjectDocumentTypes.projectId,
				to: r.quicksignProjects.id,
			}),
			documentType: r.one.enpDocumentTypes({
				from: r.quicksignProjectDocumentTypes.enpDocumentTypeId,
				to: r.enpDocumentTypes.id,
			}),
		},
		meetingSignatureRequests: {
			appointment: r.one.appointments({
				from: r.meetingSignatureRequests.appointmentId,
				to: r.appointments.id,
			}),
			documentFile: r.one.fileObjects({
				from: r.meetingSignatureRequests.documentFileObjectId,
				to: r.fileObjects.id,
			}),
			signer: r.one.users({
				from: r.meetingSignatureRequests.signerUserId,
				to: r.users.id,
			}),
		},
		meetingEnbSignatureRequests: {
			appointment: r.one.appointments({
				from: r.meetingEnbSignatureRequests.appointmentId,
				to: r.appointments.id,
			}),
			registryAct: r.one.registryActs({
				from: r.meetingEnbSignatureRequests.registryActId,
				to: r.registryActs.id,
			}),
			signer: r.one.users({
				from: r.meetingEnbSignatureRequests.signerUserId,
				to: r.users.id,
			}),
		},
		appointmentDocuments: {
			appointment: r.one.appointments({
				from: r.appointmentDocuments.appointmentId,
				to: r.appointments.id,
			}),
			fileObject: r.one.fileObjects({
				from: r.appointmentDocuments.fileObjectId,
				to: r.fileObjects.id,
			}),
		},
		documentReviewRequests: {
			client: r.one.users({
				from: r.documentReviewRequests.clientUserId,
				to: r.users.id,
			}),
			enp: r.one.users({
				from: r.documentReviewRequests.enpUserId,
				to: r.users.id,
			}),
			approvedAppointment: r.one.appointments({
				from: r.documentReviewRequests.approvedAppointmentId,
				to: r.appointments.id,
			}),
			files: r.many.documentReviewRequestFiles(),
		},
		documentReviewRequestFiles: {
			reviewRequest: r.one.documentReviewRequests({
				from: r.documentReviewRequestFiles.reviewRequestId,
				to: r.documentReviewRequests.id,
			}),
			fileObject: r.one.fileObjects({
				from: r.documentReviewRequestFiles.fileObjectId,
				to: r.fileObjects.id,
			}),
		},
		enpCommissionApplications: {
			applicant: r.one.users({
				from: r.enpCommissionApplications.applicantUserId,
				to: r.users.id,
			}),
			subOrg: r.one.subOrgs({
				from: r.enpCommissionApplications.subOrgId,
				to: r.subOrgs.id,
			}),
			summaryHearingScheduledBy: r.one.users({
				from: r.enpCommissionApplications.summaryHearingScheduledByUserId,
				to: r.users.id,
			}),
			summaryHearingAppointment: r.one.appointments({
				from: r.enpCommissionApplications.summaryHearingAppointmentId,
				to: r.appointments.id,
			}),
			commissionHearingRoom: r.one.commissionHearingRooms({
				from: r.enpCommissionApplications.summaryHearingRoomId,
				to: r.commissionHearingRooms.id,
			}),
			commission: r.one.enpCommissions({
				from: r.enpCommissionApplications.id,
				to: r.enpCommissions.applicationId,
			}),
			documents: r.many.enpCommissionApplicationDocuments(),
			oppositions: r.many.commissionHearingOppositions(),
		},
		enpCommissions: {
			application: r.one.enpCommissionApplications({
				from: r.enpCommissions.applicationId,
				to: r.enpCommissionApplications.id,
			}),
			enp: r.one.users({
				from: r.enpCommissions.enpUserId,
				to: r.users.id,
			}),
			issuedBy: r.one.users({
				from: r.enpCommissions.issuedByUserId,
				to: r.users.id,
			}),
			certificateFile: r.one.fileObjects({
				from: r.enpCommissions.certificateFileObjectId,
				to: r.fileObjects.id,
			}),
		},
		enpCommissionApplicationDocuments: {
			application: r.one.enpCommissionApplications({
				from: r.enpCommissionApplicationDocuments.applicationId,
				to: r.enpCommissionApplications.id,
			}),
			fileObject: r.one.fileObjects({
				from: r.enpCommissionApplicationDocuments.fileObjectId,
				to: r.fileObjects.id,
			}),
		},
		commissionHearingRooms: {
			application: r.one.enpCommissionApplications({
				from: r.commissionHearingRooms.applicationId,
				to: r.enpCommissionApplications.id,
			}),
			ena: r.one.users({
				from: r.commissionHearingRooms.enaUserId,
				to: r.users.id,
			}),
			applicant: r.one.users({
				from: r.commissionHearingRooms.applicantUserId,
				to: r.users.id,
			}),
			recordingFile: r.one.fileObjects({
				from: r.commissionHearingRooms.recordingFileObjectId,
				to: r.fileObjects.id,
			}),
			oppositions: r.many.commissionHearingOppositions(),
			messages: r.many.commissionHearingMessages(),
			participants: r.many.commissionHearingRoomParticipants(),
		},
		commissionHearingOppositions: {
			application: r.one.enpCommissionApplications({
				from: r.commissionHearingOppositions.applicationId,
				to: r.enpCommissionApplications.id,
			}),
			hearingRoom: r.one.commissionHearingRooms({
				from: r.commissionHearingOppositions.hearingRoomId,
				to: r.commissionHearingRooms.id,
			}),
			oppositor: r.one.users({
				from: r.commissionHearingOppositions.oppositorUserId,
				to: r.users.id,
			}),
			verifiedDocumentFile: r.one.fileObjects({
				from: r.commissionHearingOppositions.verifiedDocumentFileObjectId,
				to: r.fileObjects.id,
			}),
			representativeDocumentFile: r.one.fileObjects({
				from: r.commissionHearingOppositions.representativeDocumentFileObjectId,
				to: r.fileObjects.id,
			}),
		},
		commissionHearingMessages: {
			hearingRoom: r.one.commissionHearingRooms({
				from: r.commissionHearingMessages.hearingRoomId,
				to: r.commissionHearingRooms.id,
			}),
			sender: r.one.users({
				from: r.commissionHearingMessages.senderUserId,
				to: r.users.id,
			}),
		},
		commissionHearingRoomParticipants: {
			hearingRoom: r.one.commissionHearingRooms({
				from: r.commissionHearingRoomParticipants.hearingRoomId,
				to: r.commissionHearingRooms.id,
			}),
			user: r.one.users({
				from: r.commissionHearingRoomParticipants.userId,
				to: r.users.id,
			}),
		},
		sessionRooms: {
			appointment: r.one.appointments({
				from: r.sessionRooms.appointmentId,
				to: r.appointments.id,
			}),
			chatMessages: r.many.sessionMessages(),
			guests: r.many.sessionRoomGuests(),
		},
		sessionMessages: {
			sessionRoom: r.one.sessionRooms({
				from: r.sessionMessages.sessionRoomId,
				to: r.sessionRooms.id,
			}),
			sender: r.one.users({
				from: r.sessionMessages.senderUserId,
				to: r.users.id,
			}),
		},
		sessionRoomGuests: {
			sessionRoom: r.one.sessionRooms({
				from: r.sessionRoomGuests.sessionRoomId,
				to: r.sessionRooms.id,
			}),
			user: r.one.users({
				from: r.sessionRoomGuests.userId,
				to: r.users.id,
			}),
		},
		registryActs: {
			enp: r.one.users({
				from: r.registryActs.enpUserId,
				to: r.users.id,
			}),
			appointment: r.one.appointments({
				from: r.registryActs.appointmentId,
				to: r.appointments.id,
			}),
		},
		dmConversations: {
			lowUser: r.one.users({
				from: r.dmConversations.lowUserId,
				to: r.users.id,
			}),
			highUser: r.one.users({
				from: r.dmConversations.highUserId,
				to: r.users.id,
			}),
			messages: r.many.dmMessages(),
		},
		dmMessages: {
			conversation: r.one.dmConversations({
				from: r.dmMessages.conversationId,
				to: r.dmConversations.id,
			}),
			sender: r.one.users({
				from: r.dmMessages.senderUserId,
				to: r.users.id,
			}),
		},
	})
)

// ============================================================================
// SCHEMA
// ============================================================================
export const schema = Object.assign(
	{
		users,
		sessions,
		accounts,
		verifications,
		emailVerificationOtps,
		todos,
		tickets,
		subOrgs,
		fileObjects,
		hypervergeTransactions,
		clientProfiles,
		enpProfiles,
		auditEvents,
		complianceAccessLog,
		complianceExports,
		maintenanceWindows,
		maintenanceMode,
		paymentIntents,
		examVersions,
		examQuestions,
		examQuestionRevisions,
		examAttempts,
		examAttemptAnswers,
		appointments,
		livenessValidations,
		appointmentDocuments,
		documentReviewRequests,
		documentReviewRequestFiles,
		enpCommissionApplications,
		enpCommissionApplicationDocuments,
		enpCommissions,
		commissionHearingRooms,
		commissionHearingOppositions,
		commissionHearingMessages,
		commissionHearingRoomParticipants,
		enpDocumentTypes,
		appointmentDocumentTypes,
		documentReviewRequestDocumentTypes,
		quicksignProjects,
		quicksignSigners,
		quicksignProjectDocumentTypes,
		ienNotarialAttestations,
		meetingSignatureRequests,
		meetingEnbSignatureRequests,
		sessionRooms,
		sessionMessages,
		sessionRoomGuests,
		registryActs,
		dmConversations,
		dmMessages,
		legalTemplateDrafts,
	},
	relations
)
