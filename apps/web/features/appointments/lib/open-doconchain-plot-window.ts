/** Opens DocOnChain in a new browser tab (not a sized popup). */
export function openDoconchainTab(url: string): Window | null {
	return window.open(url, "_blank")
}

/** @deprecated Use {@link openDoconchainTab}. */
export const openDoconchainPlotTab = openDoconchainTab

/** @deprecated Use {@link openDoconchainTab}. */
export const openDoconchainPlotPopup = openDoconchainTab
