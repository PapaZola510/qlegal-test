import { index } from "drizzle-orm/pg-core"

import { createTable } from "../utils/table.js"

/**
 * Mirror of `registry_acts` rows in the ENB backup database (separate PostgreSQL instance).
 * Updated on each primary-registry write; not exposed on the primary app database.
 */
export const enbBackupRegistryActs = createTable(
	"enb_backup_registry_acts",
	t => ({
		sourceActId: t.text("source_act_id").primaryKey(),
		enpUserId: t.text("enp_user_id").notNull(),
		appointmentId: t.text("appointment_id"),
		actNumber: t.text("act_number").notNull(),
		actType: t.text("act_type").notNull(),
		title: t.text("title").notNull(),
		parties: t.jsonb("parties").notNull().$type<{ name: string; role: string }[]>(),
		executedAt: t.timestamp("executed_at").notNull(),
		documentUrl: t.text("document_url"),
		bookNo: t.text("book_no"),
		pageNo: t.text("page_no"),
		feePhp: t.integer("fee_php"),
		description: t.text("description"),
		scStatus: t.text("sc_status").notNull(),
		scSubmittedAt: t.timestamp("sc_submitted_at"),
		scSyncedAt: t.timestamp("sc_synced_at"),
		scRejectionReason: t.text("sc_rejection_reason"),
		scExternalRef: t.text("sc_external_ref"),
		entryNumber: t.text("entry_number"),
		completionStatus: t.text("completion_status").notNull().default("completed"),
		incompleteReason: t.text("incomplete_reason"),
		incompleteCircumstances: t.text("incomplete_circumstances"),
		sourceCreatedAt: t.timestamp("source_created_at").notNull(),
		sourceUpdatedAt: t.timestamp("source_updated_at").notNull(),
		backedUpAt: t.timestamp("backed_up_at").notNull().defaultNow(),
	}),
	t => [
		index("enb_backup_registry_acts_enp_user_id_idx").on(t.enpUserId),
		index("enb_backup_registry_acts_book_no_idx").on(t.bookNo),
	]
)

export const enbBackupSchema = {
	enbBackupRegistryActs,
}
