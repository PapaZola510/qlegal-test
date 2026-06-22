import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { EmailMfaClient } from "./email-mfa-client"

const mocks = vi.hoisted(() => ({
	navigateAfterAuth: vi.fn(),
	requestOtp: vi.fn(),
	routerRefresh: vi.fn(),
	routerReplace: vi.fn(),
	signOut: vi.fn(),
	status: vi.fn(),
	verifyOtp: vi.fn(),
}))

vi.mock("next/link", async () => {
	const React = await import("react")
	return {
		default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) =>
			React.createElement("a", { href, ...props }, children),
	}
})

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		refresh: mocks.routerRefresh,
		replace: mocks.routerReplace,
	}),
}))

vi.mock("motion/react", async () => {
	const React = await import("react")
	const createMotion = (tag: "div" | "p") => {
		const Component = React.forwardRef<
			HTMLElement,
			Record<string, unknown> & { children?: React.ReactNode }
		>(
			(
				{
					animate: _animate,
					children,
					exit: _exit,
					initial: _initial,
					transition: _transition,
					variants: _variants,
					whileHover: _whileHover,
					whileTap: _whileTap,
					...props
				},
				ref
			) => React.createElement(tag, { ...props, ref }, children as React.ReactNode)
		)
		Component.displayName = `Motion.${tag}`
		return Component
	}

	return {
		AnimatePresence: ({ children }: { children: React.ReactNode }) =>
			React.createElement(React.Fragment, null, children),
		motion: {
			div: createMotion("div"),
			p: createMotion("p"),
		},
	}
})

vi.mock("@/services/better-auth/auth-client", () => ({
	authClient: {
		signOut: mocks.signOut,
	},
}))

vi.mock("@/services/orpc/client", () => ({
	orpc: {
		emailMfa: {
			status: {
				queryOptions: () => ({
					queryFn: mocks.status,
					queryKey: ["emailMfa", "status"],
				}),
			},
		},
	},
	orpcClient: {
		emailMfa: {
			requestOtp: mocks.requestOtp,
			verifyOtp: mocks.verifyOtp,
		},
	},
}))

vi.mock("@/services/ws/ws-client", () => ({
	destroyQlegalSocket: vi.fn(),
}))

vi.mock("@/features/auth/lib/clear-better-auth-cookies", () => ({
	clearBetterAuthBrowserCookies: vi.fn(),
}))

vi.mock("@/features/auth/lib/navigate-after-auth", () => ({
	navigateAfterAuth: mocks.navigateAfterAuth,
}))

vi.mock("@/features/auth/components/auth-brand-shell", async () => {
	const React = await import("react")
	return {
		AuthBrandShell: ({ children }: { children: React.ReactNode }) =>
			React.createElement("div", null, children),
	}
})

vi.mock("@/features/auth/components/auth-step-heading", async () => {
	const React = await import("react")
	return {
		AuthStepHeading: ({ subtitle, title }: { subtitle: string; title: React.ReactNode }) =>
			React.createElement(
				"header",
				null,
				React.createElement("h1", null, title),
				React.createElement("p", null, subtitle)
			),
	}
})

function renderMfaClient() {
	const queryClient = new QueryClient({
		defaultOptions: {
			mutations: { retry: false },
			queries: { retry: false },
		},
	})

	return render(
		<QueryClientProvider client={queryClient}>
			<EmailMfaClient />
		</QueryClientProvider>
	)
}

function expiredWindow() {
	const iso = new Date(Date.now() - 1_000).toISOString()
	return {
		expiresAt: iso,
		mfaVerified: false,
		resendAvailableAt: iso,
	}
}

describe("EmailMfaClient", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.stubGlobal(
			"ResizeObserver",
			class ResizeObserver {
				disconnect() {}
				observe() {}
				unobserve() {}
			}
		)
		Object.defineProperty(document, "elementFromPoint", {
			configurable: true,
			value: vi.fn(() => null),
		})
		mocks.status.mockResolvedValue({
			expiresAt: null,
			mfaVerified: false,
			resendAvailableAt: null,
		})
		mocks.requestOtp.mockResolvedValue({
			expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
			resendAvailableAt: new Date(Date.now() + 5 * 60_000).toISOString(),
		})
		mocks.verifyOtp.mockResolvedValue({ ok: true })
	})

	it("does not automatically request a new OTP when status has no active code", async () => {
		renderMfaClient()

		await screen.findByText(/no active code is available/i)

		expect(mocks.requestOtp).not.toHaveBeenCalled()
	})

	it("requests an OTP only after the user clicks resend", async () => {
		const user = userEvent.setup()
		renderMfaClient()

		await screen.findByText(/no active code is available/i)
		await user.click(screen.getByRole("button", { name: /resend code/i }))

		await waitFor(() => expect(mocks.requestOtp).toHaveBeenCalledTimes(1))
	})

	it("shows an expired known OTP window without automatically resending", async () => {
		mocks.status.mockResolvedValue(expiredWindow())

		renderMfaClient()

		await screen.findByText(/your code has expired/i)

		expect(screen.getByText("00:00")).toBeInTheDocument()
		expect(mocks.requestOtp).not.toHaveBeenCalled()
	})
})
