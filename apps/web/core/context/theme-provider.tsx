"use client"

import {
	createContext,
	useCallback,
	useContext,
	type ReactNode,
} from "react"
import { flushSync } from "react-dom"
import {
	ThemeProvider as NextThemesProvider,
	useTheme,
	type ThemeProviderProps,
} from "next-themes"

type ThemeTransitionContextValue = {
	setThemeWithTransition: (theme: string) => void
}

const ThemeTransitionContext = createContext<ThemeTransitionContextValue | null>(null)

const THEME_TRANSITION_MS = 320
const THEME_TRANSITION_EASING = "cubic-bezier(0.33, 1, 0.68, 1)"

function shouldAnimateThemeChange() {
	if (typeof window === "undefined") return false
	return !window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function resolveAppliedTheme(theme: string): "light" | "dark" {
	if (theme === "system") {
		return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
	}
	return theme === "light" ? "light" : "dark"
}

/** next-themes updates the DOM in an effect; view transitions need a sync class swap. */
function applyThemeToDocument(theme: string) {
	const root = document.documentElement
	const applied = resolveAppliedTheme(theme)
	root.classList.remove("light", "dark")
	root.classList.add(applied)
}

function runOverlayTransition(update: () => void) {
	const root = document.documentElement
	const overlay = document.createElement("div")
	overlay.className = "theme-transition-overlay"
	overlay.setAttribute("aria-hidden", "true")

	const previousBg = getComputedStyle(document.body).backgroundColor
	if (previousBg) {
		overlay.style.backgroundColor = previousBg
	}

	document.body.appendChild(overlay)
	root.classList.add("theme-transition-active")

	update()

	void overlay
		.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: THEME_TRANSITION_MS,
			easing: THEME_TRANSITION_EASING,
			fill: "forwards",
		})
		.finished.finally(() => {
			overlay.remove()
			root.classList.remove("theme-transition-active")
		})
}

function applyThemeWithTransition(setTheme: (theme: string) => void, theme: string) {
	const root = document.documentElement

	const update = () => {
		applyThemeToDocument(theme)
		flushSync(() => {
			setTheme(theme)
		})
	}

	if (!shouldAnimateThemeChange()) {
		update()
		return
	}

	if (typeof document.startViewTransition === "function") {
		root.classList.add("theme-transition-active")

		const transition = document.startViewTransition(update)

		void transition.finished.finally(() => {
			root.classList.remove("theme-transition-active")
		})
		return
	}

	runOverlayTransition(update)
}

function ThemeTransitionBridge({ children }: { children: ReactNode }) {
	const { setTheme } = useTheme()

	const setThemeWithTransition = useCallback(
		(theme: string) => {
			applyThemeWithTransition(setTheme, theme)
		},
		[setTheme]
	)

	return (
		<ThemeTransitionContext.Provider value={{ setThemeWithTransition }}>
			{children}
		</ThemeTransitionContext.Provider>
	)
}

export function useThemeTransition() {
	const context = useContext(ThemeTransitionContext)
	const themeApi = useTheme()

	return {
		...themeApi,
		setTheme: context?.setThemeWithTransition ?? themeApi.setTheme,
	}
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
	return (
		<NextThemesProvider {...props}>
			<ThemeTransitionBridge>{children}</ThemeTransitionBridge>
		</NextThemesProvider>
	)
}
