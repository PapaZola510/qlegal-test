import type { UserProfile } from "@repo/contracts"

import { displayEntryNumber, type RegistryAct } from "./fixtures"
import { formatScEntryNo } from "./sc-entry-number"
import { scNotarialActLabel, scNotarizationMode } from "./sc-notarial-act-labels"

export { formatScEntryNo } from "./sc-entry-number"

const ENF_NAME = "Quanby Legal"
const ENF_ACCREDITATION_PLACEHOLDER = "—"
const FACILITY_NAME = "Quanby Legal — Electronic Notary Services"

/** SC Electronic Notarial Book columns: entry no. (0) + cols 1–11 per Rule on Electronic Notarization. */
export const NOTARIAL_REGISTER_COLUMN_COUNT = 12

export type NotarialRegisterExportContext = {
	profile: UserProfile
	/** Site origin for absolute image URLs (required when HTML is opened via blob: URL). */
	assetOrigin: string
	/** Optional ENF accreditation number when configured for the deployment. */
	enfAccreditationNo?: string
}

const REGISTER_ASSET_PATHS = {
	scSeal: "/registry/sc-seal.svg",
	enfLogo: "/LOGO.png",
} as const

function registerAssetUrl(origin: string, path: string): string {
	const base = origin.replace(/\/$/, "")
	return `${base}${path}`
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
}

function formatEnpDisplayName(profile: UserProfile): string {
	const prefix = profile.namePrefix?.trim()
	const name = profile.name.trim()
	return prefix ? `${prefix} ${name}` : name
}

function formatCommissionDate(iso: string | null | undefined): string {
	if (!iso?.trim()) return "—"
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return iso
	return d.toLocaleDateString("en-PH", { day: "2-digit", month: "long", year: "numeric" })
}

function formatScDateTime(iso: string): string {
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return iso
	return d.toLocaleString("en-PH", {
		day: "2-digit",
		month: "long",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	})
}

function formatPrincipalNameAddress(
	principals: { name: string; role: string }[],
	fallbackAddress: string | null
): string {
	if (principals.length === 0) return "—"
	const address = fallbackAddress?.trim() || "Address on file"
	return principals.map(p => `${p.name.trim()}, ${address}`).join("; ")
}

function formatWitnessNameAddress(witnesses: string[], fallbackAddress: string | null): string {
	if (witnesses.length === 0) return "—"
	const address = fallbackAddress?.trim() || "Address on file"
	return witnesses.map(w => `${w.trim()}, ${address}`).join("; ")
}

function formatCompetentEvidenceOfIdentity(act: RegistryAct): string {
	const parts: string[] = []
	for (const p of act.principals) {
		const role = p.role.trim()
		const evidence =
			role && !/\bwitness\b/i.test(role) ? role : "Competent evidence of identity on file"
		parts.push(`${p.name.trim()}: ${evidence}`)
	}
	for (const w of act.witnesses) {
		const name = w.trim()
		if (name) parts.push(`${name}: Competent evidence of identity on file`)
	}
	return parts.length > 0 ? parts.join("; ") : "—"
}

function resolveFeeColumn(act: RegistryAct): string {
	const fee = act.fee > 0 ? `PHP ${act.fee.toLocaleString("en-PH")}` : "PHP 0"
	if (act.completionStatus === "completed") {
		return `${fee} — quoted at booking; payment collected before notarization was completed`
	}
	if (act.appointmentId) {
		return `${fee} — fee quoted at booking (payment pending notarization completion)`
	}
	return fee
}

/** Col. 8 — parties within the Philippines (or limited extraterritorial performance). */
function resolveLocationStatement(act: RegistryAct, profile: UserProfile): string {
	const geolocation = act.notarizationLocation?.trim() || act.location?.trim()
	if (
		geolocation &&
		geolocation !== "—" &&
		!geolocation.startsWith("Book ") &&
		!/embassy|consular|honorary consul/i.test(geolocation)
	) {
		return `The electronic notarial act was executed while all parties concerned were situated within the Philippines (${geolocation}).`
	}
	if (geolocation && /embassy|consular|honorary consul/i.test(geolocation)) {
		return `Limited extraterritorial performance: ${geolocation}`
	}
	const area = profile.commissionArea?.trim() || profile.regionProvinceCity?.trim()
	if (area) {
		return `The electronic notarial act was executed while all parties concerned were situated within the Philippines (${area}).`
	}
	return "The electronic notarial act was executed while all parties concerned were situated within the Philippines (geolocation verified at session lobby)."
}

function resolveDocumentReferenceNo(act: RegistryAct): string {
	if (act.nrid !== "—" && !act.nrid.startsWith("NRID-STUB-")) return act.nrid
	if (act.nrn !== "—") return act.nrn
	const code = act.documentCode?.trim()
	if (code) return code
	const project = act.projectUuid?.trim()
	if (project) return project
	return "—"
}

/** Col. 9 — IEN/REN mode and other circumstances the ENP deems significant. */
function resolveModeAndCircumstances(act: RegistryAct): string {
	const parts: string[] = [scNotarizationMode(act.sessionMode)]
	const ref = resolveDocumentReferenceNo(act)
	if (ref !== "—") parts.push(`Entry no. on instrument matches ENB: ${ref}`)
	const enpAck = (act.ienNotarialAttestations ?? []).find(a => a.role === "enp")
	if (enpAck) {
		const when = enpAck.confirmedAt ? formatEnbSignatureWhen(enpAck.confirmedAt) : ""
		parts.push(
			`ENP attestation (${enpAck.signerName}${when ? `, ${when}` : ""}): ${enpAck.acknowledgmentText}`
		)
	}
	if (act.appointmentPurpose?.trim()) {
		parts.push(`Booking notes: ${act.appointmentPurpose.trim()}`)
	}
	if (act.documentUrl?.trim()) {
		parts.push("Notarized electronic document and AVRs on file with the ENF")
	}
	if (act.scFailureReason?.trim()) {
		parts.push(`Registry sync note: ${act.scFailureReason.trim()}`)
	} else if (act.scSync === "pending" || act.scSync === "not_started") {
		parts.push("Pending Supreme Court NENR sync")
	}
	if (act.actType === "protest") {
		parts.push(
			"Protest of draft/bill/note: full proceedings recorded in ENB protest proceedings (demand, presentation, notices)"
		)
	}
	return parts.join("; ")
}

/** Col. 10 — reasons and circumstances for not completing the electronic notarial act. */
function resolveIncompleteColumn(act: RegistryAct): string {
	if (act.completionStatus === "incomplete") {
		const reason = act.incompleteReason?.trim()
		const circumstances = act.incompleteCircumstances?.trim()
		if (reason && circumstances) return `${reason}. Circumstances: ${circumstances}`
		if (reason) return reason
		if (circumstances) return circumstances
		return "Electronic notarial act not completed"
	}
	if (act.scSync === "failed" && act.scFailureReason?.trim()) {
		return `Not completed for registry purposes: ${act.scFailureReason.trim()}`
	}
	if (act.pdfUploadPending) {
		return "Not completed: notarized electronic document pending upload to ENF"
	}
	return "—"
}

/** Col. 11 — inspect/copy (and CTC) requests; separate ENB transactions when fees apply. */
function resolveInspectCopyColumn(act: RegistryAct): string {
	const requests = act.enbAccessRequests ?? []
	if (requests.length === 0) return "—"

	return requests
		.map(req => {
			const kind = req.certifiedTrueCopy
				? "Certified true copy (CTC)"
				: req.requestType === "copy"
					? "Copy"
					: "Inspect"
			const outcome =
				req.outcome === "granted"
					? "Granted"
					: req.outcome === "refused"
						? `Refused — ${req.refusalReason?.trim() || "reason on file"}`
						: "Pending ENP decision"
			const decided = req.decidedAt ? formatScDateTime(req.decidedAt) : ""
			const identity = req.identityEvidenceFileObjectId
				? "Competent evidence of identity on file"
				: "Identity evidence per ENF records"
			const signature =
				req.requesterSignatureImageData || req.requesterSignatureFileObjectId
					? "Electronic signature on file"
					: "Signature per ENF records"
			return [
				`${kind} request`,
				`Requester: ${req.requesterName}, ${req.requesterAddress}`,
				signature,
				identity,
				`Lawful purpose: ${req.lawfulPurpose}`,
				`Outcome: ${outcome}${decided ? ` (${decided})` : ""}`,
			].join("; ")
		})
		.join(" | ")
}

function formatEnbSignatureWhen(signedAt: string): string {
	return new Date(signedAt).toLocaleString("en-PH", {
		day: "2-digit",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	})
}

function registerRowCells(act: RegistryAct, profile: UserProfile): string[] {
	const addressFallback =
		profile.officeAddress?.trim() ||
		profile.residentialAddress?.trim() ||
		profile.regionProvinceCity?.trim() ||
		null
	const auto = (text: string) => `<span class="auto">${escapeHtml(text)}</span>`
	const manual = (text: string) => `<span class="manual">${escapeHtml(text)}</span>`

	return [
		auto(displayEntryNumber(act)),
		manual(scNotarialActLabel(act.actType)),
		manual(formatScDateTime(act.executedAt)),
		manual(act.documentTitle.trim() || "—"),
		auto(formatPrincipalNameAddress(act.principals, addressFallback)),
		auto(formatWitnessNameAddress(act.witnesses, addressFallback)),
		auto(formatCompetentEvidenceOfIdentity(act)),
		auto(resolveFeeColumn(act)),
		manual(resolveLocationStatement(act, profile)),
		auto(resolveModeAndCircumstances(act)),
		auto(resolveIncompleteColumn(act)),
		auto(resolveInspectCopyColumn(act)),
	]
}

function buildRegisterBodyRows(acts: RegistryAct[], profile: UserProfile): string {
	const minRows = 3
	const rows = acts.map(act => {
		const cells = registerRowCells(act, profile)
		return `<tr>${cells.map(c => `<td>${c}</td>`).join("")}</tr>`
	})
	for (let i = rows.length; i < minRows; i++) {
		rows.push(
			`<tr>${Array.from({ length: NOTARIAL_REGISTER_COLUMN_COUNT }, () => "<td>&nbsp;</td>").join("")}</tr>`
		)
	}
	return rows.join("")
}

function footerPageMeta(acts: RegistryAct[]): { pageNo: string; monthNo: string; yearNo: string } {
	const ref = acts[0]
	if (!ref) {
		const now = new Date()
		return {
			pageNo: "001",
			monthNo: String(now.getMonth() + 1).padStart(2, "0"),
			yearNo: String(now.getFullYear()),
		}
	}
	const d = new Date(ref.executedAt || ref.date)
	return {
		pageNo: (ref.pageNo?.trim() || "001").replace(/\D/g, "").padStart(3, "0").slice(-3) || "001",
		monthNo: String(d.getMonth() + 1).padStart(2, "0"),
		yearNo: String(d.getFullYear()),
	}
}

export function buildNotarialRegisterHtml(
	acts: RegistryAct[],
	ctx: NotarialRegisterExportContext
): string {
	const { profile } = ctx
	const enpName = formatEnpDisplayName(profile)
	const roll = profile.rollNumber?.trim() || "—"
	const commission = profile.commissionNumber?.trim() || "—"
	const commissionEnd = formatCommissionDate(profile.commissionExpiry)
	const enfAccreditation = ctx.enfAccreditationNo?.trim() || ENF_ACCREDITATION_PLACEHOLDER
	const { pageNo, monthNo, yearNo } = footerPageMeta(acts)
	const bodyRows = buildRegisterBodyRows(acts, profile)
	const scSealUrl = registerAssetUrl(ctx.assetOrigin, REGISTER_ASSET_PATHS.scSeal)
	const enfLogoUrl = registerAssetUrl(ctx.assetOrigin, REGISTER_ASSET_PATHS.enfLogo)

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Electronic Notarial Register</title>
<style>
  @page { size: landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 7pt;
    color: #000;
    margin: 0;
    padding: 0;
  }
  .sheet { width: 100%; }
  .header-grid {
    display: grid;
    grid-template-columns: 1fr 2.2fr 1fr;
    gap: 6px;
    align-items: start;
    margin-bottom: 6px;
  }
  .box {
    border: 1px solid #000;
    padding: 4px 6px;
    min-height: 52px;
    font-size: 7pt;
    line-height: 1.35;
  }
  .box.dashed { border-style: dashed; }
  .title-block {
    text-align: center;
    padding: 2px 4px;
  }
  .title-seals {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .title-seals .seal-img {
    width: 44px;
    height: 44px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .title-seals .title-text { flex: 1; min-width: 0; }
  .enf-logo-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 4px;
  }
  .enf-logo-wrap img {
    max-width: 100%;
    max-height: 40px;
    object-fit: contain;
  }
  .title-block h1 {
    font-size: 11pt;
    margin: 2px 0 0;
    letter-spacing: 0.02em;
  }
  .title-block h2 {
    font-size: 13pt;
    margin: 4px 0 2px;
    font-weight: 700;
  }
  .title-block p { margin: 0; font-size: 7.5pt; }
  .cert {
    border: 1px solid #000;
    padding: 5px 8px;
    margin-bottom: 6px;
    font-size: 7pt;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    align-items: end;
  }
  .cert p { margin: 0 0 4px; }
  .sig-box {
    border: 1px solid #000;
    min-width: 120px;
    min-height: 36px;
    text-align: center;
    font-size: 6.5pt;
    padding: 4px;
  }
  table.register {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 5.8pt;
  }
  table.register th,
  table.register td {
    border: 1px solid #000;
    padding: 2px 3px;
    vertical-align: top;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  table.register th {
    font-weight: 700;
    text-align: center;
    font-size: 5.5pt;
    line-height: 1.15;
    background: #f5f5f5;
  }
  .auto { color: #0d6b0d; }
  .manual { color: #0a0a8a; }
  .footer {
    display: flex;
    justify-content: flex-end;
    align-items: flex-end;
    gap: 16px;
    margin-top: 6px;
    font-size: 6.5pt;
  }
  .legend { text-align: right; line-height: 1.4; }
  .legend .auto { font-weight: 600; }
  .legend .manual { font-weight: 600; }
  .page-boxes {
    display: flex;
    gap: 6px;
  }
  .page-box {
    border: 1px solid #000;
    padding: 2px 8px;
    text-align: center;
    min-width: 48px;
  }
  .page-box strong { display: block; font-size: 5.5pt; }
  .watermark {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 0;
    opacity: 0.12;
    font-size: 72pt;
    font-weight: 700;
    color: #888;
    transform: rotate(-35deg);
  }
  .content { position: relative; z-index: 1; }
  @media print {
    .watermark { opacity: 0.1; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="watermark">DRAFT</div>
<div class="content sheet">
  <div class="header-grid">
    <div class="box">
      <div><strong>ENP Name:</strong> ${escapeHtml(enpName)}</div>
      <div><strong>Roll Number:</strong> ${escapeHtml(roll)}</div>
      <div><strong>ENP NPN:</strong> ${escapeHtml(commission)}</div>
      <div><strong>Commissioning Validity:</strong> Start: — &nbsp; End: ${escapeHtml(commissionEnd)}</div>
    </div>
    <div class="title-block">
      <div class="title-seals">
        <img class="seal-img" src="${escapeHtml(scSealUrl)}" alt="Supreme Court of the Philippines" />
        <div class="title-text">
          <p>Supreme Court of the Philippines</p>
          <p>Electronic Notary Services</p>
          <h2>NOTARIAL REGISTER</h2>
        </div>
        <img class="seal-img" src="${escapeHtml(scSealUrl)}" alt="Electronic Notary Services" />
      </div>
    </div>
    <div>
      <div class="box dashed" style="margin-bottom:4px;">
        <div class="enf-logo-wrap">
          <img src="${escapeHtml(enfLogoUrl)}" alt="${escapeHtml(ENF_NAME)}" />
        </div>
      </div>
      <div class="box" style="text-align:center;"><strong>ENF Accreditation No.</strong><br />${escapeHtml(enfAccreditation)}</div>
    </div>
  </div>

  <div class="cert">
    <div>
      <p>I certify that the instruments listed below were sworn to or acknowledged before me pursuant to the Rules on Electronic Notarization. I further certify to the accuracy and chronology of the entries in this Electronic Notarial Book, using the facility <strong>${escapeHtml(FACILITY_NAME)}</strong>.</p>
    </div>
    <div class="sig-box"><strong>ENP Digital Signature</strong></div>
  </div>

  <table class="register">
    <thead>
      <tr>
        <th>ENTRY NO.<br /><span style="font-weight:400;font-size:5pt;">Document No.-Page No.-Month No.-Year</span></th>
        <th>ELECTRONIC NOTARIAL ACT EXECUTED</th>
        <th>DATE AND TIME OF ELECTRONIC NOTARIAL ACT</th>
        <th>TITLE OR DESCRIPTION OF NOTARIZED ELECTRONIC DOCUMENT</th>
        <th>NAME AND ADDRESS OF EACH PRINCIPAL</th>
        <th>NAME AND ADDRESS OF EACH WITNESS (IF ANY)</th>
        <th>COMPETENT EVIDENCE OF IDENTITY (PRINCIPALS AND WITNESSES)</th>
        <th>FEE CHARGED<br /><span style="font-weight:400;font-size:5pt;">Quoted at booking; payment collected before completion</span></th>
        <th>STATEMENT: PARTIES WITHIN THE PHILIPPINES OR LIMITED EXTRATERRITORIAL VENUE</th>
        <th>MODE OF NOTARIZATION (IEN/REN) AND OTHER SIGNIFICANT CIRCUMSTANCES</th>
        <th>REASONS AND CIRCUMSTANCES FOR NOT COMPLETING THE ACT</th>
        <th>INSPECT / COPY / CTC REQUESTS (REQUESTER, IDENTITY, PURPOSE, OUTCOME)</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>

  <div class="footer">
    <div class="legend">
      <div><span class="auto">Green</span> — auto-filled data</div>
      <div><span class="manual">Blue</span> — for input</div>
    </div>
    <div class="page-boxes">
      <div class="page-box"><strong>PAGE NO.</strong>${escapeHtml(pageNo)}</div>
      <div class="page-box"><strong>MONTH NO.</strong>${escapeHtml(monthNo)}</div>
      <div class="page-box"><strong>YEAR NO.</strong>${escapeHtml(yearNo)}</div>
    </div>
  </div>
</div>
<script>
  window.addEventListener("load", function () {
    window.setTimeout(function () { window.print(); }, 300);
  });
</script>
</body>
</html>`
}

/** Opens the register in a new tab and triggers print (Save as PDF). */
export function openNotarialRegisterPrintWindow(html: string): void {
	const blob = new Blob([html], { type: "text/html;charset=utf-8" })
	const url = URL.createObjectURL(blob)

	const win = window.open(url, "_blank")
	if (win) {
		win.addEventListener("load", () => URL.revokeObjectURL(url), { once: true })
		return
	}

	URL.revokeObjectURL(url)

	const iframe = document.createElement("iframe")
	iframe.setAttribute("title", "Notarial register export")
	iframe.style.cssText =
		"position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden"
	iframe.srcdoc = html
	document.body.appendChild(iframe)

	iframe.onload = () => {
		try {
			iframe.contentWindow?.focus()
			iframe.contentWindow?.print()
		} finally {
			window.setTimeout(() => iframe.remove(), 500)
		}
	}
}
