"use client"

import {QueryClient, QueryClientProvider} from "@tanstack/react-query"

import type {ReactNode} from "react"

const queryClient = new QueryClient()

export type ProvidersProps = Readonly<{
	children: ReactNode
}>

export function Providers({children}: ProvidersProps) {
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
