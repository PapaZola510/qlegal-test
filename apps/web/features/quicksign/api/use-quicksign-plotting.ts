"use client"

import * as React from "react"
import { toast } from "sonner"

import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"

import {
	useCompleteQuicksignPlottingMutation,
	useQuicksignPlotLinkMutation,
} from "./quicksign.hooks"

export function useQuicksignPlotting(args: {
	projectId: string | null
	documentName: string | null
	onPlotterOpened?: () => void
	onPlottingComplete: () => void
}) {
	const plotLinkMutation = useQuicksignPlotLinkMutation()
	const completePlotting = useCompleteQuicksignPlottingMutation()

	const [localSigningOpen, setLocalSigningOpen] = React.useState(false)
	const [isOpeningPlotter, setIsOpeningPlotter] = React.useState(false)
	const [isConfirmingPlot, setIsConfirmingPlot] = React.useState(false)
	const [plotterOpened, setPlotterOpened] = React.useState(false)

	const openPlotter = React.useCallback(async () => {
		const projectId = args.projectId
		if (!projectId) return

		setIsOpeningPlotter(true)

		try {
			const result = await plotLinkMutation.mutateAsync(projectId)
			if (!result.plotLink?.trim()) {
				toast.error("Could not load the plotter link.")
				return
			}

			setPlotterOpened(true)
			setLocalSigningOpen(true)
			args.onPlotterOpened?.()
		} catch (e) {
			toast.error(getOrpcMutationErrorMessage(e, "Could not open the plotter."))
		} finally {
			setIsOpeningPlotter(false)
		}
	}, [args, plotLinkMutation])

	const handleLocalSigningStamped = React.useCallback(async () => {
		const projectId = args.projectId
		if (!projectId) return

		setIsConfirmingPlot(true)
		try {
			await completePlotting.mutateAsync(projectId)
			setLocalSigningOpen(false)
			toast.success("Document marked as plotted. Continue to schedule your QuickSign session.")
			args.onPlottingComplete()
		} catch (e) {
			toast.error(getOrpcMutationErrorMessage(e, "Could not confirm plotting."))
		} finally {
			setIsConfirmingPlot(false)
		}
	}, [args, completePlotting])

	return {
		openPlotter,
		isOpeningPlotter,
		plotterOpened,
		localSigningOpen,
		setLocalSigningOpen,
		isConfirmingPlot,
		handleLocalSigningStamped,
		plotConfirmDocumentName: args.documentName,
	}
}
