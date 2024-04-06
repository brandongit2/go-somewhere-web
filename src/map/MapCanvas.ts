import {clamp} from "@/util"

export class MapCanvas {
	mapWidth: number
	mapHeight: number

	// You probably want to use `createMapContext()` instead of this constructor.
	constructor(
		width: number,
		height: number,
		public canvasContext: GPUCanvasContext,
		public depthTexture: GPUTexture,
		public device: GPUDevice,
		public gpuAdapter: GPUAdapter,
		public presentationFormat: GPUTextureFormat,
	) {
		;({mapWidth: this.mapWidth, mapHeight: this.mapHeight} = this.setMapSize(width, height))
	}

	// This does not create a new depth texture! Remember to update it yourself with `getDepthTexture()`.
	setMapSize = (width: number, height: number) => {
		const mapWidth = clamp(width, 1, this.device.limits.maxTextureDimension2D)
		const mapHeight = clamp(height, 1, this.device.limits.maxTextureDimension2D)
		this.canvasContext.canvas.width = mapWidth
		this.canvasContext.canvas.height = mapHeight
		return {mapWidth, mapHeight}
	}
}

export const createMapCanvas = async (element: HTMLCanvasElement, width: number, height: number) => {
	const gpu = navigator.gpu
	const gpuAdapter = await gpu.requestAdapter()
	if (!gpuAdapter) throw new Error(`No suitable GPUs found.`)

	const device = await gpuAdapter.requestDevice()
	device.lost
		.then((info) => {
			if (info.reason !== `destroyed`) throw new Error(`GPU lost. Info: ${info.message}`)
		})
		.catch((error) => {
			throw error
		})

	const canvasContext = element.getContext(`webgpu`)
	if (!canvasContext) throw new Error(`WebGPU not supported.`)

	const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
	canvasContext.configure({
		device,
		format: presentationFormat,
	})

	const depthTexture = getDepthTexture(device, width, height)

	return new MapCanvas(
		window.innerWidth * devicePixelRatio,
		window.innerHeight * devicePixelRatio,
		canvasContext,
		depthTexture,
		device,
		gpuAdapter,
		presentationFormat,
	)
}

export const getDepthTexture = (device: GPUDevice, width: number, height: number) =>
	device.createTexture({
		label: `depth texture`,
		size: [width, height],
		format: `depth24plus`,
		usage: GPUTextureUsage.RENDER_ATTACHMENT,
	})
