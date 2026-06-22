"use client"

import * as React from "react"

import { Button } from "@/core/components/ui/button"
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

import {
	MAX_PROPOSED_SLOTS,
	NOTARIZATION_TYPE_OPTIONS,
	SESSION_MODE_OPTIONS,
	type WizardNotarizationType,
	type WizardSessionMode,
} from "../lib/constants"

export interface DetailsFormValue {
	title: string
	note: string
	notarizationType: WizardNotarizationType | ""
	sessionMode: WizardSessionMode
	slots: { date: string; time: string }[]
}

interface DetailsStepProps {
	value: DetailsFormValue
	onChange: (next: DetailsFormValue) => void
}

export function DetailsStep({ value, onChange }: DetailsStepProps) {
	function patch(updates: Partial<DetailsFormValue>) {
		onChange({ ...value, ...updates })
	}

	function patchSlot(index: number, updates: Partial<{ date: string; time: string }>) {
		const nextSlots = value.slots.map((s, i) => (i === index ? { ...s, ...updates } : s))
		patch({ slots: nextSlots })
	}

	function addSlot() {
		if (value.slots.length >= MAX_PROPOSED_SLOTS) return
		patch({ slots: [...value.slots, { date: "", time: "" }] })
	}

	function removeSlot(index: number) {
		patch({ slots: value.slots.filter((_, i) => i !== index) })
	}

	return (
		<div className="space-y-5">
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-1.5">
					<Label htmlFor="dr-title">Title</Label>
					<Input
						id="dr-title"
						placeholder="e.g. Deed of Sale, Affidavit, SPA"
						value={value.title}
						onChange={e => patch({ title: e.target.value })}
						autoComplete="off"
					/>
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="dr-mode">Preferred Session Mode</Label>
					<Select
						value={value.sessionMode}
						onValueChange={v => patch({ sessionMode: v as WizardSessionMode })}
					>
						<SelectTrigger id="dr-mode" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{SESSION_MODE_OPTIONS.map(m => (
								<SelectItem key={m.value} value={m.value}>
									{m.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			<div className="space-y-1.5">
				<Label htmlFor="dr-type">Notarization Type (optional)</Label>
				<Select
					value={value.notarizationType || "__unset__"}
					onValueChange={v =>
						patch({
							notarizationType: v === "__unset__" ? "" : (v as WizardNotarizationType),
						})
					}
				>
					<SelectTrigger id="dr-type" className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="__unset__">Let the notary decide</SelectItem>
						{NOTARIZATION_TYPE_OPTIONS.map(t => (
							<SelectItem key={t.value} value={t.value}>
								{t.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="space-y-1.5">
				<Label htmlFor="dr-note">Notes for the notary (optional)</Label>
				<Textarea
					id="dr-note"
					placeholder="Anything the notary should know before reviewing your document..."
					value={value.note}
					onChange={e => patch({ note: e.target.value })}
					rows={3}
				/>
			</div>

			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<div>
						<Label className="text-sm">Preferred time slots (optional)</Label>
						<p className="text-muted-foreground text-xs">
							Suggest up to {MAX_PROPOSED_SLOTS} times the notary can pick from. They may also
							propose a different time when approving.
						</p>
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={addSlot}
						disabled={value.slots.length >= MAX_PROPOSED_SLOTS}
					>
						Add slot
					</Button>
				</div>

				{value.slots.length === 0 ? (
					<div className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-xs">
						No preferred times — the notary will pick a time when approving.
					</div>
				) : (
					<div className="space-y-2">
						{value.slots.map((slot, i) => (
							<div key={i} className="flex items-end gap-2">
								<div className="flex-1 space-y-1">
									<Label className="text-xs" htmlFor={`slot-date-${i}`}>
										Date
									</Label>
									<Input
										id={`slot-date-${i}`}
										type="date"
										value={slot.date}
										onChange={e => patchSlot(i, { date: e.target.value })}
									/>
								</div>
								<div className="flex-1 space-y-1">
									<Label className="text-xs" htmlFor={`slot-time-${i}`}>
										Time
									</Label>
									<Input
										id={`slot-time-${i}`}
										type="time"
										value={slot.time}
										onChange={e => patchSlot(i, { time: e.target.value })}
									/>
								</div>
								<Button type="button" variant="ghost" size="sm" onClick={() => removeSlot(i)}>
									Remove
								</Button>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
