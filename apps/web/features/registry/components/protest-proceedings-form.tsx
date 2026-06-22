"use client"

import * as React from "react"
import { toast } from "sonner"

import type { ProtestProceedings } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Textarea } from "@/core/components/ui/textarea"

import {
	useProtestProceedingsQuery,
	useUpsertProtestProceedingsMutation,
} from "../api/registry.hooks"

interface ProtestProceedingsFormProps {
	registryActId: string
}

export function ProtestProceedingsForm({ registryActId }: ProtestProceedingsFormProps) {
	const query = useProtestProceedingsQuery(registryActId)
	const mutation = useUpsertProtestProceedingsMutation()

	const [demandBy, setDemandBy] = React.useState("")
	const [demandWhen, setDemandWhen] = React.useState("")
	const [demandWhere, setDemandWhere] = React.useState("")
	const [sumDemanded, setSumDemanded] = React.useState("")
	const [presented, setPresented] = React.useState<boolean | null>(null)
	const [presentationNotes, setPresentationNotes] = React.useState("")
	const [otherFacts, setOtherFacts] = React.useState("")
	const [noticeToWhom, setNoticeToWhom] = React.useState("")
	const [noticeManner, setNoticeManner] = React.useState("")
	const [noticeWhereMade, setNoticeWhereMade] = React.useState("")
	const [noticeWhenDirected, setNoticeWhenDirected] = React.useState("")
	const [noticeWhereDirected, setNoticeWhereDirected] = React.useState("")

	React.useEffect(() => {
		const data = query.data as ProtestProceedings | null | undefined
		if (!data) return
		setDemandBy(data.demandBy ?? "")
		setDemandWhen(data.demandWhen ?? "")
		setDemandWhere(data.demandWhere ?? "")
		setSumDemanded(data.sumDemanded ?? "")
		setPresented(data.presented)
		setPresentationNotes(data.presentationNotes ?? "")
		setOtherFacts(data.otherFacts ?? "")
		const first = data.notices[0]
		if (first) {
			setNoticeToWhom(first.toWhom)
			setNoticeManner(first.manner)
			setNoticeWhereMade(first.whereMade)
			setNoticeWhenDirected(first.whenDirected)
			setNoticeWhereDirected(first.whereDirected)
		}
	}, [query.data])

	async function save() {
		try {
			await mutation.mutateAsync({
				registryActId,
				demandBy: demandBy.trim() || undefined,
				demandWhen: demandWhen.trim() || undefined,
				demandWhere: demandWhere.trim() || undefined,
				sumDemanded: sumDemanded.trim() || undefined,
				presented: presented ?? undefined,
				presentationNotes: presentationNotes.trim() || undefined,
				otherFacts: otherFacts.trim() || undefined,
				notices:
					noticeToWhom.trim() &&
					noticeManner.trim() &&
					noticeWhereMade.trim() &&
					noticeWhenDirected.trim() &&
					noticeWhereDirected.trim()
						? [
								{
									toWhom: noticeToWhom.trim(),
									manner: noticeManner.trim(),
									whereMade: noticeWhereMade.trim(),
									whenDirected: noticeWhenDirected.trim(),
									whereDirected: noticeWhereDirected.trim(),
								},
							]
						: [],
			})
			toast.success("Protest proceedings saved to ENB")
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not save protest proceedings")
		}
	}

	if (query.isLoading) {
		return <p className="text-muted-foreground text-sm">Loading protest proceedings…</p>
	}

	return (
		<div className="space-y-3 rounded-lg border p-4">
			<h4 className="text-sm font-semibold">Protest proceedings (ENB Rule e)</h4>
			<div className="grid gap-3 sm:grid-cols-2">
				<div className="space-y-1">
					<Label>Demand by</Label>
					<Input value={demandBy} onChange={e => setDemandBy(e.target.value)} />
				</div>
				<div className="space-y-1">
					<Label>Demand when</Label>
					<Input value={demandWhen} onChange={e => setDemandWhen(e.target.value)} />
				</div>
				<div className="space-y-1">
					<Label>Demand where</Label>
					<Input value={demandWhere} onChange={e => setDemandWhere(e.target.value)} />
				</div>
				<div className="space-y-1">
					<Label>Sum demanded</Label>
					<Input value={sumDemanded} onChange={e => setSumDemanded(e.target.value)} />
				</div>
			</div>
			<div className="flex flex-wrap gap-2">
				<Button
					type="button"
					size="sm"
					variant={presented === true ? "default" : "outline"}
					onClick={() => setPresented(true)}
				>
					Presented
				</Button>
				<Button
					type="button"
					size="sm"
					variant={presented === false ? "default" : "outline"}
					onClick={() => setPresented(false)}
				>
					Not presented
				</Button>
			</div>
			<div className="space-y-1">
				<Label>Presentation notes</Label>
				<Textarea
					value={presentationNotes}
					onChange={e => setPresentationNotes(e.target.value)}
					rows={2}
				/>
			</div>
			<div className="grid gap-3 sm:grid-cols-2">
				<div className="space-y-1">
					<Label>Notice to whom</Label>
					<Input value={noticeToWhom} onChange={e => setNoticeToWhom(e.target.value)} />
				</div>
				<div className="space-y-1">
					<Label>Manner of notice</Label>
					<Input value={noticeManner} onChange={e => setNoticeManner(e.target.value)} />
				</div>
				<div className="space-y-1">
					<Label>Where notice made</Label>
					<Input value={noticeWhereMade} onChange={e => setNoticeWhereMade(e.target.value)} />
				</div>
				<div className="space-y-1">
					<Label>When directed</Label>
					<Input value={noticeWhenDirected} onChange={e => setNoticeWhenDirected(e.target.value)} />
				</div>
				<div className="space-y-1 sm:col-span-2">
					<Label>Where directed</Label>
					<Input
						value={noticeWhereDirected}
						onChange={e => setNoticeWhereDirected(e.target.value)}
					/>
				</div>
			</div>
			<div className="space-y-1">
				<Label>Other facts</Label>
				<Textarea value={otherFacts} onChange={e => setOtherFacts(e.target.value)} rows={3} />
			</div>
			<Button size="sm" disabled={mutation.isPending} onClick={() => void save()}>
				{mutation.isPending ? "Saving…" : "Save protest record"}
			</Button>
		</div>
	)
}
