export function buildSessionGuestInviteEmail(args: {
	enpName: string
	appointmentTitle: string
	intendedRoleLabel: string
	joinMeetingUrl: string
}): { subject: string; html: string; text: string } {
	const subject = `${args.enpName} invited you to a notarization session`
	const text = [
		"Hello,",
		"",
		`${args.enpName} has invited you to join a live notarization session as ${args.intendedRoleLabel}.`,
		"",
		`Session: ${args.appointmentTitle}`,
		"",
		"Join the live meeting (sign in or create an account if prompted):",
		args.joinMeetingUrl,
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
            <h2 style="margin:0 0 8px;color:#a78bfa;font-size:20px;">You're invited to a session</h2>
            <p style="margin:0;color:#8892a4;font-size:14px;">Quanby Legal — Electronic Notarization</p>
          </td></tr>
          <tr><td style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:20px;font-size:14px;line-height:1.5;">
            <p style="margin:0 0 12px;">Hello,</p>
            <p style="margin:0 0 16px;color:#8892a4;">
              <strong style="color:#f1f5f9;">${escapeHtml(args.enpName)}</strong> invited you to join a live session as
              <strong style="color:#f1f5f9;">${escapeHtml(args.intendedRoleLabel)}</strong>.
            </p>
            <p style="margin:0;"><span style="color:#8892a4;">Session:</span> ${escapeHtml(args.appointmentTitle)}</p>
          </td></tr>
          <tr><td style="padding:24px 0 12px;text-align:center;">
            <a href="${args.joinMeetingUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
              Join live meeting
            </a>
          </td></tr>
          <tr><td style="color:#8892a4;font-size:12px;line-height:1.5;text-align:center;">
            Sign in with Google or create an account if prompted, then you will enter the live meeting room.
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

export function formatSessionGuestRoleLabel(role: "principal" | "witness"): string {
	return role === "witness" ? "a witness" : "a principal signer"
}
