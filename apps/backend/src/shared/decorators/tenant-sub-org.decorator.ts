import { SetMetadata } from "@nestjs/common"

/** Dot path into `req.body` (oRPC may nest under `json`). */
export const TENANT_SUB_ORG_INPUT_PATH_KEY = "qlegal:tenantSubOrgInputPath"

export function TenantSubOrgFromInput(dotPath: string) {
	return SetMetadata(TENANT_SUB_ORG_INPUT_PATH_KEY, dotPath)
}
