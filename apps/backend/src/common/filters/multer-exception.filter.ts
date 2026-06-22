import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpStatus,
	Logger,
	PayloadTooLargeException,
} from "@nestjs/common"
import type { Response } from "express"
import { MulterError } from "multer"

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
	private readonly logger = new Logger(MulterExceptionFilter.name)

	catch(exception: MulterError, host: ArgumentsHost) {
		const response = host.switchToHttp().getResponse<Response>()

		if (exception.code === "LIMIT_FILE_SIZE") {
			this.logger.warn(`Multer file size limit exceeded: ${exception.message}`)
			const payload = new PayloadTooLargeException(
				"Recording file is too large. Try a shorter capture or lower screen resolution."
			)
			const body = payload.getResponse()
			response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
				success: false,
				error: {
					code: payload.constructor.name,
					message:
						typeof body === "object" && body !== null && "message" in body
							? body.message
							: payload.message,
				},
				timestamp: new Date().toISOString(),
			})
			return
		}

		this.logger.warn(`Multer error (${exception.code}): ${exception.message}`)
		response.status(HttpStatus.BAD_REQUEST).json({
			success: false,
			error: {
				code: "MulterError",
				message: exception.message || "Invalid multipart upload",
			},
			timestamp: new Date().toISOString(),
		})
	}
}
