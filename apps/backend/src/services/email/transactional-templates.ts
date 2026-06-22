import { privacyPolicyUrl, publicAppUrl, termsUrl } from "@/config/env.config"

import type { TransactionalEmailTemplate } from "./email-adapter"

export type RenderedEmail = { subject: string; text: string; html?: string }

type Vars = Record<string, string>

const BRAND = {
	bg: "#f4f2f8",
	card: "#ffffff",
	surface: "#faf8fd",
	border: "#e5dff0",
	text: "#140c20",
	muted: "#5c526b",
	primary: "#8b30ec",
	accent: "#c300b0",
	secondary: "#e22c9a",
	hot: "#ff5e7e",
} as const

/** Support contact shown in the "Need help?" block. Adjust to your real values. */
const SUPPORT = {
	email: "support@quanby.legal",
	phone: "+63 (2) 8000-0000",
	hours: "Monday – Friday, 9:00 AM – 6:00 PM (PHT)",
} as const

function escapeHtml(input: string): string {
	return input
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;")
}

function formatOtpForDisplay(otp: string): string {
	const d = otp.replace(/\D+/g, "")
	if (d.length === 6) return `${d.slice(0, 3)} ${d.slice(3)}`
	return otp
}

function otpEmailCopy(template: "email_verification_otp" | "login_mfa_otp") {
	if (template === "login_mfa_otp") {
		return {
			title: "Verify Your Login",
			tagline: "Secure sign-in to your QLegal account",
			subject: "Your QLegal login code",
			intro:
				"We received a request to sign in to your QLegal account. To continue, enter the 6-digit verification code below. For your security, this code is required to complete your sign-in.",
		}
	}
	return {
		title: "Verify Your Email Address",
		tagline: "Thank you for registering with QLegal",
		subject: "Verify your email — QLegal",
		intro:
			"Welcome to QLegal! To complete your registration and secure your account, please verify your email address using the 6-digit code below.",
	}
}

function firstName(raw: string): string {
	const trimmed = raw.trim()
	if (!trimmed) return "there"
	return trimmed.split(/\s+/)[0] ?? "there"
}

function renderOtpEmail(
	template: "email_verification_otp" | "login_mfa_otp",
	vars: Vars
): RenderedEmail {
	const otp = String(vars.otp ?? "").trim()
	const expiresMinutes = String(vars.expiresMinutes ?? "5").trim()
	const safeOtp = otp.replace(/\s+/g, "")
	const displayOtp = formatOtpForDisplay(safeOtp)
	const copy = otpEmailCopy(template)
	const name = firstName(String(vars.name ?? ""))
	const logoUrl = `https://pcic-insurance-app-s3-prod.s3.ap-southeast-1.amazonaws.com/qlegal_long.png`
	const year = new Date().getFullYear()

	const text = [
		copy.title,
		copy.tagline,
		"",
		`Hello ${name},`,
		"",
		copy.intro,
		"",
		`Your verification code: ${safeOtp}`,
		`This code expires in ${expiresMinutes} minutes.`,
		"",
		"Security Notice:",
		"This code is confidential. QLegal will never ask you to share it. If you didn't request this code, you can safely ignore this email.",
		"",
		"Need help?",
		`Email: ${SUPPORT.email}`,
		`Phone: ${SUPPORT.phone}`,
		`Hours: ${SUPPORT.hours}`,
		"",
		`© ${year} Quanby Legal. All rights reserved.`,
	].join("\n")

	// Table-based layout + inline styles for broad email client compatibility.
	const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${escapeHtml(copy.subject)}</title>
  </head>
  <body style="margin:0; padding:0; background:${BRAND.bg}; color:${BRAND.text}; font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, Arial, sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.bg}; margin:0; padding:0;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:560px; max-width:560px;">
            <tr>
              <td style="background:${BRAND.card}; border:1px solid ${BRAND.border}; border-radius:18px; overflow:hidden; box-shadow:0 8px 24px rgba(20,12,32,0.06);">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="height:5px; background: linear-gradient(90deg, ${BRAND.primary} 0%, ${BRAND.accent} 33%, ${BRAND.secondary} 66%, ${BRAND.hot} 100%);">&nbsp;</td>
                  </tr>

                  <tr>
                    <td align="center" style="padding:30px 32px 6px 32px;">
                      <img src="${escapeHtml(logoUrl)}" width="200" alt="QLegal" style="display:block; border:0; outline:none; text-decoration:none; max-width:200px; height:auto;">
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:14px 32px 0 32px;">
                      <div style="font-size:22px; line-height:1.3; font-weight:700; color:${BRAND.text}; letter-spacing:-0.01em;">
                        ${escapeHtml(copy.title)}
                      </div>
                      <div style="margin-top:6px; font-size:13px; line-height:1.6; color:${BRAND.muted};">
                        ${escapeHtml(copy.tagline)}
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:24px 32px 0 32px;">
                      <div style="font-size:15px; line-height:1.6; color:${BRAND.text}; font-weight:600;">
                        Hello ${escapeHtml(name)},
                      </div>
                      <div style="margin-top:10px; font-size:14px; line-height:1.7; color:${BRAND.muted};">
                        ${escapeHtml(copy.intro)}
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:22px 32px 4px 32px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.surface}; border:1px solid ${BRAND.border}; border-radius:14px;">
                        <tr>
                          <td align="center" style="padding:22px 16px 10px 16px;">
                            <div style="font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:${BRAND.muted}; font-weight:700;">
                              Your verification code
                            </div>
                            <div style="margin-top:12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size:34px; line-height:1.1; font-weight:800; color:${BRAND.text}; letter-spacing:0.2em;">
                              ${escapeHtml(displayOtp)}
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding:0 16px 18px 16px;">
                            <div style="font-size:12px; line-height:1.6; color:${BRAND.muted};">
                              This code expires in <span style="color:${BRAND.hot}; font-weight:700;">${escapeHtml(expiresMinutes)} minutes</span>.
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:14px 32px 0 32px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid ${BRAND.border}; border-radius:12px; background: rgba(255,94,126,0.06);">
                        <tr>
                          <td style="padding:14px 16px;">
                            <div style="font-size:13px; font-weight:700; color:${BRAND.text};">
                              🔒 Security Notice
                            </div>
                            <div style="margin-top:6px; font-size:12px; line-height:1.6; color:${BRAND.muted};">
                              This code is confidential. QLegal will never ask you to share it over the phone, email, or chat. If you didn't request this code, you can safely ignore this email.
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:22px 32px 0 32px;">
                      <div style="height:1px; background:${BRAND.border}; line-height:1px; font-size:0;">&nbsp;</div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:18px 32px 0 32px;">
                      <div style="font-size:15px; font-weight:700; color:${BRAND.text};">Need help?</div>
                      <div style="margin-top:6px; font-size:13px; line-height:1.6; color:${BRAND.muted};">
                        Our support team is here to assist you:
                      </div>
                      <div style="margin-top:10px; font-size:13px; line-height:1.9; color:${BRAND.muted};">
                        <div>✉&nbsp;&nbsp;<a href="mailto:${escapeHtml(SUPPORT.email)}" style="color:${BRAND.secondary}; text-decoration:none;">${escapeHtml(SUPPORT.email)}</a></div>
                        <div>☎&nbsp;&nbsp;${escapeHtml(SUPPORT.phone)}</div>
                        <div>🕒&nbsp;&nbsp;${escapeHtml(SUPPORT.hours)}</div>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:24px 32px 28px 32px;">
                      <div style="height:1px; background:${BRAND.border}; line-height:1px; font-size:0;">&nbsp;</div>
                      <div style="margin-top:16px; text-align:center; font-size:12px; line-height:1.7; color:${BRAND.muted};">
                        © ${year} Quanby Legal. All rights reserved.<br>
                        <a href="${escapeHtml(privacyPolicyUrl())}" style="color:${BRAND.muted}; text-decoration:underline;">Privacy Policy</a>
                        &nbsp;&nbsp;|&nbsp;&nbsp;
                        <a href="${escapeHtml(termsUrl())}" style="color:${BRAND.muted}; text-decoration:underline;">Terms of Service</a>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

	return { subject: copy.subject, text, html }
}

export function renderTransactionalEmail(
	template: TransactionalEmailTemplate,
	vars: Vars,
	opts?: { subjectFallback?: string }
): RenderedEmail {
	if (template === "email_verification_otp" || template === "login_mfa_otp") {
		return renderOtpEmail(template, vars)
	}

	// Default fallback for other templates (keeps existing behavior).
	const subject = opts?.subjectFallback ?? template
	const text = `${template}\n\n${Object.entries(vars)
		.map(([k, v]) => `${k}: ${v}`)
		.join("\n")}`
	return { subject, text }
}
