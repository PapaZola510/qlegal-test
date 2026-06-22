"use client"

import * as React from "react"
import { toast } from "sonner"

import type { EnpDocumentType } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { cn } from "@/core/lib/utils"
import {
	useCreateEnpDocumentTypeMutation,
	useDeleteEnpDocumentTypeMutation,
	useMyEnpDocumentTypesQuery,
	useUpdateEnpDocumentTypeMutation,
} from "@/features/enp-document-types/api/enp-document-types.hooks"

function parsePricePhp(raw: string): number | null {
	const trimmed = raw.trim().replace(/,/g, "")
	if (!trimmed) return null
	const n = Number.parseFloat(trimmed)
	if (!Number.isFinite(n) || n <= 0) return null
	return Math.round(n)
}

function formatPricePhp(n: number): string {
	return `₱${Math.round(n).toLocaleString()}`
}

function mutationErrorMessage(error: unknown): string {
	if (!error || typeof error !== "object") return "Something went wrong. Try again."
	const maybeMessage = (error as { message?: unknown }).message
	if (typeof maybeMessage === "string" && maybeMessage.trim()) return maybeMessage
	const shape = error as { data?: { message?: unknown } }
	if (typeof shape.data?.message === "string" && shape.data.message.trim())
		return shape.data.message
	return "Something went wrong. Try again."
}

export function EnpDocumentTypesCard({ className }: { className?: string }) {
	const q = useMyEnpDocumentTypesQuery()
	const createMut = useCreateEnpDocumentTypeMutation()
	const updateMut = useUpdateEnpDocumentTypeMutation()
	const deleteMut = useDeleteEnpDocumentTypeMutation()

	const [openCreate, setOpenCreate] = React.useState(false)
	const [newName, setNewName] = React.useState("")
	const [newPrice, setNewPrice] = React.useState("")

	const [editing, setEditing] = React.useState<EnpDocumentType | null>(null)
	const [editName, setEditName] = React.useState("")
	const [editPrice, setEditPrice] = React.useState("")

	const types = Array.isArray(q.data) ? q.data : []
	const isBusy = q.isLoading || createMut.isPending || updateMut.isPending || deleteMut.isPending

	function resetCreate() {
		setNewName("")
		setNewPrice("")
	}

	function openEdit(row: EnpDocumentType) {
		setEditing(row)
		setEditName(row.name)
		setEditPrice(String(row.pricePhp))
	}

	async function submitCreate() {
		const name = newName.trim()
		const pricePhp = parsePricePhp(newPrice)
		if (!name) return toast.error("Enter a document type name.")
		if (pricePhp === null) return toast.error("Enter a valid price.")
		try {
			await createMut.mutateAsync({ name, pricePhp })
			toast.success("Document type added")
			resetCreate()
			setOpenCreate(false)
		} catch (error) {
			toast.error(mutationErrorMessage(error))
		}
	}

	async function submitEdit() {
		if (!editing) return
		const name = editName.trim()
		const pricePhp = parsePricePhp(editPrice)
		if (!name) return toast.error("Enter a document type name.")
		if (pricePhp === null) return toast.error("Enter a valid price.")
		try {
			await updateMut.mutateAsync({ id: editing.id, name, pricePhp })
			toast.success("Document type updated")
			setEditing(null)
		} catch (error) {
			toast.error(mutationErrorMessage(error))
		}
	}

	async function remove(row: EnpDocumentType) {
		if (!confirm(`Delete “${row.name}”?`)) return
		try {
			await deleteMut.mutateAsync(row.id)
			toast.success("Document type deleted")
		} catch (error) {
			toast.error(mutationErrorMessage(error))
		}
	}

	return (
		<Card className={cn(className)}>
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between gap-3">
					<CardTitle className="text-base">Document types & fees</CardTitle>
					<Button type="button" onClick={() => setOpenCreate(true)} disabled={isBusy}>
						Add type
					</Button>
				</div>
				<p className="text-muted-foreground text-sm">
					Clients must pick at least one of these during booking. Types without a price block
					booking.
				</p>
			</CardHeader>
			<CardContent className="space-y-3">
				{q.isLoading ? (
					<p className="text-muted-foreground text-sm">Loading document types…</p>
				) : q.isError ? (
					<p className="text-destructive text-sm">Could not load document types.</p>
				) : types.length === 0 ? (
					<div className="rounded-lg border border-dashed p-4 text-sm">
						<p className="font-medium">No document types yet</p>
						<p className="text-muted-foreground mt-1">
							Add at least one priced document type so clients can book you.
						</p>
					</div>
				) : (
					<ul className="divide-y rounded-lg border">
						{types.map(t => (
							<li key={t.id} className="flex items-center justify-between gap-3 p-3">
								<div className="min-w-0">
									<p className="truncate text-sm font-medium">{t.name}</p>
									<p className="text-muted-foreground text-xs">{formatPricePhp(t.pricePhp)}</p>
								</div>
								<div className="flex items-center gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => openEdit(t)}
										disabled={isBusy}
									>
										Edit
									</Button>
									<Button
										type="button"
										variant="destructive"
										size="sm"
										onClick={() => void remove(t)}
										disabled={isBusy}
									>
										Delete
									</Button>
								</div>
							</li>
						))}
					</ul>
				)}
			</CardContent>

			<Dialog
				open={openCreate}
				onOpenChange={open => (open ? setOpenCreate(true) : setOpenCreate(false))}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add document type</DialogTitle>
						<DialogDescription>
							Clients will be able to select this during booking.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4">
						<div className="space-y-1.5">
							<Label htmlFor="edt-name">Name</Label>
							<Input
								id="edt-name"
								placeholder="e.g. Special Power of Attorney"
								value={newName}
								onChange={e => setNewName(e.target.value)}
								autoComplete="off"
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="edt-price">Price (PHP)</Label>
							<Input
								id="edt-price"
								placeholder="e.g. 1500"
								inputMode="numeric"
								value={newPrice}
								onChange={e => setNewPrice(e.target.value)}
								autoComplete="off"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => {
								resetCreate()
								setOpenCreate(false)
							}}
							disabled={isBusy}
						>
							Cancel
						</Button>
						<Button type="button" onClick={() => void submitCreate()} disabled={isBusy}>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={Boolean(editing)} onOpenChange={open => (!open ? setEditing(null) : null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit document type</DialogTitle>
					</DialogHeader>
					<div className="grid gap-4">
						<div className="space-y-1.5">
							<Label htmlFor="edt-edit-name">Name</Label>
							<Input
								id="edt-edit-name"
								value={editName}
								onChange={e => setEditName(e.target.value)}
								autoComplete="off"
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="edt-edit-price">Price (PHP)</Label>
							<Input
								id="edt-edit-price"
								inputMode="numeric"
								value={editPrice}
								onChange={e => setEditPrice(e.target.value)}
								autoComplete="off"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setEditing(null)}
							disabled={isBusy}
						>
							Cancel
						</Button>
						<Button type="button" onClick={() => void submitEdit()} disabled={isBusy}>
							Save changes
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	)
}
