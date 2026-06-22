/** Postgres / driver edge cases can surface as Date objects whose getTime() is NaN — never treat those as real instants. */
export function isValidDate(d: unknown): d is Date {
	return d instanceof Date && !Number.isNaN(d.getTime())
}

export function dateToIsoOrNull(d: Date | null | undefined): string | null {
	if (!isValidDate(d)) return null
	return d.toISOString()
}

/** Fallback epoch only for NOT NULL columns that must serialize (avoids crashing JSON / Zod pipelines). */
export function dateToIsoOrEpoch(d: Date | null | undefined): string {
	if (!isValidDate(d)) return new Date(0).toISOString()
	return d.toISOString()
}

/** Drizzle timestamps must be serializable Dates; Invalid Date breaks JSON/OpenAPI codecs. */
export function ensureSerializableDate(d: Date): Date {
	return isValidDate(d) ? d : new Date(0)
}

export function calendarYmdFromDate(d: Date | null | undefined): string | null {
	const iso = dateToIsoOrNull(d)
	return iso ? iso.slice(0, 10) : null
}
