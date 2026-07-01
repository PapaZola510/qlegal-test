"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import type { UserProfile } from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Textarea } from "@/core/components/ui/textarea"
import { TooltipProvider } from "@/core/components/ui/tooltip"
import { cn } from "@/core/lib/utils"
import { orpc } from "@/services/orpc/client"
import { useAuthProfileMeQuery } from "@/features/dashboard/api/dashboard.hooks"
import {
	downloadLmsCertificate,
	isLmsCertificateDownloadAvailable,
} from "@/features/integration/lib/lms-certificate-download"
import { useUpdateAuthProfileMutation } from "@/features/onboarding/api/profile-onboarding.hooks"
import { NOTARIAL_FIELD_HINTS } from "@/features/profile/lib/notarial-field-hints"

import { EditableCard } from "./editable-card"
import { EnpDocumentTypesCard } from "./enp-document-types-card"
import { IdentityVerificationCard } from "./identity-verification-card"
import { NotarialFieldLabel } from "./notarial-field-label"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client vs NestedClient inference gap
const api = orpc as any

function roleDisplayLabel(role: string): string {
	switch (role) {
		case "enp":
			return "ENP"
		case "client":
			return "Principal"
		case "admin":
			return "Platform admin"
		case "sub_org_admin":
			return "Organization admin"
		default:
			return role
	}
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
	return (
		<div className="space-y-1">
			<p className="text-muted-foreground text-xs font-medium">{label}</p>
			<p className="text-sm">{value || "—"}</p>
		</div>
	)
}

type ProfileFormState = {
	firstName: string
	middleName: string
	lastName: string
	email: string
	phone: string
	rollNumber: string
	rollDate: string
	npn: string
	commissionExpiry: string
	ptrNumber: string
	ptrLocation: string
	ptrDate: string
	ibpNumber: string
	ibpDate: string
	mclePeriod: string
	mcleNumber: string
	mcleDate: string
	officeAddress: string
	residentialAddress: string
	commissionArea: string
}

function emptyProfileForm(): ProfileFormState {
	return {
		firstName: "",
		middleName: "",
		lastName: "",
		email: "",
		phone: "",
		rollNumber: "",
		rollDate: "",
		npn: "",
		commissionExpiry: "",
		ptrNumber: "",
		ptrLocation: "",
		ptrDate: "",
		ibpNumber: "",
		ibpDate: "",
		mclePeriod: "",
		mcleNumber: "",
		mcleDate: "",
		officeAddress: "",
		residentialAddress: "",
		commissionArea: "",
	}
}

function profileToForm(profile: UserProfile): ProfileFormState {
	const parts = profile.name.trim().split(/\s+/).filter(Boolean)
	return {
		firstName: parts[0] ?? "",
		middleName: parts.length > 2 ? parts.slice(1, -1).join(" ") : "",
		lastName: parts.length > 1 ? (parts[parts.length - 1] ?? "") : "",
		email: profile.email,
		phone: profile.phone ?? "",
		rollNumber: profile.rollNumber ?? "",
		rollDate: profile.rollDate ?? "",
		npn: profile.commissionNumber ?? "",
		commissionExpiry: profile.commissionExpiry ?? "",
		ptrNumber: profile.ptrNumber ?? "",
		ptrLocation: profile.ptrLocation ?? "",
		ptrDate: profile.ptrDate ?? "",
		ibpNumber: profile.ibpNumber ?? "",
		ibpDate: profile.ibpDate ?? "",
		mclePeriod: profile.mclePeriod ?? "",
		mcleNumber: profile.mcleNumber ?? "",
		mcleDate: profile.mcleDate ?? "",
		officeAddress: profile.officeAddress ?? "",
		residentialAddress: profile.residentialAddress ?? "",
		commissionArea: profile.commissionArea ?? profile.regionProvinceCity ?? "",
	}
}

export function ProfilePageContent() {
	const searchParams = useSearchParams()
	const queryClient = useQueryClient()
	const { data: profileData, isPending, isError, refetch } = useAuthProfileMeQuery()
	const updateProfile = useUpdateAuthProfileMutation()
	const profile = profileData as UserProfile | undefined
	const [form, setForm] = React.useState<ProfileFormState>(emptyProfileForm)

	React.useEffect(() => {
		const focus = searchParams.get("focus")
		if (focus !== "kyc" && focus !== "notarial") return
		const targetId = focus === "kyc" ? "profile-kyc-verification" : "profile-notarial-credentials"
		requestAnimationFrame(() => {
			document.getElementById(targetId)?.scrollIntoView({
				behavior: "smooth",
				block: "start",
			})
		})
	}, [searchParams])

	function refetchProfile() {
		void queryClient.invalidateQueries({ queryKey: api.authProfile.me.queryOptions().queryKey })
		void refetch()
	}

	function update(field: keyof ProfileFormState, value: string) {
		setForm(prev => ({ ...prev, [field]: value }))
	}

	React.useEffect(() => {
		if (!profile) return
		setForm(profileToForm(profile))
	}, [profile])

	const savePersonal = () => {
		const name = [form.firstName, form.middleName, form.lastName].filter(Boolean).join(" ").trim()
		if (!name) {
			toast.error("Enter at least a first and last name.")
			return
		}
		const showAddress = profile?.role === "client" || profile?.role === "enp"
		void updateProfile
			.mutateAsync({
				name,
				phone: form.phone.trim() || undefined,
				...(showAddress ? { residentialAddress: form.residentialAddress.trim() || undefined } : {}),
			})
			.then(() => toast.success("Personal information saved"))
			.catch(() => toast.error("Could not save personal information"))
	}

	const saveNotarial = () => {
		void updateProfile
			.mutateAsync({
				rollNumber: form.rollNumber.trim() || undefined,
				rollDate: form.rollDate.trim() || undefined,
				commissionNumber: form.npn.trim() || undefined,
				commissionExpiry: form.commissionExpiry.trim() || undefined,
				ptrNumber: form.ptrNumber.trim() || undefined,
				ptrLocation: form.ptrLocation.trim() || undefined,
				ptrDate: form.ptrDate.trim() || undefined,
				ibpNumber: form.ibpNumber.trim() || undefined,
				ibpDate: form.ibpDate.trim() || undefined,
				mclePeriod: form.mclePeriod.trim() || undefined,
				mcleNumber: form.mcleNumber.trim() || undefined,
				mcleDate: form.mcleDate.trim() || undefined,
				officeAddress: form.officeAddress.trim() || undefined,
				commissionArea: form.commissionArea.trim() || undefined,
			})
			.then(() => toast.success("Notarial credentials saved"))
			.catch(() => toast.error("Could not save notarial credentials"))
	}

	if (isPending) {
		return <p className="text-muted-foreground text-sm">Loading profile…</p>
	}
	if (isError || !profile) {
		return <p className="text-destructive text-sm">Could not load your profile.</p>
	}

	const isEnp = profile.role === "enp"
	const isClient = profile.role === "client"
	const isEnpLike =
		profile.role === "enp" ||
		profile.role === "admin" ||
		profile.role === "super_admin" ||
		profile.role === "sub_org_admin"
	const isCertified = isEnp && profile.certificateStatus === "active"
	const showPersonalAddress = isClient || isEnp

	const accountTypeCard = (
		<Card className={cn("border-border/80 shadow-sm", isEnp && "flex h-full flex-col")}>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">Account type</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{isEnp ? (
					<>
						<div className="space-y-2">
							<p className="text-muted-foreground text-xs font-medium">Role</p>
							<Badge variant="secondary" className="h-7 px-3 text-sm font-semibold">
								{roleDisplayLabel(profile.role)}
							</Badge>
						</div>
						<p className="text-muted-foreground text-sm leading-relaxed">
							Electronic Notary Public account with access to appointments, notarial book, and
							document signing.
						</p>
					</>
				) : (
					<ReadOnlyField label="Role" value={roleDisplayLabel(profile.role)} />
				)}
			</CardContent>
		</Card>
	)

	return (
		<div className={isEnp ? "flex flex-col gap-5" : "space-y-6"}>
			{isEnp ? (
				<div className="grid gap-4 lg:grid-cols-12">
					<div className="h-full lg:col-span-4 xl:col-span-3">{accountTypeCard}</div>
					<div className="h-full lg:col-span-8 xl:col-span-9">
						<IdentityVerificationCard
							profile={profile}
							onRefetch={refetchProfile}
							className="flex h-full flex-col"
						/>
					</div>
				</div>
			) : (
				<>
					{accountTypeCard}
					{profile.role === "client" || isEnpLike ? (
						<IdentityVerificationCard profile={profile} onRefetch={refetchProfile} />
					) : null}
				</>
			)}

			{/* Personal information */}
			<EditableCard title="Personal Information" onSave={savePersonal}>
				{editing =>
					editing ? (
						<div className="grid gap-4 sm:grid-cols-3">
							<div className="space-y-1.5">
								<Label htmlFor="p-fn">First Name</Label>
								<Input
									id="p-fn"
									value={form.firstName}
									onChange={e => update("firstName", e.target.value)}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="p-mn">Middle Name</Label>
								<Input
									id="p-mn"
									value={form.middleName}
									onChange={e => update("middleName", e.target.value)}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="p-ln">Last Name</Label>
								<Input
									id="p-ln"
									value={form.lastName}
									onChange={e => update("lastName", e.target.value)}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="p-email">Email</Label>
								<Input
									id="p-email"
									type="email"
									value={form.email}
									onChange={e => update("email", e.target.value)}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="p-phone">Phone</Label>
								<Input
									id="p-phone"
									value={form.phone}
									onChange={e => update("phone", e.target.value)}
								/>
							</div>
							{showPersonalAddress ? (
								<div className="space-y-1.5 sm:col-span-3">
									<Label htmlFor="p-address">Address</Label>
									<Textarea
										id="p-address"
										rows={2}
										value={form.residentialAddress}
										onChange={e => update("residentialAddress", e.target.value)}
										placeholder="Street, barangay, city, province"
									/>
								</div>
							) : null}
						</div>
					) : (
						<div className="grid gap-4 sm:grid-cols-3">
							<ReadOnlyField label="First Name" value={form.firstName} />
							<ReadOnlyField label="Middle Name" value={form.middleName} />
							<ReadOnlyField label="Last Name" value={form.lastName} />
							<ReadOnlyField label="Email" value={form.email} />
							<ReadOnlyField label="Phone" value={form.phone} />
							{showPersonalAddress ? (
								<div className="sm:col-span-3">
									<ReadOnlyField label="Address" value={form.residentialAddress} />
								</div>
							) : null}
						</div>
					)
				}
			</EditableCard>

			{/* Notarial credentials — ENP only */}
			{isEnp && (
				<div id="profile-notarial-credentials" className="scroll-mt-24">
					<TooltipProvider delay={200}>
						<EditableCard title="Notarial Credentials" onSave={saveNotarial}>
							{editing =>
								editing ? (
									<div className="space-y-4">
										<p className="text-muted-foreground text-sm leading-relaxed">
											These details are sent to when you create a signing project and
											appear on your electronic notarial seal. Hover the{" "}
											<span className="font-medium">?</span> beside each field for an example.
										</p>
										<div className="grid gap-4 sm:grid-cols-2">
											<div className="space-y-1.5">
												<NotarialFieldLabel
													htmlFor="nc-roll"
													label="Roll of Attorneys no."
													sample={NOTARIAL_FIELD_HINTS.rollNumber}
												/>
												<Input
													id="nc-roll"
													value={form.rollNumber}
													onChange={e => update("rollNumber", e.target.value)}
												/>
											</div>
											<div className="space-y-1.5">
												<NotarialFieldLabel
													htmlFor="nc-roll-date"
													label="Roll date"
													sample={NOTARIAL_FIELD_HINTS.rollDate}
												/>
												<Input
													id="nc-roll-date"
													type="date"
													value={form.rollDate}
													onChange={e => update("rollDate", e.target.value)}
												/>
											</div>
											<div className="space-y-1.5">
												<NotarialFieldLabel
													htmlFor="nc-npn"
													label="NPN"
													sample={NOTARIAL_FIELD_HINTS.commissionNumber}
												/>
												<Input
													id="nc-npn"
													value={form.npn}
													onChange={e => update("npn", e.target.value)}
												/>
											</div>
											<div className="space-y-1.5">
												<NotarialFieldLabel
													htmlFor="nc-expiry"
													label="Commission valid until"
													sample={NOTARIAL_FIELD_HINTS.commissionExpiry}
												/>
												<Input
													id="nc-expiry"
													type="date"
													value={form.commissionExpiry}
													onChange={e => update("commissionExpiry", e.target.value)}
												/>
											</div>
											<div className="space-y-1.5">
												<NotarialFieldLabel
													htmlFor="nc-ptr"
													label="PTR no."
													sample={NOTARIAL_FIELD_HINTS.ptrNumber}
												/>
												<Input
													id="nc-ptr"
													value={form.ptrNumber}
													onChange={e => update("ptrNumber", e.target.value)}
												/>
											</div>
											<div className="space-y-1.5">
												<NotarialFieldLabel
													htmlFor="nc-ptr-loc"
													label="PTR place of issuance"
													sample={NOTARIAL_FIELD_HINTS.ptrLocation}
												/>
												<Input
													id="nc-ptr-loc"
													value={form.ptrLocation}
													onChange={e => update("ptrLocation", e.target.value)}
												/>
											</div>
											<div className="space-y-1.5">
												<NotarialFieldLabel
													htmlFor="nc-ptr-date"
													label="PTR date of issuance"
													sample={NOTARIAL_FIELD_HINTS.ptrDate}
												/>
												<Input
													id="nc-ptr-date"
													type="date"
													value={form.ptrDate}
													onChange={e => update("ptrDate", e.target.value)}
												/>
											</div>
											<div className="space-y-1.5">
												<NotarialFieldLabel
													htmlFor="nc-ibp"
													label="IBP membership no."
													sample={NOTARIAL_FIELD_HINTS.ibpNumber}
												/>
												<Input
													id="nc-ibp"
													value={form.ibpNumber}
													onChange={e => update("ibpNumber", e.target.value)}
												/>
											</div>
											<div className="space-y-1.5">
												<NotarialFieldLabel
													htmlFor="nc-ibp-date"
													label="IBP date"
													sample={NOTARIAL_FIELD_HINTS.ibpDate}
												/>
												<Input
													id="nc-ibp-date"
													value={form.ibpDate}
													onChange={e => update("ibpDate", e.target.value)}
													placeholder="Dec 18, 2024 (for 2025)"
												/>
											</div>
											<div className="space-y-1.5 sm:col-span-2">
												<NotarialFieldLabel
													htmlFor="nc-mcle-period"
													label="MCLE compliance note"
													sample={NOTARIAL_FIELD_HINTS.mclePeriod}
												/>
												<Textarea
													id="nc-mcle-period"
													rows={2}
													value={form.mclePeriod}
													onChange={e => update("mclePeriod", e.target.value)}
													placeholder="e.g. Valid until 12/30/2026"
												/>
											</div>
											<div className="space-y-1.5">
												<NotarialFieldLabel
													htmlFor="nc-mcle"
													label="MCLE compliance no."
													sample={NOTARIAL_FIELD_HINTS.mcleNumber}
												/>
												<Input
													id="nc-mcle"
													value={form.mcleNumber}
													onChange={e => update("mcleNumber", e.target.value)}
												/>
											</div>
											<div className="space-y-1.5">
												<NotarialFieldLabel
													htmlFor="nc-mcle-date"
													label="MCLE date"
													sample={NOTARIAL_FIELD_HINTS.mcleDate}
												/>
												<Input
													id="nc-mcle-date"
													type="date"
													value={form.mcleDate}
													onChange={e => update("mcleDate", e.target.value)}
												/>
											</div>
											<div className="space-y-1.5 sm:col-span-2">
												<NotarialFieldLabel
													htmlFor="nc-office"
													label="Business / notary address"
													sample={NOTARIAL_FIELD_HINTS.officeAddress}
												/>
												<Textarea
													id="nc-office"
													rows={2}
													value={form.officeAddress}
													onChange={e => update("officeAddress", e.target.value)}
												/>
											</div>
											<div className="space-y-1.5">
												<NotarialFieldLabel
													htmlFor="nc-commission"
													label="Commission area"
													sample={NOTARIAL_FIELD_HINTS.commissionArea}
												/>
												<Input
													id="nc-commission"
													value={form.commissionArea}
													onChange={e => update("commissionArea", e.target.value)}
												/>
											</div>
										</div>
									</div>
								) : (
									<div className="grid gap-4 sm:grid-cols-2">
										<ReadOnlyField label="Roll of Attorneys no." value={form.rollNumber} />
										<ReadOnlyField label="Roll date" value={form.rollDate} />
										<ReadOnlyField label="NPN" value={form.npn} />
										<ReadOnlyField label="Commission valid until" value={form.commissionExpiry} />
										<ReadOnlyField label="PTR no." value={form.ptrNumber} />
										<ReadOnlyField label="PTR place" value={form.ptrLocation} />
										<ReadOnlyField label="PTR date" value={form.ptrDate} />
										<ReadOnlyField label="IBP membership no." value={form.ibpNumber} />
										<ReadOnlyField label="IBP date" value={form.ibpDate} />
										<ReadOnlyField label="MCLE compliance note" value={form.mclePeriod} />
										<ReadOnlyField label="MCLE compliance no." value={form.mcleNumber} />
										<ReadOnlyField label="MCLE date" value={form.mcleDate} />
										<ReadOnlyField label="Business / notary address" value={form.officeAddress} />
										<ReadOnlyField label="Commission area" value={form.commissionArea} />
									</div>
								)
							}
						</EditableCard>
					</TooltipProvider>
				</div>
			)}

			{isEnp && (
				<div
					className={cn(
						"grid gap-4",
						isCertified ? "lg:grid-cols-3" : "grid-cols-1"
					)}
				>
					<div className={cn(isCertified && "lg:col-span-2")}>
						<EnpDocumentTypesCard />
					</div>

					{isCertified ? (
						<Card className="border-border/80 shadow-sm">
							<CardHeader>
								<CardTitle>Certificate</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<p className="text-muted-foreground text-sm">
									Your ENP certificate is available for download.
								</p>
								<Button
									variant="outline"
									className="w-full sm:w-auto"
									onClick={() => {
										if (isLmsCertificateDownloadAvailable(profile.certificateId)) {
											void downloadLmsCertificate()
											return
										}
										toast.message("Certificate PDF", {
											description: "Download will be available from your certification record.",
										})
									}}
								>
									Download my certificate
								</Button>
							</CardContent>
						</Card>
					) : null}
				</div>
			)}
		</div>
	)
}
