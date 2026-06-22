import {
	createHmac,
	createPrivateKey,
	createPublicKey,
	sign,
	timingSafeEqual,
	verify,
	type KeyObject,
} from "node:crypto"

function base64UrlEncode(input: Buffer | string): string {
	const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input
	return buf.toString("base64url")
}

function base64UrlDecode(input: string): Buffer {
	return Buffer.from(input, "base64url")
}

function loadRsaPrivateKey(secret: string): KeyObject | null {
	const trimmed = secret.trim()
	if (!trimmed) return null
	try {
		return createPrivateKey({
			key: Buffer.from(trimmed, "base64"),
			format: "der",
			type: "pkcs8",
		})
	} catch {
		try {
			return createPrivateKey({
				key: Buffer.from(trimmed, "base64"),
				format: "der",
				type: "pkcs1",
			})
		} catch {
			return null
		}
	}
}

function loadRsaPublicKey(authorization: string): KeyObject | null {
	const trimmed = authorization.trim()
	if (!trimmed) return null
	try {
		return createPublicKey({
			key: Buffer.from(trimmed, "base64"),
			format: "der",
			type: "spki",
		})
	} catch {
		return null
	}
}

export type TlpeJwtAlgorithm = "HS256" | "RS256"

/** Pick signing algorithm. TLPE test API uses HS256; live uses RS256 when secret is RSA PKCS#8. */
export function resolveTlpeSigningAlgorithm(secret: string, apiUrl?: string): TlpeJwtAlgorithm {
	const url = apiUrl?.trim() ?? ""
	if (url.includes("test-api") || url.includes("test.")) return "HS256"
	return loadRsaPrivateKey(secret) ? "RS256" : "HS256"
}

/** Sign a JWT for TLPE checkout / notify responses ([checkout docs](https://developers.tlpe.io/post-payment-checkout/)). */
export function signTlpeJwt(
	payload: Record<string, unknown>,
	secret: string,
	options?: { algorithm?: TlpeJwtAlgorithm }
): string {
	const alg = options?.algorithm ?? resolveTlpeSigningAlgorithm(secret)
	const header = base64UrlEncode(JSON.stringify({ alg, typ: "JWT" }))
	const body = base64UrlEncode(JSON.stringify(payload))
	const data = `${header}.${body}`

	if (alg === "RS256") {
		const privateKey = loadRsaPrivateKey(secret)
		if (!privateKey) throw new Error("TLPE_SECRET is not a valid RSA private key")
		const signature = sign("RSA-SHA256", Buffer.from(data, "utf8"), privateKey).toString(
			"base64url"
		)
		return `${data}.${signature}`
	}

	const signature = createHmac("sha256", secret).update(data).digest("base64url")
	return `${data}.${signature}`
}

function verifyHs256<T extends Record<string, unknown>>(token: string, secret: string): T | null {
	const parts = token.split(".")
	if (parts.length !== 3) return null
	const [headerB64, payloadB64, sigB64] = parts
	if (!headerB64 || !payloadB64 || !sigB64) return null

	const data = `${headerB64}.${payloadB64}`
	const expected = createHmac("sha256", secret).update(data).digest()
	let actual: Buffer
	try {
		actual = base64UrlDecode(sigB64)
	} catch {
		return null
	}
	if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
		return null
	}

	try {
		return JSON.parse(base64UrlDecode(payloadB64).toString("utf8")) as T
	} catch {
		return null
	}
}

function verifyRs256<T extends Record<string, unknown>>(
	token: string,
	publicKey: KeyObject
): T | null {
	const parts = token.split(".")
	if (parts.length !== 3) return null
	const [headerB64, payloadB64, sigB64] = parts
	if (!headerB64 || !payloadB64 || !sigB64) return null

	const data = `${headerB64}.${payloadB64}`
	let signature: Buffer
	try {
		signature = base64UrlDecode(sigB64)
	} catch {
		return null
	}

	const ok = verify("RSA-SHA256", Buffer.from(data, "utf8"), publicKey, signature)
	if (!ok) return null

	try {
		return JSON.parse(base64UrlDecode(payloadB64).toString("utf8")) as T
	} catch {
		return null
	}
}

/** Verify TLPE JWT (notify webhook). Tries RS256 with Authorization public key, then HS256 with Secret. */
export function verifyTlpeJwt<T extends Record<string, unknown>>(
	token: string,
	secret: string,
	authorization?: string
): T | null {
	const pub = authorization ? loadRsaPublicKey(authorization) : null
	if (pub) {
		const rs = verifyRs256<T>(token, pub)
		if (rs) return rs
	}
	return verifyHs256<T>(token, secret)
}

/** Reject expired notify JWTs ([notify docs](https://developers.tlpe.io/post-notify-payment-result/)). */
export function isTlpeJwtNotExpired(payload: Record<string, unknown>, skewSeconds = 30): boolean {
	const exp = payload.exp
	if (typeof exp !== "number" || !Number.isFinite(exp)) return false
	const now = Math.floor(Date.now() / 1000)
	return exp >= now - skewSeconds
}
