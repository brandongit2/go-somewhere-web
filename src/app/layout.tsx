import type {Metadata} from "next"
import type {ReactNode} from "react"

import "./globals.css"

export const metadata: Metadata = {
	title: `go somewhere... anywhere.`,
	description: `sometimes you just want to go somewhere!`,
}

type RootLayoutProps = Readonly<{
	children: ReactNode
}>

export default function RootLayout({children}: RootLayoutProps) {
	return (
		<html lang="en" className="h-full">
			<body className="min-h-full">{children}</body>
		</html>
	)
}
