"use client"

import * as React from "react"
import { useForm } from "@tanstack/react-form"

import { Button } from "@/core/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/core/components/ui/field"
import { Input } from "@/core/components/ui/input"
import { cn } from "@/core/lib/utils"
import { PasswordInput } from "@/features/auth/components/password-input"
import { TermsPrivacyNote } from "@/features/auth/components/terms-privacy-note"
import { useLoginMutation } from "@/features/auth/login/api/login.hooks"
import { LoginSchema } from "@/features/auth/login/api/login.schema"
import { useRegisterMutation } from "@/features/auth/register/api/register.hooks"
import { RegisterSchema } from "@/features/auth/register/api/register.schema"

interface AuthEmailCredentialsFormProps {
	mode: "login" | "register"
	postAuthRedirectPath?: string | null
	className?: string
	consented?: boolean
	onConsented?: () => void
	onConsentChange?: (next: boolean) => void
	termsUrl?: string | null
	privacyUrl?: string | null
}

function AuthFormError({ error, isError }: { error: unknown; isError: boolean }) {
	if (!isError) return null
	return (
		<div
			className="rounded-r-md border-y border-r border-l-[4px] border-[var(--border)] border-[var(--destructive)] bg-[var(--destructive)]/8 p-3 text-left"
			role="alert"
		>
			<p className="font-montserrat text-xs font-semibold text-[var(--destructive)]">
				{error instanceof Error ? error.message : "Something went wrong. Please try again."}
			</p>
		</div>
	)
}

export function AuthEmailCredentialsForm({
	mode,
	postAuthRedirectPath,
	className,
	consented,
	onConsented,
	onConsentChange,
	termsUrl,
	privacyUrl,
}: AuthEmailCredentialsFormProps) {
	const isRegister = mode === "register"
	const isConsentControlled =
		typeof consented === "boolean" &&
		(typeof onConsentChange === "function" || typeof onConsented === "function")
	const [localHasConsented, setLocalHasConsented] = React.useState(false)
	const hasConsented = isConsentControlled ? consented : localHasConsented

	React.useEffect(() => {
		if (!isRegister) setLocalHasConsented(false)
	}, [isRegister])

	const loginMutation = useLoginMutation({ postAuthRedirectPath })
	const registerMutation = useRegisterMutation({ postAuthRedirectPath })
	const isPending = isRegister ? registerMutation.isPending : loginMutation.isPending
	const isError = isRegister ? registerMutation.isError : loginMutation.isError
	const error = isRegister ? registerMutation.error : loginMutation.error

	const form = useForm({
		defaultValues: { name: "", email: "", password: "" },
		validators: {
			onSubmit: ({ value }) => {
				const result = (isRegister ? RegisterSchema : LoginSchema).safeParse(
					isRegister ? value : { email: value.email, password: value.password }
				)
				if (!result.success) return result.error
			},
		},
		onSubmit: async ({ value }) => {
			if (isRegister) {
				await registerMutation.mutateAsync({
					name: value.name,
					email: value.email,
					password: value.password,
				})
				return
			}
			await loginMutation.mutateAsync({ email: value.email, password: value.password })
		},
	})

	return (
		<form
			className={cn("flex flex-col gap-2.5 sm:gap-3", className)}
			onSubmit={e => {
				e.preventDefault()
				if (isRegister && !hasConsented) return
				void form.handleSubmit()
			}}
		>
			<AuthFormError error={error} isError={isError} />
			<FieldGroup className="gap-2.5 sm:gap-3">
				{isRegister ? (
					<form.Field
						name="name"
						children={field => {
							const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor="auth-name">Full name</FieldLabel>
									<Input
										id="auth-name"
										name={field.name}
										type="text"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={e => field.handleChange(e.target.value)}
										aria-invalid={isInvalid}
										autoComplete="name"
										placeholder="Juan Dela Cruz"
										required
										disabled={isPending}
										className="h-9 sm:h-10"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							)
						}}
					/>
				) : null}

				<form.Field
					name="email"
					children={field => {
						const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor="auth-email">Email</FieldLabel>
								<Input
									id="auth-email"
									name={field.name}
									type="email"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={e => field.handleChange(e.target.value)}
									aria-invalid={isInvalid}
									autoComplete="email"
									placeholder="you@example.com"
									required
									disabled={isPending}
									className="h-9 sm:h-10"
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						)
					}}
				/>

				<form.Field
					name="password"
					children={field => {
						const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor="auth-password">Password</FieldLabel>
								<PasswordInput
									id="auth-password"
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={e => field.handleChange(e.target.value)}
									aria-invalid={isInvalid}
									autoComplete={isRegister ? "new-password" : "current-password"}
									placeholder={isRegister ? "At least 8 characters" : undefined}
									required
									disabled={isPending}
									className="h-9 sm:h-10"
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						)
					}}
				/>

				{isRegister ? (
					<div className="mt-2 sm:mt-2.5">
						<TermsPrivacyNote
							consentRequired
							consented={hasConsented}
							onConsentChange={
								isConsentControlled
									? onConsentChange
									: next => {
											setLocalHasConsented(next)
										}
							}
							onConsented={
								isConsentControlled
									? onConsented
									: () => {
											setLocalHasConsented(true)
										}
							}
							termsUrl={termsUrl}
							privacyUrl={privacyUrl}
						/>
					</div>
				) : null}

				<Button
					type="submit"
					disabled={isPending || (isRegister && !hasConsented)}
					className="font-montserrat h-10 w-full cursor-pointer rounded-lg border-0 text-sm font-semibold text-white shadow-md sm:h-11"
					style={{
						background:
							"linear-gradient(135deg, var(--primary) 0%, var(--accent) 40%, var(--secondary) 75%, var(--chart-4) 100%)",
					}}
				>
					{isPending
						? isRegister
							? "Creating account…"
							: "Signing in…"
						: isRegister
							? "Create account"
							: "Sign in with email"}
				</Button>
			</FieldGroup>
		</form>
	)
}
