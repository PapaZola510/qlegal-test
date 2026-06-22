import { SetMetadata } from "@nestjs/common"

import type { QlegalRole } from "../../common/session/qlegal-session.types"

export const ROLES_KEY = "qlegal:roles"

export function Roles(...roles: QlegalRole[]) {
	return SetMetadata(ROLES_KEY, roles)
}
