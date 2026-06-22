import type { Route } from "next"

import type { UserProfile } from "@repo/contracts"

import { usesAdminProfileShell } from "@/features/profile/lib/profile-routes"

/** Admin / ENA workflows use the `/admin/*` shell (sidebar), not the site top nav. */
export function usesAdminAppointmentShell(role: UserProfile["role"] | null | undefined): boolean {
	return usesAdminProfileShell(role) || role === "sub_org_admin"
}

export function appointmentLobbyPath(
	appointmentId: string,
	role?: UserProfile["role"] | null,
	options?: { adminShell?: boolean }
): Route {
	const useAdmin = options?.adminShell ?? usesAdminAppointmentShell(role)
	return (
		useAdmin ? `/admin/appointments/${appointmentId}/lobby` : `/appointments/${appointmentId}/lobby`
	) as Route
}

export type AppointmentLobbyReturnShell = "site" | "admin"

export function appointmentLobbyReturnShellFromPathname(
	pathname: string
): AppointmentLobbyReturnShell {
	return pathname.startsWith("/admin/appointments/") ? "admin" : "site"
}
