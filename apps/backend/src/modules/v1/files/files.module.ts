import { Module } from "@nestjs/common"

import { env } from "@/config/env.config"
import { FileObjectTenancyGuard } from "@/shared/guards/file-object-tenancy.guard"
import { QlegalSessionGuard } from "@/shared/guards/qlegal-session.guard"

import { createFileStorageAdapter, FILE_STORAGE_ADAPTER } from "./file-storage.adapter"
import { FilesController } from "./files.controller"
import { FilesService } from "./files.service"

@Module({
	controllers: [FilesController],
	exports: [FilesService],
	providers: [
		FilesService,
		FileObjectTenancyGuard,
		QlegalSessionGuard,
		{
			provide: FILE_STORAGE_ADAPTER,
			useFactory: () => createFileStorageAdapter(env),
		},
	],
})
export class FilesModule {}
