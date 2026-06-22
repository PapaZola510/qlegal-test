import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from "@nestjs/common"
import { ZodSerializationException } from "nestjs-zod"
import { ZodError } from "zod"

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
	private readonly logger = new Logger(HttpExceptionFilter.name)

	catch(exception: HttpException, host: ArgumentsHost) {
		const ctx = host.switchToHttp()
		const response = ctx.getResponse()
		const status = exception.getStatus()
		const exceptionResponse = exception.getResponse()

		// Log Zod serialization errors
		if (exception instanceof ZodSerializationException) {
			const zodError = exception.getZodError()
			if (zodError instanceof ZodError) {
				this.logger.error(`ZodSerializationException: ${zodError.message}`)
			}
		}

		// Extract error details
		let message: string | string[]
		let details: Record<string, unknown> | undefined

		if (typeof exceptionResponse === "string") {
			message = exceptionResponse
		} else if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
			const responseObj = exceptionResponse as Record<string, unknown>
			const nestedError = responseObj.error
			const nestedMessage =
				nestedError &&
				typeof nestedError === "object" &&
				nestedError !== null &&
				typeof (nestedError as Record<string, unknown>).message === "string"
					? ((nestedError as Record<string, unknown>).message as string)
					: undefined
			message = (responseObj.message as string | string[]) || nestedMessage || exception.message

			// Only include details if there's meaningful extra info beyond message/statusCode/error
			const extraDetails = Object.fromEntries(
				Object.entries(responseObj).filter(
					([key]) => !["message", "statusCode", "error", "success"].includes(key)
				)
			)
			if (Object.keys(extraDetails).length > 0) {
				details = extraDetails
			}
			if (nestedError && typeof nestedError === "object" && nestedError !== null) {
				const nested = nestedError as Record<string, unknown>
				if (typeof nested.code === "string" && nested.code.trim()) {
					details = { ...details, code: nested.code.trim() }
				}
			}
		} else {
			message = exception.message
		}

		// Consistent error response format
		const errorObject: Record<string, unknown> = {
			code: exception.constructor.name,
			message,
		}

		if (details) {
			errorObject.details = details
		}

		const errorResponse = {
			success: false,
			error: errorObject,
			timestamp: new Date().toISOString(),
		}

		response.status(status).json(errorResponse)
	}
}
