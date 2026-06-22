import { Module } from "@nestjs/common"

import { EventsWsMetricsService } from "./events-ws.metrics"
import { EventsGateway } from "./events.gateway"
import { EventsService } from "./events.service"

@Module({
	providers: [EventsWsMetricsService, EventsService, EventsGateway],
	exports: [EventsService],
})
export class EventsModule {}
