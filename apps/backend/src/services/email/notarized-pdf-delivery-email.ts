export function buildNotarizedPdfDeliveryEmail(args: { documentTitle: string; enpName: string }): {
	subject: string
	html: string
	text: string
	filename: string
} {
	const title = args.documentTitle.trim() || "Notarized document"
	const safeTitle = title.replace(/[^\w\s.-]+/g, "").trim() || "notarized-document"
	const filename = safeTitle.toLowerCase().endsWith(".pdf")
		? safeTitle
		: `${safeTitle.replace(/\s+/g, "-")}-notarized.pdf`

	const subject = `Your notarized document is ready — ${title}`

	const text = [
		"Hello,",
		"",
		`Your document "${title}" has been fully signed and notarized by ${args.enpName}.`,
		"The sealed notarized PDF is attached to this email.",
		"",
		"You can also view completed documents anytime by signing in to Quanby Legal under Signed.",
		"",
		"Quanby Legal — Electronic Notarization",
	].join("\n")

	const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#05060f;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#05060f;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0f1117;border-radius:12px;padding:32px;color:#f1f5f9;">
          <tr><td style="text-align:center;padding-bottom:20px;">
            <h2 style="margin:0 0 8px;color:#a78bfa;font-size:20px;">Notarized document ready</h2>
            <p style="margin:0;color:#8892a4;font-size:14px;">Quanby Legal — Electronic Notarization</p>
          </td></tr>
          <tr><td style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:20px;font-size:14px;line-height:1.5;">
            <p style="margin:0 0 12px;">Hello,</p>
            <p style="margin:0 0 16px;color:#8892a4;">
              <strong style="color:#f1f5f9;">${escapeHtml(title)}</strong> has been fully signed and notarized by
              <strong style="color:#f1f5f9;">${escapeHtml(args.enpName)}</strong>.
            </p>
            <p style="margin:0;color:#8892a4;">The sealed notarized PDF is attached to this email.</p>
          </td></tr>
          <tr><td style="color:#8892a4;font-size:12px;line-height:1.5;text-align:center;padding-top:20px;">
            You may also sign in to Quanby Legal and open the Signed section to download this document again.
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

	return { subject, html, text, filename }
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
}
