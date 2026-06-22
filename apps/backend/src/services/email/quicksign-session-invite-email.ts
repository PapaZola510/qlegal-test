export function buildQuicksignSessionInviteEmail(args: {
	recipientName: string
	enpName: string
	documentTitle: string
	notarizationTypeLabel: string
	joinSessionUrl: string
	signDocumentUrl: string
	/** In-person (IEN) QuickSign: principal must acknowledge the notarial statement before signing. */
	requiresIenAcknowledgment?: boolean
}): { subject: string; html: string; text: string } {
	const ien = args.requiresIenAcknowledgment === true
	const subject = ien
		? `${args.enpName} invited you to acknowledge and sign a document`
		: `${args.enpName} invited you to sign a document`

	const ienNoticeText = ien
		? [
				"Before you can sign, you will be asked to read a notarial acknowledgment statement and check a box confirming that you have read and acknowledge it.",
				"",
			]
		: []

	const ienNoticeHtml = ien
		? `<p style="margin:16px 0 0;padding:12px;background:rgba(124,58,237,0.12);border:1px solid rgba(124,58,237,0.35);border-radius:8px;color:#c4b5fd;font-size:13px;line-height:1.5;">
            <strong style="color:#e9d5ff;">Before signing:</strong> You will be asked to read the notarial acknowledgment statement and check a box confirming that you have read and acknowledge it. Your acknowledgment is recorded in the notarial registry.
          </p>`
		: ""

	const signCta = ien ? "Review and sign document" : "Sign document now"

	const text = [
		`Hello ${args.recipientName},`,
		"",
		`${args.enpName} has prepared "${args.documentTitle}" for your signature (${args.notarizationTypeLabel}).`,
		"",
		...ienNoticeText,
		...(ien ? [] : ["Join the session:", args.joinSessionUrl, ""]),
		`${signCta}:`,
		args.signDocumentUrl,
		"",
		"Quanby Legal — Electronic Notarization",
	].join("\n")

	const joinSessionBlock = ien
		? ""
		: `<tr><td style="padding:24px 0 12px;text-align:center;">
            <a href="${args.joinSessionUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
              Join session
            </a>
          </td></tr>`

	const footerNote = ien
		? `This is an in-person electronic notarization (IEN). Use <strong style="color:#a78bfa;">${escapeHtml(signCta)}</strong> to acknowledge the notarial statement, then complete your signature.`
		: `Use <strong style="color:#a78bfa;">Join session</strong> for the hybrid video lobby, or <strong style="color:#a78bfa;">Sign document now</strong> to open the signing screen directly.`

	const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#05060f;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#05060f;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0f1117;border-radius:12px;padding:32px;color:#f1f5f9;">
          <tr><td style="text-align:center;padding-bottom:20px;">
            <h2 style="margin:0 0 8px;color:#a78bfa;font-size:20px;">You have a document to sign</h2>
            <p style="margin:0;color:#8892a4;font-size:14px;">Quanby Legal — Electronic Notarization</p>
          </td></tr>
          <tr><td style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:20px;font-size:14px;line-height:1.5;">
            <p style="margin:0 0 12px;">Hello <strong>${escapeHtml(args.recipientName)}</strong>,</p>
            <p style="margin:0 0 16px;color:#8892a4;">
              <strong style="color:#f1f5f9;">${escapeHtml(args.enpName)}</strong> has prepared a document for your signature.
            </p>
            <p style="margin:0 0 6px;"><span style="color:#8892a4;">Document:</span> ${escapeHtml(args.documentTitle)}</p>
            <p style="margin:0;"><span style="color:#8892a4;">Type:</span> ${escapeHtml(args.notarizationTypeLabel)}</p>
            ${ienNoticeHtml}
          </td></tr>
          ${joinSessionBlock}
          <tr><td style="padding:0 0 20px;text-align:center;">
            <a href="${args.signDocumentUrl}" style="display:inline-block;background:#1e293b;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;border:1px solid #334155;">
              ${escapeHtml(signCta)}
            </a>
          </td></tr>
          <tr><td style="color:#8892a4;font-size:12px;line-height:1.5;text-align:center;">
            ${footerNote}
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

	return { subject, html, text }
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
}
