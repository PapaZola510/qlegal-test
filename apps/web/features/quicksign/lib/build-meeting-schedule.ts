/** Build an ISO datetime from optional date/time fields (local browser values). */
export function buildScheduledAtIso(date: string, time: string): string {
	if (!date.trim()) {
		return new Date().toISOString()
	}
	const timePart = time.trim() || "09:00"
	const parsed = new Date(`${date}T${timePart}`)
	if (Number.isNaN(parsed.getTime())) {
		return new Date().toISOString()
	}
	return parsed.toISOString()
}
