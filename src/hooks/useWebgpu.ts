import {useEffect, useState, type RefObject} from "react"
import invariant from "tiny-invariant"

import {useAsyncError} from "@/hooks/useAsyncError"
import {clamp} from "@/util"

export type Webgpu = {
	gpu: GPU
	gpuAdapter: GPUAdapter
	device: GPUDevice
	presentationFormat: GPUTextureFormat
}

let hasRun = false
export const useWebgpu = () => {
	const throwError = useAsyncError()

	const [webgpu, setWebgpu] = useState<Webgpu | null>(null)
	useEffect(() => {
		if (hasRun) return
		hasRun = true
		;(async () => {
			const gpu = navigator.gpu
			const gpuAdapter = await gpu.requestAdapter()
			if (!gpuAdapter) throw new Error(`No suitable GPUs found.`)

			const device = await gpuAdapter.requestDevice({label: `GPU device`})
			device.lost
				.then((info) => {
					if (info.reason !== `destroyed`) throw new Error(`GPU lost. Info: ${info.message}`)
				})
				.catch((error) => {
					throw error
				})

			const presentationFormat = navigator.gpu.getPreferredCanvasFormat()

			setWebgpu({gpu, gpuAdapter, device, presentationFormat})
		})().catch((err) => {
			hasRun = false
			throwError(err)
		})
	}, [throwError])

	return webgpu
}

export const useWebgpuCanvas = (canvasElement: RefObject<HTMLCanvasElement>, webgpu: Webgpu) => {
	const [canvasContext, setCanvasContext] = useState<GPUCanvasContext | null>(null)
	useEffect(() => {
		invariant(canvasElement.current)
		const canvasContext = canvasElement.current.getContext(`webgpu`)
		if (!canvasContext) throw new Error(`WebGPU not supported.`)
		setCanvasContext(canvasContext)

		canvasContext.configure({
			device: webgpu.device,
			format: webgpu.presentationFormat,
		})
	}, [canvasElement, webgpu])

	useEffect(() => {
		const onResize = () => {
			invariant(canvasElement.current)

			const mapWidth = clamp(window.innerWidth, 1, webgpu.device.limits.maxTextureDimension2D)
			const mapHeight = clamp(window.innerHeight, 1, webgpu.device.limits.maxTextureDimension2D)
			canvasElement.current.width = mapWidth
			canvasElement.current.height = mapHeight
		}
		window.addEventListener(`resize`, onResize)
		return () => window.removeEventListener(`resize`, onResize)
	}, [canvasElement, webgpu])

	return canvasContext
}
