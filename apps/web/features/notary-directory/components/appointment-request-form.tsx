"use client"

import * as React from "react"

import type { UserProfile } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/core/components/ui/select"
import { Textarea } from "@/core/components/ui/textarea"
import { useCreateAppointmentMutation } from "@/features/appointments/api/appointments.hooks"
import { useAuthProfileMeQuery } from "@/features/dashboard/api/dashboard.hooks"
import {
	DocumentsUploadStep,
	type UploadedDocument,
} from "@/features/document-review/components/documents-upload-step"
import { useEnpDocumentTypesForEnpQuery } from "@/features/enp-document-types/api/enp-document-types.hooks"
import { EnpDocumentTypeMultiSelect } from "@/features/enp-document-types/components/enp-document-type-multi-select"
import { ProfileKycRequiredCard } from "@/features/kyc/components/profile-kyc-required-card"
import { isProfileKycVerified } from "@/features/kyc/lib/profile-kyc-gate"

import {
	createEmptyRequest,
	SESSION_MODES,
	type AppointmentRequest,
	type NotaryProfile,
	type SessionMode,
} from "../lib/fixtures"

interface AppointmentRequestFormProps {
	notary: NotaryProfile
	onCancel: () => void
	onSubmitted: () => void
}

function toApiSessionMode(mode: SessionMode): "remote" | "in_person" | "hybrid" {
	return mode === "in-person" ? "in_person" : mode
}

function resolveScheduledAt(date: string, time: string): string {
	// Date/time are optional in booking; default to the next full hour when omitted.
	if (date && time) {
		return new Date(`${date}T${time}:00`).toISOString()
	}
	const fallback = new Date()
	fallback.setMinutes(0, 0, 0)
	fallback.setHours(fallback.getHours() + 1)
	return fallback.toISOString()
}

function mutationErrorMessage(error: unknown): string {
	if (!error || typeof error !== "object")
		return "Unable to book appointment right now. Please try again."
	const maybeMessage = (error as { message?: unknown }).message
	if (typeof maybeMessage === "string" && maybeMessage.trim()) return maybeMessage
	const shape = error as { data?: { message?: unknown } }
	if (typeof shape.data?.message === "string" && shape.data.message.trim())
		return shape.data.message
	return "Unable to book appointment right now. Please try again."
}

export function AppointmentRequestForm({
	notary,
	onCancel,
	onSubmitted,
}: AppointmentRequestFormProps) {
	const [form, setForm] = React.useState<AppointmentRequest>(createEmptyRequest)
	const [selectedTypeIds, setSelectedTypeIds] = React.useState<string[]>([])
	const [uploadedDocs, setUploadedDocs] = React.useState<UploadedDocument[]>([])
	const createAppointment = useCreateAppointmentMutation()
	const profileQ = useAuthProfileMeQuery()
	const profile = profileQ.data as UserProfile | undefined
	const kycVerified = isProfileKycVerified(profile?.identityStatus)
	const docTypesQ = useEnpDocumentTypesForEnpQuery(notary.id)

	function patch(updates: Partial<AppointmentRequest>) {
		setForm(prev => ({ ...prev, ...updates }))
	}
	const typeIds = selectedTypeIds.filter(Boolean)
	const isValid =
		form.title.trim() !== "" && form.mode !== "" && typeIds.length > 0 && uploadedDocs.length > 0

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (!kycVerified || !isValid || createAppointment.isPending) return

		const mode = form.mode as SessionMode
		const title = form.title.trim()

		createAppointment.mutate(
			{
				enpId: notary.id,
				title,
				description: form.purposeNote.trim() || undefined,
				scheduledAt: resolveScheduledAt(form.date, form.time),
				durationMinutes: 60,
				/** Booking no longer collects act type; ENP sets act at document upload. */
				notarizationType: "acknowledgment",
				sessionMode: toApiSessionMode(mode),
				documentTypeIds: typeIds,
				bookingDocuments: uploadedDocs.map(doc => ({
					fileObjectId: doc.fileObjectId,
					displayName: doc.displayName,
				})),
			},
			{
				onSuccess: () => onSubmitted(),
			}
		)
	}

	if (profileQ.isLoading) {
		return <p className="text-muted-foreground text-sm">Loading your profile…</p>
	}

	if (profile && !kycVerified) {
		return <ProfileKycRequiredCard profile={profile} context="booking" />
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm">
					Request Appointment — {notary.firstName} {notary.lastName}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1.5">
							<Label htmlFor="req-title">Title</Label>
							<Input
								id="req-title"
								placeholder="e.g. Affidavit, SPA, contract review"
								value={form.title}
								onChange={e => patch({ title: e.target.value })}
								autoComplete="off"
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="req-mode">Session Mode</Label>
							<Select
								value={form.mode}
								onValueChange={v => {
									patch({ mode: v as SessionMode })
								}}
							>
								<SelectTrigger id="req-mode" className="w-full">
									{form.mode ? (
										<SelectValue />
									) : (
										<span className="text-muted-foreground">Select session mode</span>
									)}
								</SelectTrigger>
								<SelectContent>
									{SESSION_MODES.filter(m => notary.availableModes.includes(m.value)).map(m => (
										<SelectItem key={m.value} value={m.value}>
											{m.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1.5">
							<Label htmlFor="req-date">Preferred Date</Label>
							<Input
								id="req-date"
								type="date"
								value={form.date}
								onChange={e => patch({ date: e.target.value })}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="req-time">Preferred Time</Label>
							<Input
								id="req-time"
								type="time"
								value={form.time}
								onChange={e => patch({ time: e.target.value })}
							/>
						</div>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="req-purpose">Purpose / Notes</Label>
						<Textarea
							id="req-purpose"
							placeholder="Briefly describe the documents or purpose of this notarization…"
							value={form.purposeNote}
							onChange={e => patch({ purposeNote: e.target.value })}
							rows={3}
						/>
					</div>

					<EnpDocumentTypeMultiSelect
						label="Document type(s)"
						description={
							<p className="text-muted-foreground text-xs">
								Select at least one of the notary&apos;s priced document types.
							</p>
						}
						types={docTypesQ.data}
						isLoading={docTypesQ.isLoading}
						isError={docTypesQ.isError}
						emptyMessage="This notary is not accepting bookings yet."
						selectedIds={selectedTypeIds}
						onSelectedIdsChange={setSelectedTypeIds}
					/>

					<div className="space-y-1.5">
						<Label>Documents to notarize</Label>
						<p className="text-muted-foreground text-xs">
							Upload the PDFs your notary will review. They will propose the notarial act and fee
							for each file.
						</p>
						<DocumentsUploadStep
							notaryId={notary.id}
							uploaded={uploadedDocs}
							onChange={setUploadedDocs}
						/>
					</div>

					{createAppointment.isError && (
						<p className="text-destructive text-xs">
							{mutationErrorMessage(createAppointment.error)}
						</p>
					)}

					<div className="flex justify-end gap-2 pt-2">
						<Button type="button" variant="outline" onClick={onCancel}>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={!kycVerified || !isValid || createAppointment.isPending}
						>
							{createAppointment.isPending ? "Submitting..." : "Submit Request"}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	)
}
