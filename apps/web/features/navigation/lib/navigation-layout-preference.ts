export type NavigationLayout = "sidebar" | "header"

const STORAGE_KEY = "qlegal-navigation-layout"
const LAYOUT_CHANGE_EVENT = "qlegal-navigation-layout-change"

export const defaultNavigationLayout: NavigationLayout = "sidebar"

export function isMeetingSessionPath(pathname: string): boolean {
	return /^\/appointments\/[^/]+\/meeting\/?$/.test(pathname)
}

export function loadNavigationLayout(): NavigationLayout {
	if (typeof window === "undefined") return defaultNavigationLayout
	try {
		const value = window.localStorage.getItem(STORAGE_KEY)
		if (value === "sidebar" || value === "header") return value
	} catch {
		// ignore
	}
	return defaultNavigationLayout
}

export function saveNavigationLayout(layout: NavigationLayout): void {
	window.localStorage.setItem(STORAGE_KEY, layout)
	window.dispatchEvent(new CustomEvent(LAYOUT_CHANGE_EVENT, { detail: layout }))
}

export function subscribeNavigationLayout(onStoreChange: () => void): () => void {
	const onCustom = () => onStoreChange()
	const onStorage = (event: StorageEvent) => {
		if (event.key === STORAGE_KEY) onStoreChange()
	}
	window.addEventListener(LAYOUT_CHANGE_EVENT, onCustom)
	window.addEventListener("storage", onStorage)
	return () => {
		window.removeEventListener(LAYOUT_CHANGE_EVENT, onCustom)
		window.removeEventListener("storage", onStorage)
	}
}
