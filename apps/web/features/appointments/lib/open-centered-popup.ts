/** Centered popup (~88% viewport) for signing/plotting. */
export function openCenteredPopup(url: string, windowName: string): Window | null {
	const w = Math.min(1280, Math.floor(window.screen.width * 0.88))
	const h = Math.min(900, Math.floor(window.screen.height * 0.9))
	const left = Math.max(0, Math.floor((window.screen.width - w) / 2))
	const top = Math.max(0, Math.floor((window.screen.height - h) / 2))
	return window.open(
		url,
		windowName,
		`noopener,noreferrer,width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
	)
}
