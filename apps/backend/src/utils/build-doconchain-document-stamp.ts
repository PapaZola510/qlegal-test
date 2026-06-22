/**
 * DocOnChain `document_stamp` payload for SC electronic notarial seal.
 *
 * DocOnChain renders each `notary_info` field on fixed footer lines. Fields that are
 * not shown on the accepted seal layout must be sent as empty strings — otherwise
 * roll date, IBP date, etc. print on top of the combined lines and overlap.
 *
 * Accepted footer lines only:
 * ENP name · Roll no. · Commission no. & validity · PTR · IBP no. · Email · Address · MCLE · Mode
 *
 * DocOnChain `notary_info` keys: `email_address`, `business_address`, `MCLE_no`, `MCLE_no_date_valid`,
 * `MCLE_no_date_until`, `MCLE_no_period` (plus legacy `email` / `address` / `MCLE_no_date`).
 */

export type DoconchainEnpStampRow = {
	prefix: string | null
	firstName: string
	lastName: string
	suffix: string | null
	email: string
	rollNo: string | null
	rollDate: Date | null
	npnCommissionNo: string | null
	commissionValidUntil: Date | null
	ptrNo: string | null
	ptrLocation: string | null
	ptrDate: Date | null
	ibpNo: string | null
	ibpDate: string | null
	mcleNo: string | null
	mclePeriod: string | null
	mcleDate: Date | null
	notaryAddress: string | null
}

export type DoconchainMcleStampFields = {
	MCLE_no: string
	/** Legacy single date key (some DC builds still read this). */
	MCLE_no_date: string
	MCLE_no_period: string
	/** DocOnChain ENTERPRISE_API create-project: compliance date valid from. */
	MCLE_no_date_valid: string
	/** DocOnChain ENTERPRISE_API create-project: compliance valid until / admission (exempt). */
	MCLE_no_date_until: string
}

function str(v: string | null | undefined): string {
	if (v === null || v === undefined) return ""
	return String(v).trim()
}

function toUtcDate(d: Date | null | undefined): Date | null {
	if (!d) return null
	const t = d instanceof Date ? d : new Date(d)
	if (Number.isNaN(t.getTime())) return null
	return t
}

/** DocOnChain sample: `5 June 2018` (stored in profile; not rendered on accepted seal footer). */
export function formatDcRollDate(d: Date | null | undefined): string {
	const t = toUtcDate(d)
	if (!t) return ""
	const months = [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	] as const
	return `${t.getUTCDate()} ${months[t.getUTCMonth()]} ${t.getUTCFullYear()}`
}

/** Seal footer commission validity: `2025-03-13` (`YYYY-MM-DD`). */
export function formatDcCommissionValidUntil(d: Date | null | undefined): string {
	const t = toUtcDate(d)
	if (!t) return ""
	const year = t.getUTCFullYear()
	const month = String(t.getUTCMonth() + 1).padStart(2, "0")
	const day = String(t.getUTCDate()).padStart(2, "0")
	return `${year}-${month}-${day}`
}

/** Seal footer PTR / MCLE dates: `09/30/2025` (`MM/DD/YYYY`). */
export function formatDcPtrOrMcleDate(d: Date | null | undefined): string {
	const t = toUtcDate(d)
	if (!t) return ""
	const month = String(t.getUTCMonth() + 1).padStart(2, "0")
	const day = String(t.getUTCDate()).padStart(2, "0")
	const year = t.getUTCFullYear()
	return `${month}/${day}/${year}`
}

/** Pass-through or normalize MCLE compliance note (e.g. `Valid until 12/30/2026`). */
export function formatDcMcleComplianceNote(value: string | null | undefined): string {
	const raw = str(value)
	if (!raw) return ""
	if (/^valid until/i.test(raw)) return raw
	if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
		return `Valid until ${formatDcPtrOrMcleDate(new Date(`${raw}T12:00:00.000Z`))}`
	}
	return raw
}

export function isMcleExemptNote(value: string | null | undefined): boolean {
	return /exempt/i.test(str(value))
}

/** Parses `Valid until MM/DD/YYYY` (or ISO) from MCLE compliance note for `MCLE_no_date_until`. */
export function parseValidUntilFromMcleNote(value: string | null | undefined): string {
	const raw = str(value)
	if (!raw) return ""

	const slash = raw.match(/valid until\s+(\d{1,2}\/\d{1,2}\/\d{4})/i)
	if (slash?.[1]) return slash[1]

	const iso = raw.match(/valid until\s+(\d{4}-\d{2}-\d{2})/i)
	if (iso?.[1]) return formatDcPtrOrMcleDate(new Date(`${iso[1]}T12:00:00.000Z`))

	return formatDcMcleComplianceNote(raw)
		.replace(/^valid until\s+/i, "")
		.trim()
}

const MONTH_NAME_TO_INDEX: Record<string, number> = {
	january: 0,
	february: 1,
	march: 2,
	april: 3,
	may: 4,
	june: 5,
	july: 6,
	august: 7,
	september: 8,
	october: 9,
	november: 10,
	december: 11,
}

/** Parse bar admission date from profile exempt wording for compact seal lines. */
export function parseAdmissionDateFromExemptNote(note: string | null | undefined): Date | null {
	const raw = str(note)
	if (!raw) return null

	const iso = raw.match(/\b(\d{4}-\d{2}-\d{2})\b/)
	if (iso?.[1]) {
		const d = new Date(`${iso[1]}T12:00:00.000Z`)
		return Number.isNaN(d.getTime()) ? null : d
	}

	const dmy = raw.match(
		/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i
	)
	if (dmy?.[1] && dmy[2] && dmy[3]) {
		const month = MONTH_NAME_TO_INDEX[dmy[2].toLowerCase()]
		if (month !== undefined) {
			return new Date(Date.UTC(Number(dmy[3]), month, Number(dmy[1]), 12, 0, 0))
		}
	}

	const mdy = raw.match(
		/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i
	)
	if (mdy?.[1] && mdy[2] && mdy[3]) {
		const month = MONTH_NAME_TO_INDEX[mdy[1].toLowerCase()]
		if (month !== undefined) {
			return new Date(Date.UTC(Number(mdy[3]), month, Number(mdy[2]), 12, 0, 0))
		}
	}

	return null
}

/** DocOnChain seal box is fixed-width — keep each segment short to avoid border overflow. */
export function truncateSealField(value: string, maxLength: number): string {
	const raw = str(value)
	if (raw.length <= maxLength) return raw
	if (maxLength <= 1) return raw.slice(0, maxLength)
	return `${raw.slice(0, maxLength - 1)}…`
}

/**
 * MCLE footer: DocOnChain combines `MCLE_no`, `MCLE_no_date_valid`, `MCLE_no_date_until`, and `MCLE_no_period`.
 * Exempt: number `Exempt`, compliance date from profile, until/admission from exempt note, note in `MCLE_no_period`.
 * Compliant: number + valid date + until date + optional period/note.
 */
export function resolveDoconchainMcleStampFields(
	enp: Pick<DoconchainEnpStampRow, "mcleNo" | "mclePeriod" | "mcleDate">
): DoconchainMcleStampFields {
	const validFrom = formatDcPtrOrMcleDate(enp.mcleDate)

	if (isMcleExemptNote(enp.mclePeriod)) {
		const admission = parseAdmissionDateFromExemptNote(enp.mclePeriod) ?? toUtcDate(enp.mcleDate)
		const until = formatDcPtrOrMcleDate(admission)
		// DocOnChain footer: `{MCLE_no} & {MCLE_no_date_valid} & {MCLE_no_period}` (often also reads
		// `MCLE_no_date_until`). Keep the third segment compact — full exempt prose stays in profile only.
		const note = until ? `Valid until ${until}` : truncateSealField(str(enp.mclePeriod), 28)
		return {
			MCLE_no: "Exempt",
			MCLE_no_date: validFrom || until,
			MCLE_no_date_valid: validFrom,
			MCLE_no_date_until: until,
			MCLE_no_period: note,
		}
	}

	const note = formatDcMcleComplianceNote(enp.mclePeriod)
	const until = parseValidUntilFromMcleNote(enp.mclePeriod)
	return {
		MCLE_no: truncateSealField(str(enp.mcleNo), 16),
		MCLE_no_date: validFrom || until,
		MCLE_no_date_valid: validFrom,
		MCLE_no_date_until: until,
		MCLE_no_period: truncateSealField(note, 28),
	}
}

function stripAttorneyPrefix(value: string): string {
	return value.replace(/^atty\.?\s+/i, "").trim()
}

function titleCaseWord(word: string): string {
	if (!word) return word
	return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

/** Seal `ENP NAME` — title case, no `ATTY.` prefix. */
export function formatEnpSealName(
	row: Pick<DoconchainEnpStampRow, "prefix" | "firstName" | "lastName" | "suffix">
): string {
	const prefix = str(row.prefix)
	const parts: string[] = []
	if (prefix && !/^atty\.?$/i.test(prefix.replace(/\./g, "").trim())) {
		parts.push(prefix)
	}
	if (row.firstName) parts.push(stripAttorneyPrefix(row.firstName))
	if (row.lastName) parts.push(stripAttorneyPrefix(row.lastName))
	if (row.suffix) parts.push(row.suffix)
	const joined = parts.join(" ").trim() || "ENP"
	return joined.split(/\s+/).map(titleCaseWord).join(" ")
}

export type AppointmentSessionMode = "remote" | "in_person" | "hybrid"

/** `REN` (remote/hybrid) vs `IEN` (in-person). */
export function resolveDoconchainModeOfNotarization(
	sessionMode?: AppointmentSessionMode | null
): "REN" | "IEN" {
	if (sessionMode === "in_person") return "IEN"
	return "REN"
}

export function buildDoconchainDocumentStampJson(
	enp: DoconchainEnpStampRow,
	options?: {
		modeOfNotarization?: string
		sessionMode?: AppointmentSessionMode | null
		/** ENB entry number (SC format) — embedded on the notarial seal metadata when known. */
		entryNumber?: string | null
	}
): string {
	const sealName = formatEnpSealName(enp)
	const roll = str(enp.rollNo)
	const commission = str(enp.npnCommissionNo)
	const enpRoleNumber = roll || commission
	const mcle = resolveDoconchainMcleStampFields(enp)
	const email = truncateSealField(str(enp.email), 48)
	const businessAddress = truncateSealField(str(enp.notaryAddress), 56)

	const explicit = str(options?.modeOfNotarization)
	const mode = explicit || resolveDoconchainModeOfNotarization(options?.sessionMode)
	const entryNumber = truncateSealField(str(options?.entryNumber), 32)

	const stamp = {
		seal: {
			type: "seal",
			enp_name: sealName,
			enp_role_number: enpRoleNumber,
		},
		notary_info: {
			type: "notary",
			atty_name: sealName,
			roll_no: roll,
			/** Not on accepted seal footer — must stay empty to avoid overlapping roll line. */
			roll_no_date: "",
			commission_no: commission,
			commission_no_valid_until: formatDcCommissionValidUntil(enp.commissionValidUntil),
			PTR_no: str(enp.ptrNo),
			PTR_no_location: truncateSealField(str(enp.ptrLocation), 24),
			PTR_no_date: formatDcPtrOrMcleDate(enp.ptrDate),
			IBP_no: str(enp.ibpNo),
			/** Not on accepted seal footer — must stay empty to avoid overlapping IBP line. */
			IBP_no_date: "",
			/** DocOnChain ENTERPRISE_API canonical keys (footer: ENP email / business address). */
			email_address: email,
			business_address: businessAddress,
			/** Legacy aliases retained for older DC portal builds. */
			email,
			address: businessAddress,
			MCLE_no_period: mcle.MCLE_no_period,
			MCLE_no: mcle.MCLE_no,
			MCLE_no_date: mcle.MCLE_no_date,
			MCLE_no_date_valid: mcle.MCLE_no_date_valid,
			MCLE_no_date_until: mcle.MCLE_no_date_until,
			mode_of_notarization: mode,
			entry_number: entryNumber,
			notarial_entry_number: entryNumber,
		},
	}

	return JSON.stringify(stamp)
}

/** Row shape from `enp_profiles` + `users.email` join for DocOnChain project creation. */
export type EnpDoconchainStampDbRow = {
	prefix: string | null
	firstName: string
	lastName: string
	suffix: string | null
	email: string
	rollNo: string | null
	rollDate: Date | null
	npnCommissionNo: string | null
	commissionValidUntil: Date | null
	ptrNo: string | null
	ptrLocation: string | null
	ptrDate: Date | null
	ibpNo: string | null
	ibpDate: string | null
	mcleNo: string | null
	mclePeriod: string | null
	mcleDate: Date | null
	notaryAddress: string | null
}

export function mapEnpRowToDoconchainStampRow(row: EnpDoconchainStampDbRow): DoconchainEnpStampRow {
	return {
		prefix: row.prefix,
		firstName: row.firstName,
		lastName: row.lastName,
		suffix: row.suffix,
		email: row.email,
		rollNo: row.rollNo,
		rollDate: row.rollDate,
		npnCommissionNo: row.npnCommissionNo,
		commissionValidUntil: row.commissionValidUntil,
		ptrNo: row.ptrNo,
		ptrLocation: row.ptrLocation,
		ptrDate: row.ptrDate,
		ibpNo: row.ibpNo,
		ibpDate: row.ibpDate,
		mcleNo: row.mcleNo,
		mclePeriod: row.mclePeriod,
		mcleDate: row.mcleDate,
		notaryAddress: row.notaryAddress,
	}
}

export function buildDoconchainStampJsonFromEnpRow(
	row: EnpDoconchainStampDbRow,
	options?: {
		modeOfNotarization?: string
		sessionMode?: AppointmentSessionMode | null
		entryNumber?: string | null
	}
): string {
	return buildDoconchainDocumentStampJson(mapEnpRowToDoconchainStampRow(row), options)
}
