"use client"

import { FullPageSocialAuth } from "@/features/auth/components/full-page-social-auth"

interface GoogleSignInCardProps {
	mode?: "login" | "register"
}

export function GoogleSignInCard({ mode = "login" }: GoogleSignInCardProps) {
	return <FullPageSocialAuth mode={mode} />
}
