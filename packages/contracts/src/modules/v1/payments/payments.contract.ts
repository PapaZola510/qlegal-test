import { oc } from "@orpc/contract"
import { z } from "zod"

import {
	CreatePaymentIntentSchema,
	PaymentIdSchema,
	PaymentIntentSchema,
} from "./payments.schema.js"

export const paymentsContract = {
	list: oc
		.route({
			method: "GET",
			path: "/payments",
			summary: "List payment intents",
			tags: ["Payments"],
		})
		.output(z.array(PaymentIntentSchema)),

	get: oc
		.route({
			method: "GET",
			path: "/payments/{id}",
			summary: "Get payment intent by ID",
			tags: ["Payments"],
		})
		.input(PaymentIdSchema)
		.output(PaymentIntentSchema),

	create: oc
		.route({
			method: "POST",
			path: "/payments",
			summary: "Create payment intent",
			tags: ["Payments"],
		})
		.input(CreatePaymentIntentSchema)
		.output(PaymentIntentSchema),
}
