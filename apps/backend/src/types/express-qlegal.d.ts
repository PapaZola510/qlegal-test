import type { QlegalSessionContext } from "../common/session/qlegal-session.types"

declare global {
	namespace Express {
		interface Request {
			qlegalSessionContext?: QlegalSessionContext | null
			/** Populated by express.json verify — required for webhook HMAC over exact request bytes */
			rawBody?: Buffer
		}
	}
}

export {}
