"use client"

import { useEffect, useMemo, useState } from "react"

interface WebrtcLeakDetectionState {
	isLeaking: boolean
	leakedIps: string[]
	expectedIp: string | null
	isLoading: boolean
}

interface ScanResult {
	ips: string[]
	complete: boolean
	forIp: string
}

/**
 * Exclude RFC1918, loopback, link-local, multicast, reserved, documentation,
 * and unspecified ranges. Only globally routable IPv4 addresses are useful for
 * the WebRTC-vs-HTTP comparison.
 */
export function isPublicRoutableIpv4(ip: string): boolean {
	const octets = ip.split(".")
	if (octets.length !== 4) return false

	const nums = octets.map((octet): number | null => {
		if (!/^(0|[1-9]\d{0,2})$/.test(octet)) return null

		const parsed = Number(octet)
		return parsed <= 255 ? parsed : null
	})

	if (nums.some(octet => octet === null)) {
		return false
	}

	const [a, b, c] = nums as [number, number, number, number]

	return !(
		a === 0 ||
		a === 10 ||
		a === 127 ||
		a >= 224 ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 0 && c === 0) ||
		(a === 192 && b === 0 && c === 2) ||
		(a === 192 && b === 168) ||
		(a === 198 && (b === 18 || b === 19)) ||
		(a === 198 && b === 51 && c === 100) ||
		(a === 203 && b === 0 && c === 113)
	)
}

export function parseCandidateIpv4(candidate: string): string | null {
	const parts = candidate.trim().split(/\s+/)
	const typIndex = parts.indexOf("typ")
	if (!candidate.startsWith("candidate:") || typIndex < 0 || parts.length <= 4) return null

	const address = normalizeIpv4(parts[4] ?? "")
	return address && isPublicRoutableIpv4(address) ? address : null
}

/** Server-reported IP must be a public IPv4 before WebRTC comparison is meaningful. */
export function isTrustedServerIpForWebrtc(ip: string | null): boolean {
	if (!ip) return false
	return isPublicRoutableIpv4(normalizeIpv4(ip))
}

export function normalizeIpv4(ip: string): string {
	const trimmed = ip.trim()
	return trimmed.startsWith("::ffff:") ? trimmed.slice(7) : trimmed
}

/** One-shot WebRTC STUN scan — returns the first discovered public IPv4. */
export function scanWebRtcPublicIpv4(timeoutMs = 3000): Promise<string | null> {
	if (typeof window === "undefined" || typeof RTCPeerConnection === "undefined") {
		return Promise.resolve(null)
	}

	return new Promise(resolve => {
		const discoveredIps = new Set<string>()
		const pc = new RTCPeerConnection({
			iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
		})

		const finish = () => {
			pc.close()
			const publicIps = Array.from(discoveredIps).map(normalizeIpv4).filter(isPublicRoutableIpv4)
			resolve(publicIps[0] ?? null)
		}

		pc.onicecandidate = event => {
			const candidate = event.candidate?.candidate
			if (!candidate) return
			const ip = parseCandidateIpv4(candidate)
			if (ip) discoveredIps.add(ip)
		}

		const timeoutId = window.setTimeout(finish, timeoutMs)

		void (async () => {
			try {
				pc.createDataChannel("leak-check")
				const offer = await pc.createOffer()
				await pc.setLocalDescription(offer)
			} catch {
				window.clearTimeout(timeoutId)
				finish()
			}
		})()
	})
}

/**
 * Opens a short-lived `RTCPeerConnection` against Google's STUN server and
 * scans ICE candidate strings for IPv4 addresses. Any public IPv4 that doesn't
 * match the server-reported `expectedIp` is treated as a leak (typical with
 * VPNs that bypass WebRTC on default browser settings).
 *
 * IPv6 is intentionally not checked — quanby-legal also ships v4-only and
 * adding v6 produces noisy false positives on dual-stack networks.
 */
export function useWebrtcLeakDetection(expectedIp: string | null): WebrtcLeakDetectionState {
	const [scanResult, setScanResult] = useState<ScanResult | null>(null)

	useEffect(() => {
		if (!expectedIp) return

		if (typeof window === "undefined" || typeof RTCPeerConnection === "undefined") {
			queueMicrotask(() => {
				setScanResult({ ips: [], complete: true, forIp: expectedIp })
			})
			return
		}

		const discoveredIps = new Set<string>()
		const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] })

		const stop = () => {
			setScanResult({ ips: Array.from(discoveredIps), complete: true, forIp: expectedIp })
			pc.close()
		}

		pc.onicecandidate = event => {
			const candidate = event.candidate?.candidate
			if (!candidate) return

			const ip = parseCandidateIpv4(candidate)
			if (ip) discoveredIps.add(ip)
		}

		const timeoutId = window.setTimeout(stop, 3000)

		void (async () => {
			try {
				pc.createDataChannel("leak-check")
				const offer = await pc.createOffer()
				await pc.setLocalDescription(offer)
			} catch {
				window.clearTimeout(timeoutId)
				stop()
			}
		})()

		return () => {
			window.clearTimeout(timeoutId)
			pc.close()
		}
	}, [expectedIp])

	// Treat the scan as still loading until we receive a result for this specific
	// expectedIp — that way a stale result from a previous IP doesn't unblock the
	// lobby. Derived state avoids setState-in-effect rule violations.
	const isLoading = expectedIp !== null && (scanResult === null || scanResult.forIp !== expectedIp)

	const leakedIps = useMemo(() => {
		if (!scanResult || scanResult.forIp !== expectedIp) return []
		return scanResult.ips
	}, [expectedIp, scanResult])

	const isLeaking = useMemo(() => {
		if (!expectedIp) return false

		const normalizedExpected = normalizeIpv4(expectedIp)
		if (!isPublicRoutableIpv4(normalizedExpected)) return false

		const publicIps = leakedIps.map(normalizeIpv4).filter(isPublicRoutableIpv4)
		if (publicIps.length === 0) return false

		return !publicIps.includes(normalizedExpected)
	}, [expectedIp, leakedIps])

	return { isLeaking, leakedIps, expectedIp, isLoading }
}
