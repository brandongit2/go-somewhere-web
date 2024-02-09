import {type RefObject, useEffect, useState} from "react"

import {useAsyncError} from "./use-async-error"

let didInit = false

export const useWebgpu = (canvasRef: RefObject<HTMLCanvasElement>) => {
	const throwError = useAsyncError()

	const [gpu, setGpu] = useState<GPU>()
	const [adapter, setAdapter] = useState<GPUAdapter>()
	const [device, setDevice] = useState<GPUDevice>()
	const [context, setContext] = useState<GPUCanvasContext>()
	const [presentationFormat, setPresentationFormat] = useState<GPUTextureFormat>()

	useEffect(() => {
		const init = async () => {
			if (didInit) return
			if (!canvasRef.current) return

			didInit = true

			const gpu = navigator.gpu
			setGpu(gpu)
			const adapter = await gpu.requestAdapter()
			if (!adapter) throw new Error(`No suitable GPUs found.`)
			setAdapter(adapter)

			const device = await adapter.requestDevice()
			setDevice(device)
			const context = canvasRef.current.getContext(`webgpu`)
			if (!context) throw new Error(`WebGPU not supported.`)
			setContext(context)

			const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
			setPresentationFormat(presentationFormat)

			context.configure({
				device,
				format: presentationFormat,
			})
		}

		init().catch(throwError)
	}, [canvasRef, throwError])

	return {gpu, adapter, device, context, presentationFormat}
}
