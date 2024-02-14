"use client"

import {useRef} from "react"

import {Map} from "./Map"
import {WebgpuProvider} from "@/WebgpuContext"

export default function Root() {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	return (
		<WebgpuProvider canvasRef={canvasRef}>
			<Map />
		</WebgpuProvider>
	)
}
