/**
 * Probe TLPE checkout per brand. Run: node scripts/tlpe-probe-brands.mjs
 */
import { createHmac, randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const envText = readFileSync(resolve(__dirname, "../.env"), "utf8")
const env = Object.fromEntries(
	envText
		.split("\n")
		.filter(l => l && !l.startsWith("#") && l.includes("="))
		.map(l => {
			const i = l.indexOf("=")
			return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
		})
)

const AUTH = env.TLPE_AUTHORIZATION
const SECRET = env.TLPE_SECRET
const API = env.TLPE_API_URL?.replace(/\/$/, "")
const CALLBACK = env.TLPE_CALLBACK_URL

function signJwt(payload) {
	const header = { typ: "JWT", alg: "HS256" }
	const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url")
	const data = `${enc(header)}.${enc(payload)}`
	const sig = createHmac("sha256", SECRET).update(data).digest("base64url")
	return `${data}.${sig}`
}

function buildCheckoutPayload(optionCode, ref) {
	const now = Math.floor(Date.now() / 1000)
	const data = {
		customer: {
			first_name: "Probe",
			last_name: "User",
			billing_address: {
				line1: "Philippines",
				line2: "N/A",
				city_municipality: "Manila",
				zip: "1000",
				state_province_region: "NCR",
				country_code: "PH",
			},
			shipping_address: {
				line1: "Philippines",
				line2: "N/A",
				city_municipality: "Manila",
				zip: "1000",
				state_province_region: "NCR",
				country_code: "PH",
			},
			contact: { email: "probe@qlegal.local", mobile: "+639171234567" },
		},
		payment: {
			description: "Meeting fees test",
			amount: 305,
			currency: "PHP",
			option: optionCode,
			merchant_reference_id: ref,
		},
		route: { callback_url: CALLBACK, notify_user: false },
		time_offset: "+08:00",
	}
	return {
		iss: "TLPE",
		sub: "TLPE Base Router Authentication",
		aud: "TLPE Base Router",
		exp: now + 300,
		iat: now,
		jti: randomUUID(),
		method: "POST",
		path: "/checkout",
		data,
	}
}

const optsRes = await fetch(`${API}/options`, {
	headers: { Authorization: AUTH, "Content-Type": "application/json" },
})
const opts = await optsRes.json()
console.log("Brands:", opts.map(o => o.value).join(", "))

for (const brand of ["Maya", "GCash", "GrabPay", "QR Ph"]) {
	const row = opts.find(o => o.value === brand)
	if (!row) {
		console.log(`${brand}: NOT IN OPTIONS`)
		continue
	}
	const ref = `probe-${brand}-${Date.now()}`
	const jwt = signJwt(buildCheckoutPayload(row.code, ref))
	const res = await fetch(`${API}/checkout`, {
		method: "POST",
		headers: { Authorization: AUTH, "Content-Type": "application/json" },
		body: JSON.stringify({ payload: jwt }),
	})
	const body = await res.json()
	const code = body.data?.status_code ?? res.status
	const desc = body.data?.status_description ?? body.message ?? ""
	const url = body.data?.payment_url ?? ""
	console.log(
		`${brand}: ${code} ${desc}${url ? ` → ${url.slice(0, 55)}...` : ""}`
	)
}
