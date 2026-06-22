"use client"

import * as React from "react"
import { useSyncExternalStore } from "react"

import {
	defaultNavigationLayout,
	loadNavigationLayout,
	saveNavigationLayout,
	subscribeNavigationLayout,
	type NavigationLayout,
} from "@/features/navigation/lib/navigation-layout-preference"

interface NavigationLayoutContextValue {
	layout: NavigationLayout
	setLayout: (layout: NavigationLayout) => void
}

const NavigationLayoutContext = React.createContext<NavigationLayoutContextValue | null>(null)

function useNavigationLayoutSnapshot(): NavigationLayout {
	return useSyncExternalStore(
		subscribeNavigationLayout,
		loadNavigationLayout,
		() => defaultNavigationLayout
	)
}

export function NavigationLayoutProvider({ children }: { children: React.ReactNode }) {
	const layout = useNavigationLayoutSnapshot()

	const setLayout = React.useCallback((next: NavigationLayout) => {
		saveNavigationLayout(next)
	}, [])

	const value = React.useMemo(() => ({ layout, setLayout }), [layout, setLayout])

	return (
		<NavigationLayoutContext.Provider value={value}>{children}</NavigationLayoutContext.Provider>
	)
}

export function useNavigationLayout(): NavigationLayoutContextValue {
	const context = React.useContext(NavigationLayoutContext)
	const layout = useNavigationLayoutSnapshot()

	if (!context) {
		return {
			layout,
			setLayout: saveNavigationLayout,
		}
	}

	return context
}
