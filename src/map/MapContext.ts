import {FOUR_BYTES_PER_FLOAT, PX_PER_TILE, SIXTEEN_NUMBERS_PER_MAT4} from "@/const"
import {TileManager} from "@/map/TileManager"

export class MapContext {
	height: number
	width: number
	lng = 0
	lat = 0
	zoom = 0
	get degreesPerPx() {
		return 360 / PX_PER_TILE / 2 ** this.zoom
	}

	canvasContext: GPUCanvasContext
	canvasElement: HTMLCanvasElement
	device: GPUDevice
	presentationFormat: GPUTextureFormat
	depthTexture: GPUTexture

	tileManager: TileManager

	viewMatrixBuffer: GPUBuffer

	constructor({
		canvasContext,
		canvasElement,
		device,
	}: {
		canvasContext: GPUCanvasContext
		canvasElement: HTMLCanvasElement
		device: GPUDevice
	}) {
		this.height = canvasElement.getBoundingClientRect().height
		this.width = canvasElement.getBoundingClientRect().width
		this.canvasContext = canvasContext
		this.canvasElement = canvasElement
		this.device = device
		this.presentationFormat = navigator.gpu.getPreferredCanvasFormat()
		canvasContext.configure({
			device,
			format: this.presentationFormat,
		})

		this.tileManager = new TileManager(this)

		this.viewMatrixBuffer = device.createBuffer({
			label: `view matrix uniform buffer`,
			size: SIXTEEN_NUMBERS_PER_MAT4 * FOUR_BYTES_PER_FLOAT,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		})

		this.depthTexture = null! // This is just to appease TypeScript; it will be initialized in createDepthTexture()
		this.createDepthTexture()
	}

	createDepthTexture = () => {
		this.depthTexture = this.device.createTexture({
			label: `depth texture`,
			size: [this.width * devicePixelRatio, this.height * devicePixelRatio],
			format: `depth24plus`,
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
		})
	}
}
