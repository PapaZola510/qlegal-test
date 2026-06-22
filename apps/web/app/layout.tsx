import type { Metadata } from "next"
import { Figtree, Geist, Geist_Mono, Montserrat, Poppins } from "next/font/google"

import { BreakpointIndicator } from "@/core/components/breakpoint-indicator"
import { Toaster } from "@/core/components/ui/sonner"
import { ThemeProvider } from "@/core/context/theme-provider"
import { AuthProvider } from "@/services/better-auth/context/auth-provider"
import { QueryProvider } from "@/services/tanstack-query/provider"
import { NavigationLayoutProvider } from "@/features/navigation/context/navigation-layout-provider"

import "@/core/styles/globals.css"
import "@livekit/components-styles"
import "@/services/orpc/orpc-server"

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" })

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
})

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
})

const poppins = Poppins({
	variable: "--font-poppins",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
})

const montserrat = Montserrat({
	variable: "--font-montserrat",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
})

export const metadata: Metadata = {
	title: {
		default: "Quanby Legal",
		template: "%s | Quanby Legal",
	},
	description: "Legal services platform — notarization, e-signatures, and document management.",
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html lang="en" className={figtree.variable} suppressHydrationWarning>
			<body
				className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} ${montserrat.variable} antialiased`}
			>
				<AuthProvider>
					<QueryProvider>
						<NavigationLayoutProvider>
							<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
								<BreakpointIndicator />
								{children}
								<Toaster richColors closeButton />
							</ThemeProvider>
						</NavigationLayoutProvider>
					</QueryProvider>
				</AuthProvider>
			</body>
		</html>
	)
}
