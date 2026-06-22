import { ForbiddenException } from "@nestjs/common"
import { Test, type TestingModule } from "@nestjs/testing"

import { EventsWsMetricsService } from "./events-ws.metrics"
import { EventsService } from "./events.service"

describe("EventsService", () => {
	let service: EventsService
	const toMock = jest.fn().mockReturnThis()
	const emitMock = jest.fn()
	const mockServer = { to: toMock, emit: emitMock }

	beforeEach(async () => {
		toMock.mockClear()
		emitMock.mockClear()
		toMock.mockReturnThis()

		const module: TestingModule = await Test.createTestingModule({
			providers: [EventsService, EventsWsMetricsService],
		}).compile()

		service = module.get(EventsService)
		service.attachServer(mockServer as never)
	})

	it("emitToUser targets the user room", () => {
		service.emitToUser("user-a", "test-event", { x: 1 })
		expect(toMock).toHaveBeenCalledWith("user:user-a")
		expect(emitMock).toHaveBeenCalledWith("test-event", { x: 1 })
	})

	it("emitToUserScoped allows same user", () => {
		service.emitToUserScoped("user-a", "user-a", "ping", {})
		expect(toMock).toHaveBeenCalledWith("user:user-a")
	})

	it("emitToUserScoped rejects cross-user", () => {
		expect(() => service.emitToUserScoped("user-a", "user-b", "ping", {})).toThrow(
			ForbiddenException
		)
		expect(toMock).not.toHaveBeenCalled()
	})
})
