# DocOnChain: project UUID vs vault item UUID

## What we persist

| ID | Source | DB column |
| --- | --- | --- |
| **Project UUID** | `POST /api/v2/projects?user_type=ENTERPRISE_API` (multipart: `file`, `document_stamp`, `user_list_editable`, `creator_as_viewer`, `type`) → `data.uuid` | `quicksign_projects.doconchain_project_uuid` (`doconchainProjectUuid`) |
| **Vault item UUID** | `GET /vault/items` list row `uuid`, or detail `GET /vault/items/{uuid}` | **Not stored** — resolved at runtime |
| **Notarized PDF (S3)** | Fetched from DocOnChain after signing completes | `quicksign_projects.notarized_file_object_id` → `file_objects` (`purpose: qs_signed`) |

Meeting uploads and QuickSign flows save only the **create-project** id. There is no `vaultUuid` column in Drizzle.

## Runtime resolution (sealed / notarized PDF)

Implemented in `DoconchainAdapterService` (`apps/backend/src/services/doconchain/doconchain-adapter.service.ts`):

1. **Direct vault lookup** — `GET /vault/items/{doconchainProjectUuid}` (and `/download`). On some stacks the path segment equals the project id.
2. **Vault list remap** — If detail returns not found, page `GET /vault/items` and find a row where `project_uuid` (or row `uuid` / `id`) matches the stored create-project id.
3. **Retry with vault row id** — `GET /vault/items/{listRow.uuid}` (and download) using `category_id` / `client_id` from the list row when required.

`resolveVaultNotarizedPdf` follows steps 1–3 for HTTPS URLs. `streamVaultNotarizedPdfToResponse` uses the same order for the meeting proxy (`GET …/notarized-pdf`).

## API surface

- `listMeetingDocumentSigners` may return `notarizedDocumentUrl` (HTTPS link) when vault resolution succeeds during polling — optional UX hint, not a stored vault id.
- View/Download in the meeting UI use the backend proxy with **only** `meetingId` + `documentId`; the server loads `doconchainProjectUuid` and runs vault resolution on each request.

## Related

- Registry refresh-notarized flows use the same adapter.
- Legacy Quanby Sign: `download-sealed-project.ts` (`fetchFromVaultFileUrl`) — same three-step pattern.
