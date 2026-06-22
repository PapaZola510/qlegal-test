"use client"

import { useForm } from "@tanstack/react-form"
import { z } from "zod"

import { Button } from "@/core/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/core/components/ui/field"
import { Input } from "@/core/components/ui/input"
import { PasswordInput } from "@/features/auth/components/password-input"
import { useAdminLandingLoginMutation } from "@/features/landing/api/admin-login.hooks"

const AdminLoginSchema = z.object({
	username: z.string().min(1, "Username is required"),
	password: z.string().min(1, "Password is required"),
})

export function LandingAdminLoginForm({ onSuccess }: { onSuccess?: () => void }) {
	const { mutateAsync: login, isPending, isError, error } = useAdminLandingLoginMutation()

	const form = useForm({
		defaultValues: {
			username: "admin",
			password: "",
		},
		validators: {
			onSubmit: AdminLoginSchema,
		},
		onSubmit: async ({ value }) => {
			await login(value)
			onSuccess?.()
		},
	})

	return (
		<form
			className="space-y-4 text-left"
			onSubmit={e => {
				e.preventDefault()
				form.handleSubmit()
			}}
		>
			<FieldGroup className="space-y-4">
				{isError && (
					<div className="bg-destructive/10 text-destructive border-destructive/20 font-montserrat flex items-start gap-2.5 rounded-lg border p-3.5 text-xs font-medium">
						<svg
							className="mt-0.5 size-4 shrink-0"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={2}
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
						<span>{error instanceof Error ? error.message : "Sign-in failed"}</span>
					</div>
				)}

				<form.Field
					name="username"
					children={field => {
						const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
						return (
							<Field data-invalid={isInvalid} className="space-y-1.5">
								<FieldLabel
									htmlFor="admin-username"
									className="font-mono text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase"
								>
									Username
								</FieldLabel>
								<div className="relative">
									<Input
										id="admin-username"
										name={field.name}
										autoComplete="username"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={e => field.handleChange(e.target.value)}
										aria-invalid={isInvalid}
										disabled={isPending}
										required
										className="bg-background/50 font-montserrat h-11 border-[var(--border)] text-sm transition-all focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
									/>
								</div>
								{isInvalid && (
									<FieldError
										errors={field.state.meta.errors}
										className="text-destructive text-xs"
									/>
								)}
							</Field>
						)
					}}
				/>

				<form.Field
					name="password"
					children={field => {
						const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
						return (
							<Field data-invalid={isInvalid} className="space-y-1.5">
								<FieldLabel
									htmlFor="admin-password"
									className="font-mono text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase"
								>
									Password
								</FieldLabel>
								<div className="relative">
									<PasswordInput
										id="admin-password"
										name={field.name}
										autoComplete="current-password"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={e => field.handleChange(e.target.value)}
										aria-invalid={isInvalid}
										disabled={isPending}
										required
										className="bg-background/50 font-montserrat h-11 border-[var(--border)] text-sm transition-all focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
									/>
								</div>
								{isInvalid && (
									<FieldError
										errors={field.state.meta.errors}
										className="text-destructive text-xs"
									/>
								)}
							</Field>
						)
					}}
				/>

				<Button
					type="submit"
					className="font-montserrat mt-2 flex h-11 w-full cursor-pointer items-center justify-center rounded-lg border-0 bg-gradient-to-r from-[var(--primary)] via-[var(--accent)] to-[var(--secondary)] text-sm font-semibold text-white shadow-lg shadow-purple-500/10 transition-all duration-200 hover:opacity-95"
					disabled={isPending}
				>
					{isPending ? (
						<div className="flex items-center gap-2">
							<svg className="size-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
								<circle
									className="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									strokeWidth="4"
								/>
								<path
									className="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								/>
							</svg>
							<span>Authenticating…</span>
						</div>
					) : (
						<span>Open ENA panel</span>
					)}
				</Button>
			</FieldGroup>
		</form>
	)
}
