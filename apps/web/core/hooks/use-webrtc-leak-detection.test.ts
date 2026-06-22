import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
	isPublicRoutableIpv4,
	isTrustedServerIpForWebrtc,
	normalizeIpv4,
	parseCandidateIpv4,
	useWebrtcLeakDetection,
} from "@/core/hooks/use-webrtc-leak-detection"

const PUBLIC_CANDIDATE =
	"candidate:842163049 1 udp 1677729535 203.0.114.20 60769 typ srflx raddr 0.0.0.0 rport 0"

type MockPeerConnection = {
	emitCandidate: (candidate: string | null) => void
	close: ReturnType<typeof vi.fn>
}

function installMockRTCPeerConnection(
	options: {
		createOfferRejects?: boolean
		onInstance?: (pc: MockPeerConnection) => void
	} = {}
) {
	const instances: MockPeerConnection[] = []

	class MockRTCPeerConnection {
		onicecandidate: ((event: { candidate: { candidate: string } | null }) => void) | null = null
		close = vi.fn()
		createDataChannel = vi.fn()
		createOffer = options.createOfferRejects
			? vi.fn().mockRejectedValue(new Error("createOffer failed"))
			: vi.fn().mockResolvedValue({ type: "offer" })
		setLocalDescription = vi.fn().mockResolvedValue(undefined)

		emitCandidate(candidate: string | null) {
			this.onicecandidate?.({
				candidate: candidate ? { candidate } : null,
			})
		}

		constructor(_config?: RTCConfiguration) {
			const pc: MockPeerConnection = {
				emitCandidate: candidate => this.emitCandidate(candidate),
				close: this.close,
			}
			instances.push(pc)
			options.onInstance?.(pc)
		}
	}

	vi.stubGlobal("RTCPeerConnection", MockRTCPeerConnection as unknown as typeof RTCPeerConnection)

	return {
		getLatest: () => instances.at(-1),
	}
}

async function flushMicrotasks() {
	await act(async () => {
		await Promise.resolve()
	})
}

async function finishWebrtcScan(getLatest: () => MockPeerConnection | undefined) {
	await flushMicrotasks()
	expect(getLatest()).toBeDefined()

	await act(async () => {
		getLatest()?.emitCandidate(PUBLIC_CANDIDATE)
		vi.advanceTimersByTime(3000)
	})
}

describe("useWebrtcLeakDetection", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	it("returns idle state when expectedIp is null", () => {
		const { result } = renderHook(() => useWebrtcLeakDetection(null))

		expect(result.current).toEqual({
			isLeaking: false,
			leakedIps: [],
			expectedIp: null,
			isLoading: false,
		})
	})

	it("completes with no leak when WebRTC is unavailable", async () => {
		vi.stubGlobal("RTCPeerConnection", undefined)

		const { result } = renderHook(() => useWebrtcLeakDetection("203.0.114.20"))

		await flushMicrotasks()

		expect(result.current).toEqual({
			isLeaking: false,
			leakedIps: [],
			expectedIp: "203.0.114.20",
			isLoading: false,
		})
	})

	it("reports no leak when discovered public IP matches expectedIp", async () => {
		const { getLatest } = installMockRTCPeerConnection()

		const { result } = renderHook(() => useWebrtcLeakDetection("203.0.114.20"))

		expect(result.current.isLoading).toBe(true)

		await finishWebrtcScan(getLatest)

		expect(result.current.isLoading).toBe(false)
		expect(result.current.isLeaking).toBe(false)
		expect(result.current.leakedIps).toContain("203.0.114.20")
	})

	it("reports a leak when a public ICE IP differs from expectedIp", async () => {
		const { getLatest } = installMockRTCPeerConnection()

		const { result } = renderHook(() => useWebrtcLeakDetection("8.8.8.8"))

		await finishWebrtcScan(getLatest)

		expect(result.current.isLoading).toBe(false)
		expect(result.current.isLeaking).toBe(true)
		expect(result.current.leakedIps).toEqual(["203.0.114.20"])
	})

	it("reports no leak when expectedIp uses IPv4-mapped IPv6 prefix", async () => {
		const { getLatest } = installMockRTCPeerConnection()

		const { result } = renderHook(() => useWebrtcLeakDetection("::ffff:203.0.114.20"))

		await finishWebrtcScan(getLatest)

		expect(result.current.isLeaking).toBe(false)
	})

	it("does not leak when server IP is loopback (untrusted for comparison)", async () => {
		const { getLatest } = installMockRTCPeerConnection()

		const { result } = renderHook(() => useWebrtcLeakDetection("127.0.0.1"))

		await finishWebrtcScan(getLatest)

		expect(result.current.isLeaking).toBe(false)
	})

	it("stays loading until scan results match the current expectedIp", async () => {
		const { getLatest } = installMockRTCPeerConnection()

		const { result, rerender } = renderHook(
			({ expectedIp }: { expectedIp: string | null }) => useWebrtcLeakDetection(expectedIp),
			{ initialProps: { expectedIp: "8.8.8.8" as string | null } }
		)

		await finishWebrtcScan(getLatest)

		expect(result.current.isLoading).toBe(false)
		expect(result.current.isLeaking).toBe(true)

		rerender({ expectedIp: "1.1.1.1" })

		expect(result.current.isLoading).toBe(true)
		expect(result.current.isLeaking).toBe(false)
		expect(result.current.leakedIps).toEqual([])
	})

	it("finishes with no leak when createOffer fails", async () => {
		installMockRTCPeerConnection({ createOfferRejects: true })

		const { result } = renderHook(() => useWebrtcLeakDetection("8.8.8.8"))

		await flushMicrotasks()

		expect(result.current.isLoading).toBe(false)
		expect(result.current.isLeaking).toBe(false)
		expect(result.current.leakedIps).toEqual([])
	})

	it("closes the peer connection on unmount", async () => {
		const { getLatest } = installMockRTCPeerConnection()

		const { unmount } = renderHook(() => useWebrtcLeakDetection("8.8.8.8"))

		await flushMicrotasks()

		const pc = getLatest()
		unmount()

		expect(pc?.close).toHaveBeenCalled()
	})
})

describe("WebRTC leak detection helpers", () => {
	it("extracts only the ICE candidate address", () => {
		const candidate =
			"candidate:842163049 1 udp 1677729535 203.0.114.20 60769 typ srflx raddr 0.0.0.0 rport 0"

		expect(parseCandidateIpv4(candidate)).toBe("203.0.114.20")
	})

	it("ignores private, unspecified, and reserved candidate addresses", () => {
		const candidates = [
			"candidate:1 1 udp 1 192.168.1.10 123 typ host",
			"candidate:1 1 udp 1 10.0.0.10 123 typ host",
			"candidate:1 1 udp 1 0.0.0.0 123 typ srflx",
			"candidate:1 1 udp 1 100.64.1.20 123 typ srflx",
			"candidate:1 1 udp 1 203.0.113.20 123 typ srflx",
		]

		for (const candidate of candidates) {
			expect(parseCandidateIpv4(candidate)).toBeNull()
		}
	})

	it("classifies globally routable IPv4 addresses", () => {
		expect(isPublicRoutableIpv4("8.8.8.8")).toBe(true)
		expect(isPublicRoutableIpv4("1.1.1.1")).toBe(true)
		expect(isPublicRoutableIpv4("999.1.1.1")).toBe(false)
		expect(isPublicRoutableIpv4("01.1.1.1")).toBe(false)
	})

	it("normalizes IPv4-mapped IPv6 addresses", () => {
		expect(normalizeIpv4("::ffff:203.0.114.20")).toBe("203.0.114.20")
	})

	it("marks only public IPv4 server addresses as WebRTC-trusted", () => {
		expect(isTrustedServerIpForWebrtc("203.0.114.20")).toBe(true)
		expect(isTrustedServerIpForWebrtc("127.0.0.1")).toBe(false)
		expect(isTrustedServerIpForWebrtc(null)).toBe(false)
	})
})
