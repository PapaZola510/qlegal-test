export interface NotificationPreferences {
	appointmentReminders: boolean
	documentUpdates: boolean
	sessionAlerts: boolean
	emailDigest: boolean
}

const STORAGE_KEY = "qlegal-notification-preferences"

export const defaultNotificationPreferences: NotificationPreferences = {
	appointmentReminders: true,
	documentUpdates: true,
	sessionAlerts: true,
	emailDigest: false,
}

export function loadNotificationPreferences(): NotificationPreferences {
	if (typeof window === "undefined") return defaultNotificationPreferences
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY)
		if (!raw) return defaultNotificationPreferences
		const parsed = JSON.parse(raw) as Partial<NotificationPreferences>
		return { ...defaultNotificationPreferences, ...parsed }
	} catch {
		return defaultNotificationPreferences
	}
}

export function saveNotificationPreferences(prefs: NotificationPreferences): void {
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}
