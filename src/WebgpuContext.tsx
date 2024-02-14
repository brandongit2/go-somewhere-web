import {createContext, useState, type ReactNode, useEffect, type RefObject, useContext} from "react"

import {useAsyncError} from "./hooks/use-async-error"

export const WebgpuContext = createContext({
	gpu: undefined as GPU | undefined,
	adapter: undefined as GPUAdapter | undefined,
	device: undefined as GPUDevice | undefined,
	context: undefined as GPUCanvasContext | undefined,
	presentationFormat: undefined as GPUTextureFormat | undefined,
	canvasRef: {current: undefined} as RefObject<HTMLCanvasElement | undefined>,
})

let didInit = false

export type WebgpuProviderProps = {
	canvasRef: RefObject<HTMLCanvasElement>
	children: ReactNode
}

export const WebgpuProvider = ({canvasRef, children}: WebgpuProviderProps) => {
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
			device.lost
				.then((info) => {
					throwError(new Error(`GPU lost. Info: ${info.message}`))
				})
				.catch(throwError)
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

	return (
		<WebgpuContext.Provider
			value={{
				gpu,
				adapter,
				device,
				context,
				presentationFormat,
				canvasRef,
			}}
		>
			{children}
		</WebgpuContext.Provider>
	)
}

export const useWebgpu = () => useContext(WebgpuContext)
