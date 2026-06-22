"use client"

import * as React from "react"
import {
	ArrowDown01Icon,
	ArrowLeft01Icon,
	ArrowRight01Icon,
	ArrowUp01Icon,
	UserIcon,
	UserMultiple02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

import { Button } from "@/core/components/ui/button"
import { Checkbox } from "@/core/components/ui/checkbox"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/core/components/ui/select"
import { cn } from "@/core/lib/utils"

import { getFullName, type SignerParticipant, type SignerRole } from "./meeting-signer-types"

type WizardStep = "select" | "roles" | "order"

/** Non-ENP signers first (selection order), then notary last. Always includes ENP when known. */
function buildSigningOrder(selectedIds: string[], enpUserId?: string): string[] {
	if (!enpUserId) return [...selectedIds]
	const nonEnp = selectedIds.filter(id => id !== enpUserId)
	return [...nonEnp, enpUserId]
}

export type SignerManagementModalProps = {
	participants: SignerParticipant[]
	signerUserIds: string[]
	signerRoles: Record<string, SignerRole>
	isOpen: boolean
	onOpenChange: (open: boolean) => void
	isEnp: boolean
	onSignersChange: (userIds: string[], roles: Record<string, SignerRole>) => void | Promise<void>
}

export const SignerManagementModal = React.memo(function SignerManagementModal({
	participants,
	signerUserIds,
	signerRoles,
	isOpen,
	onOpenChange,
	isEnp,
	onSignersChange,
}: SignerManagementModalProps) {
	const [step, setStep] = React.useState<WizardStep>("select")
	const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([])
	const [roles, setRoles] = React.useState<Record<string, SignerRole>>({})
	const [orderedUserIds, setOrderedUserIds] = React.useState<string[]>([])
	const [saving, setSaving] = React.useState(false)

	const enpUserId = React.useMemo(
		() => participants.find(p => p.role === "enp")?.userId,
		[participants]
	)

	React.useEffect(() => {
		if (!isOpen) return
		setStep("select")
		setSelectedUserIds(signerUserIds.length ? [...signerUserIds] : [])
		setRoles({ ...signerRoles })
		setOrderedUserIds(signerUserIds.length ? buildSigningOrder(signerUserIds, enpUserId) : [])
	}, [isOpen, signerUserIds, signerRoles, enpUserId])

	const selectedNonEnp = React.useMemo(
		() => selectedUserIds.filter(id => id !== enpUserId),
		[selectedUserIds, enpUserId]
	)

	const toggleUser = React.useCallback((userId: string, checked: boolean) => {
		setSelectedUserIds(prev => {
			if (checked) return prev.includes(userId) ? prev : [...prev, userId]
			return prev.filter(id => id !== userId)
		})
	}, [])

	const goNextFromSelect = React.useCallback(() => {
		if (selectedUserIds.length === 0) {
			toast.error("Select at least one signer.")
			return
		}
		if (selectedNonEnp.length === 0) {
			toast.error("Select at least one signer besides the ENP (notary).")
			return
		}
		const nextRoles: Record<string, SignerRole> = { ...roles }
		for (const id of selectedNonEnp) {
			if (!nextRoles[id]) nextRoles[id] = "principal"
		}
		setRoles(nextRoles)
		setOrderedUserIds(buildSigningOrder(selectedUserIds, enpUserId))
		setStep("roles")
	}, [selectedUserIds, selectedNonEnp, roles, enpUserId])

	const goNextFromRoles = React.useCallback(() => {
		setStep("order")
	}, [])

	const moveOrder = React.useCallback((index: number, direction: -1 | 1) => {
		setOrderedUserIds(prev => {
			const next = [...prev]
			const target = index + direction
			if (target < 0 || target >= next.length) return prev
			const tmp = next[index]!
			next[index] = next[target]!
			next[target] = tmp
			return next
		})
	}, [])

	const handleSave = React.useCallback(async () => {
		if (!orderedUserIds.length) {
			toast.error("Signing order is empty.")
			return
		}
		const finalRoles: Record<string, SignerRole> = {}
		for (const userId of orderedUserIds) {
			if (userId === enpUserId) {
				finalRoles[userId] = "principal"
			} else {
				finalRoles[userId] = roles[userId] ?? "principal"
			}
		}
		setSaving(true)
		try {
			await onSignersChange(orderedUserIds, finalRoles)
			onOpenChange(false)
			toast.success("Signers assigned")
		} catch {
			toast.error("Could not save signers.")
		} finally {
			setSaving(false)
		}
	}, [orderedUserIds, roles, enpUserId, onSignersChange, onOpenChange])

	const orderRows = React.useMemo(() => {
		return orderedUserIds
			.map(id => participants.find(p => p.userId === id))
			.filter((p): p is SignerParticipant => Boolean(p))
	}, [orderedUserIds, participants])

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg gap-5 p-6 sm:max-w-xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2.5 text-base">
						<HugeiconsIcon icon={UserMultiple02Icon} className="size-5" strokeWidth={2} />
						{step === "select" && "Select Signers"}
						{step === "roles" && "Assign Roles"}
						{step === "order" && "Set Signing Order"}
					</DialogTitle>
					<DialogDescription className="text-sm">
						{step === "select" && "Choose who must sign this instrument."}
						{step === "roles" &&
							"The ENP signs as notary and is excluded from this list. Assign Principal or Witness for everyone else."}
						{step === "order" && "Order determines signing sequence. The notary always signs last."}
					</DialogDescription>
				</DialogHeader>

				{step === "select" ? (
					<div className="border-border max-h-[28rem] space-y-1 overflow-y-auto rounded-lg border p-2">
						{participants.map(p => {
							const checked = selectedUserIds.includes(p.userId)
							return (
								<label
									key={p.userId}
									className={cn(
										"hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-md px-3 py-3",
										checked && "bg-muted/60"
									)}
								>
									<Checkbox
										checked={checked}
										onCheckedChange={v => toggleUser(p.userId, v === true)}
									/>
									<HugeiconsIcon
										icon={UserIcon}
										className="text-muted-foreground size-5 shrink-0"
										strokeWidth={2}
									/>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium">{getFullName(p)}</p>
										<p className="text-muted-foreground truncate text-xs">{p.email}</p>
									</div>
									{p.role === "enp" ? (
										<span className="text-muted-foreground text-xs">ENP</span>
									) : null}
								</label>
							)
						})}
					</div>
				) : null}

				{step === "roles" ? (
					<div className="border-border max-h-[28rem] space-y-2 overflow-y-auto rounded-lg border p-3">
						{selectedNonEnp.map(userId => {
							const p = participants.find(x => x.userId === userId)
							if (!p) return null
							return (
								<div
									key={userId}
									className="bg-muted/30 flex items-center justify-between gap-3 rounded-md border px-3 py-3"
								>
									<div className="min-w-0">
										<p className="truncate text-sm font-medium">{getFullName(p)}</p>
										<p className="text-muted-foreground truncate text-xs">{p.email}</p>
									</div>
									<Select
										value={roles[userId] ?? "principal"}
										onValueChange={v => setRoles(prev => ({ ...prev, [userId]: v as SignerRole }))}
									>
										<SelectTrigger className="h-9 w-[8.5rem] text-sm">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="principal">Principal</SelectItem>
											<SelectItem value="witness">Witness</SelectItem>
										</SelectContent>
									</Select>
								</div>
							)
						})}
					</div>
				) : null}

				{step === "order" ? (
					<div className="border-border max-h-[28rem] space-y-2 overflow-y-auto rounded-lg border p-3">
						{orderRows.map((p, index) => {
							const isNotary = p.role === "enp"
							const roleLabel = isNotary ? "notary" : (roles[p.userId] ?? "principal")
							return (
								<div
									key={p.userId}
									className="bg-muted/30 flex items-center gap-3 rounded-md border px-3 py-3"
								>
									<span className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
										{index + 1}
									</span>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium">{getFullName(p)}</p>
										<p className="text-muted-foreground truncate text-xs">
											{p.email} · {roleLabel}
										</p>
									</div>
									{isEnp ? (
										<div className="flex shrink-0 flex-col">
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="size-8"
												disabled={index === 0}
												onClick={() => moveOrder(index, -1)}
												aria-label="Move up"
											>
												<HugeiconsIcon icon={ArrowUp01Icon} className="size-4" strokeWidth={2} />
											</Button>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="size-8"
												disabled={index === orderRows.length - 1}
												onClick={() => moveOrder(index, 1)}
												aria-label="Move down"
											>
												<HugeiconsIcon icon={ArrowDown01Icon} className="size-4" strokeWidth={2} />
											</Button>
										</div>
									) : null}
								</div>
							)
						})}
					</div>
				) : null}

				<DialogFooter className="gap-3 sm:justify-between">
					{step === "select" ? (
						<>
							<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
								Cancel
							</Button>
							<Button type="button" onClick={goNextFromSelect}>
								Next
								<HugeiconsIcon icon={ArrowRight01Icon} className="ml-1 size-4" strokeWidth={2} />
							</Button>
						</>
					) : null}
					{step === "roles" ? (
						<>
							<Button type="button" variant="outline" onClick={() => setStep("select")}>
								<HugeiconsIcon icon={ArrowLeft01Icon} className="mr-1 size-4" strokeWidth={2} />
								Back
							</Button>
							<Button type="button" onClick={goNextFromRoles}>
								Next
								<HugeiconsIcon icon={ArrowRight01Icon} className="ml-1 size-4" strokeWidth={2} />
							</Button>
						</>
					) : null}
					{step === "order" ? (
						<>
							<Button type="button" variant="outline" onClick={() => setStep("roles")}>
								<HugeiconsIcon icon={ArrowLeft01Icon} className="mr-1 size-4" strokeWidth={2} />
								Back
							</Button>
							<div className="flex gap-2">
								<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
									Cancel
								</Button>
								<Button type="button" disabled={saving} onClick={() => void handleSave()}>
									Save
								</Button>
							</div>
						</>
					) : null}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
})
