import { ORPCError } from "@orpc/server"

import {
	appointmentDocumentTypes,
	appointmentDocuments,
	appointments,
	quicksignProjectDocumentTypes,
	quicksignProjects,
	quicksignSigners,
} from "@repo/db/schema"

import { db } from "@/common/database/database.client"

import { QuicksignService } from "./quicksign.service"

jest.mock("@orpc/server", () => ({
	ORPCError: class ORPCError extends Error {
		readonly code: string
		readonly data: unknown

		constructor(code: string, options?: { message?: string; data?: unknown }) {
			super(options?.message ?? code)
			this.code = code
			this.data = options?.data
		}
	},
}))

jest.mock("@repo/db/schema", () => {
	const table = (name: string, columns: string[]) =>
		Object.fromEntries(columns.map(column => [column, `${name}.${column}`]))
	return {
		appointmentDocumentTypes: table("appointmentDocumentTypes", [
			"appointmentId",
			"enpDocumentTypeId",
			"pricePhpSnapshot",
			"createdAt",
		]),
		appointmentDocuments: table("appointmentDocuments", [
			"appointmentId",
			"fileObjectId",
			"displayName",
			"documentType",
			"createdAt",
		]),
		appointments: table("appointments", [
			"id",
			"clientUserId",
			"enpUserId",
			"title",
			"description",
			"status",
			"scheduledAt",
			"durationMinutes",
			"kind",
			"notarizationType",
			"sessionMode",
			"confirmedAt",
			"canStart",
			"canRejoin",
			"createdAt",
			"updatedAt",
		]),
		clientProfiles: table("clientProfiles", ["userId"]),
		enpDocumentTypes: table("enpDocumentTypes", ["id", "name"]),
		enpProfiles: table("enpProfiles", [
			"userId",
			"prefix",
			"firstName",
			"lastName",
			"suffix",
			"email",
			"subOrgId",
		]),
		meetingSignatureRequests: table("meetingSignatureRequests", []),
		quicksignProjectDocumentTypes: table("quicksignProjectDocumentTypes", [
			"projectId",
			"enpDocumentTypeId",
			"pricePhpSnapshot",
			"createdAt",
		]),
		quicksignProjects: table("quicksignProjects", [
			"id",
			"enpUserId",
			"documentFileObjectId",
			"title",
			"description",
			"status",
			"doconchainProjectUuid",
			"plotCompletedAt",
			"appointmentId",
			"expiresAt",
			"completedAt",
			"createdAt",
			"updatedAt",
		]),
		quicksignSigners: table("quicksignSigners", [
			"id",
			"projectId",
			"firstName",
			"lastName",
			"email",
			"sequenceOrder",
			"signedAt",
			"createdAt",
			"updatedAt",
		]),
		registryActs: table("registryActs", []),
		users: table("users", ["id", "email"]),
	}
})

jest.mock("@/common/database/database.client", () => ({
	db: {
		insert: jest.fn(),
		update: jest.fn(),
		select: jest.fn(),
	},
}))

jest.mock("@/config/env.config", () => ({
	doconchainOrgEmailFallback: jest.fn().mockReturnValue(null),
	env: {
		DOCONCHAIN_APP_URL: "https://doconchain.test",
	},
	publicAppUrl: jest.fn().mockReturnValue("https://app.test"),
}))

jest.mock("@/services/doconchain/doconchain-adapter.service", () => ({
	DoconchainAdapterService: class DoconchainAdapterService {},
	isDoconchainProjectCompleted: jest.fn().mockReturnValue(false),
}))

jest.mock("@/services/doconchain/doconchain-project-provision.service", () => ({
	DoconchainProjectProvisionService: class DoconchainProjectProvisionService {},
}))

jest.mock("@/services/doconchain/generate-sign-link", () => ({
	generateDoconchainSignLink: jest.fn().mockResolvedValue("https://app.test/sign"),
}))

jest.mock("@/services/email/email-adapter", () => ({
	EMAIL_ADAPTER: Symbol("EMAIL_ADAPTER"),
}))

jest.mock("@/services/email/notarized-pdf-delivery.service", () => ({
	NotarizedPdfDeliveryService: class NotarizedPdfDeliveryService {},
}))

jest.mock("@/services/email/quicksign-session-invite-email", () => ({
	buildQuicksignSessionInviteEmail: jest.fn().mockReturnValue({
		subject: "Invite",
		html: "",
		text: "",
	}),
}))

jest.mock("../auth-profile/lib/assert-enp-commission-active", () => ({
	assertEnpCommissionAllowsNotarialActs: jest.fn().mockResolvedValue({ ok: true }),
}))

jest.mock("../auth-profile/lib/assert-enp-session-access", () => ({
	assertEnpSessionAccess: jest.fn(),
}))

jest.mock("../auth-profile/lib/assert-government-id-allows-notarial-acts", () => ({
	assertGovernmentIdAllowsNotarialActs: jest.fn().mockResolvedValue({ ok: true }),
}))

jest.mock("../events/events.service", () => ({
	EventsService: class EventsService {},
}))

jest.mock("../files/files.service", () => ({
	FilesService: class FilesService {},
}))

jest.mock("../ien-attestation/ien-attestation.service", () => ({
	IenAttestationService: class IenAttestationService {},
}))

jest.mock("../registry/registry.service", () => ({
	RegistryService: class RegistryService {},
}))

jest.mock("../sessions/meeting-signers.service", () => ({
	MeetingSignersService: class MeetingSignersService {},
}))

jest.mock("../sessions/sessions.service", () => ({
	SessionsService: class SessionsService {},
}))

jest.mock("../enp-document-types/enp-document-types.service", () => ({
	EnpDocumentTypesService: class EnpDocumentTypesService {},
}))

type DbMock = {
	insert: jest.Mock
	update: jest.Mock
	select: jest.Mock
}

const mockDb = db as unknown as DbMock

const ctx = {
	userId: "enp-1",
	sessionId: "session-1",
	role: "enp" as const,
	subOrgIds: ["sub-1"],
	complianceAuditAccess: false,
}

const baseProject = {
	id: "qs-1",
	enpUserId: "enp-1",
	documentFileObjectId: "file-1",
	title: "Document",
	description: null,
	status: "pending_signatures" as const,
	doconchainProjectUuid: "dc-1",
	notarizedFileObjectId: null,
	plotCompletedAt: null,
	appointmentId: null,
	expiresAt: new Date("2026-06-29T00:00:00.000Z"),
	completedAt: null,
	notarizedPdfEmailedAt: null,
	createdAt: new Date("2026-06-15T00:00:00.000Z"),
	updatedAt: new Date("2026-06-15T00:00:00.000Z"),
}

const completedProject = {
	...baseProject,
	plotCompletedAt: new Date("2026-06-15T01:00:00.000Z"),
}

function createService() {
	const files = {}
	const dc = {
		getAccessToken: jest.fn().mockResolvedValue("token"),
		addSigner: jest.fn().mockResolvedValue(undefined),
	}
	const doconchainProvision = {
		createProjectUuidFromPdfFile: jest.fn().mockResolvedValue("dc-1"),
	}
	const email = {
		sendQuicksignSessionInvite: jest.fn().mockResolvedValue(undefined),
	}
	const events = {
		emitToUser: jest.fn(),
	}
	const sessions = {
		ensureRoomForAppointment: jest.fn().mockResolvedValue(undefined),
	}
	const meetingSigners = {
		setMeetingDocumentSigners: jest.fn().mockResolvedValue(undefined),
	}
	const registry = {}
	const notarizedPdfDelivery = {}
	const ienAttestation = {
		assertEnpAttestationBeforeFinalize: jest.fn().mockResolvedValue(undefined),
		linkProjectAttestationsToAppointment: jest.fn().mockResolvedValue(undefined),
	}
	const enpDocumentTypes = {
		resolveAndValidateSelection: jest.fn(),
	}

	const service = new QuicksignService(
		files as never,
		dc as never,
		doconchainProvision as never,
		email as never,
		events as never,
		sessions as never,
		meetingSigners as never,
		registry as never,
		notarizedPdfDelivery as never,
		ienAttestation as never,
		enpDocumentTypes as never
	)

	jest.spyOn(service as any, "assertEnp").mockResolvedValue(ctx)
	jest.spyOn(service as any, "assertCommissionForNotarialActs").mockResolvedValue(undefined)
	jest.spyOn(service as any, "resolveSubOrgIds").mockResolvedValue(["sub-1"])
	jest.spyOn(service as any, "assertQsDocumentFile").mockResolvedValue(undefined)
	jest.spyOn(service as any, "loadEnpRow").mockResolvedValue({
		prefix: null,
		firstName: "Erin",
		lastName: "Notary",
		suffix: null,
		email: "enp@example.com",
	})
	jest.spyOn(service as any, "loadProjectForEnp").mockResolvedValue(completedProject)
	jest.spyOn(service as any, "loadSigners").mockResolvedValue([
		{
			id: "signer-1",
			projectId: "qs-1",
			firstName: "Priya",
			lastName: "Client",
			email: "client@example.com",
			sequenceOrder: 1,
			signedAt: null,
			createdAt: new Date("2026-06-15T00:00:00.000Z"),
			updatedAt: new Date("2026-06-15T00:00:00.000Z"),
		},
	])
	jest.spyOn(service as any, "resolveClientUserIdForSigner").mockResolvedValue("client-1")
	jest.spyOn(service as any, "syncSigningProgressForProject").mockResolvedValue({
		signingComplete: false,
		registrySynced: false,
	})
	jest.spyOn(service as any, "resolveSignDocumentUrl").mockResolvedValue("https://app.test/sign")

	return {
		service,
		dc,
		doconchainProvision,
		sessions,
		meetingSigners,
		ienAttestation,
		enpDocumentTypes,
	}
}

function mockInsertReturning(table: unknown, rows: unknown[]) {
	const returning = jest.fn().mockResolvedValue(rows)
	const values = jest.fn().mockReturnValue({ returning })
	mockDb.insert.mockImplementationOnce((receivedTable: unknown) => {
		expect(receivedTable).toBe(table)
		return { values }
	})
	return { values, returning }
}

function mockInsertValues(table: unknown) {
	const values = jest.fn().mockResolvedValue(undefined)
	mockDb.insert.mockImplementationOnce((receivedTable: unknown) => {
		expect(receivedTable).toBe(table)
		return { values }
	})
	return { values }
}

function mockUpdateReturning(table: unknown, rows: unknown[]) {
	const returning = jest.fn().mockResolvedValue(rows)
	const where = jest.fn().mockReturnValue({ returning })
	const set = jest.fn().mockReturnValue({ where })
	mockDb.update.mockImplementationOnce((receivedTable: unknown) => {
		expect(receivedTable).toBe(table)
		return { set }
	})
	return { set, where, returning }
}

function mockUpdateWhere(table: unknown) {
	const where = jest.fn().mockResolvedValue(undefined)
	const set = jest.fn().mockReturnValue({ where })
	mockDb.update.mockImplementationOnce((receivedTable: unknown) => {
		expect(receivedTable).toBe(table)
		return { set }
	})
	return { set, where }
}

function mockSelectRows(rows: unknown[]) {
	const orderBy = jest.fn().mockResolvedValue(rows)
	const joinedWhere = jest.fn().mockReturnValue({ orderBy })
	const innerJoin = jest.fn().mockReturnValue({ where: joinedWhere })
	const where = jest.fn().mockResolvedValue(rows)
	const from = jest.fn().mockReturnValue({ where, innerJoin })
	mockDb.select.mockReturnValueOnce({ from })
	return { from, where, innerJoin, joinedWhere, orderBy }
}

describe("QuicksignService", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe("create", () => {
		it("creates a project with the first signer and document type snapshots", async () => {
			const { service, dc, doconchainProvision, enpDocumentTypes } = createService()
			enpDocumentTypes.resolveAndValidateSelection.mockResolvedValue([
				{ id: "dt-1", pricePhp: 250 },
				{ id: "dt-2", pricePhp: 400 },
			])
			mockInsertReturning(quicksignProjects, [{ ...baseProject, status: "draft" }])
			mockUpdateReturning(quicksignProjects, [baseProject])
			const documentTypeInsert = mockInsertValues(quicksignProjectDocumentTypes)
			const signerInsert = mockInsertReturning(quicksignSigners, [
				{
					id: "signer-1",
					projectId: "qs-1",
					firstName: "Priya",
					lastName: "Client",
					email: "client@example.com",
					sequenceOrder: 1,
					signedAt: null,
					createdAt: new Date("2026-06-15T00:00:00.000Z"),
					updatedAt: new Date("2026-06-15T00:00:00.000Z"),
				},
			])
			mockSelectRows([
				{ id: "dt-1", name: "Affidavit", pricePhpSnapshot: 250 },
				{ id: "dt-2", name: "Acknowledgment", pricePhpSnapshot: 400 },
			])

			const result = await service.create(ctx, {
				title: "Document",
				documentFileId: "file-1",
				signer: {
					firstName: "Priya",
					lastName: "Client",
					email: "client@example.com",
				},
				enpDocumentTypeIds: ["dt-1", "dt-2"],
			})

			expect(enpDocumentTypes.resolveAndValidateSelection).toHaveBeenCalledWith({
				enpId: "enp-1",
				documentTypeIds: ["dt-1", "dt-2"],
			})
			expect(doconchainProvision.createProjectUuidFromPdfFile).toHaveBeenCalledWith(
				expect.objectContaining({ fileObjectId: "file-1", documentName: "Document" })
			)
			expect(documentTypeInsert.values).toHaveBeenCalledWith([
				expect.objectContaining({
					projectId: "qs-1",
					enpDocumentTypeId: "dt-1",
					pricePhpSnapshot: 250,
				}),
				expect.objectContaining({
					projectId: "qs-1",
					enpDocumentTypeId: "dt-2",
					pricePhpSnapshot: 400,
				}),
			])
			expect(dc.addSigner).toHaveBeenCalledWith(
				expect.objectContaining({
					projectUuid: "dc-1",
					email: "client@example.com",
					sequence: 1,
				})
			)
			expect(signerInsert.values).toHaveBeenCalledWith(
				expect.objectContaining({
					projectId: "qs-1",
					firstName: "Priya",
					lastName: "Client",
					email: "client@example.com",
					sequenceOrder: 1,
				})
			)
			expect(result.documentTypes).toEqual([
				{ id: "dt-1", name: "Affidavit", pricePhpSnapshot: 250 },
				{ id: "dt-2", name: "Acknowledgment", pricePhpSnapshot: 400 },
			])
		})

		it("keeps legacy create behavior when signer and document types are omitted", async () => {
			const { service, dc, enpDocumentTypes } = createService()
			mockInsertReturning(quicksignProjects, [{ ...baseProject, status: "draft" }])
			mockUpdateReturning(quicksignProjects, [baseProject])
			mockSelectRows([])

			const result = await service.create(ctx, {
				title: "Document",
				documentFileId: "file-1",
			})

			expect(enpDocumentTypes.resolveAndValidateSelection).not.toHaveBeenCalled()
			expect(dc.addSigner).not.toHaveBeenCalled()
			expect(mockDb.insert).toHaveBeenCalledTimes(1)
			expect(result.documentTypes).toEqual([])
		})

		it("rejects invalid document type selections before creating a project", async () => {
			const { service, enpDocumentTypes } = createService()
			enpDocumentTypes.resolveAndValidateSelection.mockRejectedValue(
				new ORPCError("BAD_REQUEST", { message: "Invalid document type" })
			)

			await expect(
				service.create(ctx, {
					title: "Document",
					documentFileId: "file-1",
					enpDocumentTypeIds: ["foreign-dt"],
				})
			).rejects.toBeInstanceOf(ORPCError)

			expect(mockDb.insert).not.toHaveBeenCalled()
		})
	})

	describe("finalize", () => {
		it("copies quicksign document type snapshots onto the appointment", async () => {
			const { service } = createService()
			mockInsertReturning(appointments, [
				{
					id: "apt-1",
				},
			])
			mockInsertValues(appointmentDocuments)
			mockSelectRows([
				{ enpDocumentTypeId: "dt-1", pricePhpSnapshot: 250 },
				{ enpDocumentTypeId: "dt-2", pricePhpSnapshot: 400 },
			])
			const appointmentTypeInsert = mockInsertValues(appointmentDocumentTypes)
			mockUpdateWhere(quicksignProjects)

			await service.finalize(ctx, {
				id: "qs-1",
				scheduledAt: "2026-06-15T02:00:00.000Z",
				durationMinutes: 60,
				notarizationType: "acknowledgment",
				sessionMode: "hybrid",
			})

			expect(appointmentTypeInsert.values).toHaveBeenCalledWith([
				expect.objectContaining({
					appointmentId: "apt-1",
					enpDocumentTypeId: "dt-1",
					pricePhpSnapshot: 250,
				}),
				expect.objectContaining({
					appointmentId: "apt-1",
					enpDocumentTypeId: "dt-2",
					pricePhpSnapshot: 400,
				}),
			])
		})

		it("skips appointment document type rows for legacy quicksign projects", async () => {
			const { service } = createService()
			mockInsertReturning(appointments, [
				{
					id: "apt-1",
				},
			])
			mockInsertValues(appointmentDocuments)
			mockSelectRows([])
			mockUpdateWhere(quicksignProjects)

			await service.finalize(ctx, {
				id: "qs-1",
				scheduledAt: "2026-06-15T02:00:00.000Z",
				durationMinutes: 60,
				notarizationType: "acknowledgment",
				sessionMode: "hybrid",
			})

			expect(mockDb.insert).toHaveBeenCalledTimes(2)
			expect(mockDb.insert).not.toHaveBeenCalledWith(appointmentDocumentTypes)
		})
	})
})
