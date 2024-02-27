import {TileManager} from "./TileManager"
import {type TileId} from "../types"
import {Mat4} from "@/math/Mat4"
import {clamp, latTotile, lngTotile} from "@/util"

const pxPerTile = 512

export class MapContext {
	height: number = null!
	width: number = null!
	lng = 0
	lat = 0
	zoom = 0
	get degreesPerPx() {
		return 360 / pxPerTile / 2 ** this.zoom
	}

	canvasContext: GPUCanvasContext = null!
	canvasElement: HTMLCanvasElement = null!
	device: GPUDevice = null!
	presentationFormat: GPUTextureFormat = null!
	tileManager: TileManager = null!

	viewMatrixUniformBuffer: GPUBuffer = null!

	static create = async (canvasElement: HTMLCanvasElement): Promise<MapContext> => {
		const context = new MapContext()

		context.canvasElement = canvasElement
		context.height = canvasElement.getBoundingClientRect().height
		context.width = canvasElement.getBoundingClientRect().width

		const gpu = navigator.gpu
		const adapter = await gpu.requestAdapter()
		if (!adapter) throw new Error(`No suitable GPUs found.`)

		context.device = await adapter.requestDevice()
		context.device.lost
			.then((info) => {
				throw new Error(`GPU lost. Info: ${info.message}`)
			})
			.catch((error) => {
				throw error
			})

		const canvasContext = canvasElement.getContext(`webgpu`)
		if (!canvasContext) throw new Error(`WebGPU not supported.`)
		context.canvasContext = canvasContext

		context.presentationFormat = navigator.gpu.getPreferredCanvasFormat()
		context.canvasContext.configure({
			device: context.device,
			format: context.presentationFormat,
		})

		context.viewMatrixUniformBuffer = context.device.createBuffer({
			label: `view matrix uniform buffer`,
			size: 4 * 4 * 4, // mat4x4f
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		})

		context.tileManager = new TileManager(context)

		return context
	}

	render = () => {
		const encoder = this.device.createCommandEncoder({label: `encoder`})
		const pass = encoder.beginRenderPass({
			label: `render pass`,
			colorAttachments: [
				{
					view: this.canvasContext.getCurrentTexture().createView(),
					clearValue: [0, 0, 0, 1],
					loadOp: `clear` as const,
					storeOp: `store` as const,
				},
			],
		})

		this.tileManager.tilesInView.forEach((tileId) => {
			let [zoom, x, y] = TileManager.tileIdToCoords(tileId)

			// Try to find the tile in cache
			let tile = this.tileManager.fetchTileFromCache(`${zoom}/${x}/${y}`)
			// If it's not there (it should already be fetching), try to find a parent tile to render
			while (!tile) {
				;[x, y, zoom] = [x >> 1, y >> 1, zoom - 1]
				tile = this.tileManager.fetchTileFromCache(`${zoom}/${x}/${y}`)
				if (zoom <= 0) return
			}

			tile.draw(pass)
		})

		pass.end()
		const commandBuffer = encoder.finish()
		this.device.queue.submit([commandBuffer])
	}

	updateCamera = () => {
		const zoomRounded = Math.round(this.zoom)
		const degreesPerPx = 360 / pxPerTile / 2 ** this.zoom
		const leftTile = Math.floor(lngTotile(clamp(this.lng - (this.width / 2) * degreesPerPx, -180, 180), zoomRounded))
		const rightTile = Math.ceil(lngTotile(clamp(this.lng + (this.width / 2) * degreesPerPx, -180, 180), zoomRounded))
		const topTile = Math.floor(latTotile(clamp(this.lat + (this.height / 2) * degreesPerPx, -85, 85), zoomRounded))
		const bottomTile = Math.ceil(latTotile(clamp(this.lat - (this.height / 2) * degreesPerPx, -85, 85), zoomRounded))
		const tilesInView: TileId[] = []
		for (let x = clamp(leftTile, 0, 2 ** zoomRounded); x < clamp(rightTile, 0, 2 ** zoomRounded); x++) {
			for (let y = clamp(topTile, 0, 2 ** zoomRounded); y < clamp(bottomTile, 0, 2 ** zoomRounded); y++) {
				tilesInView.push(`${zoomRounded}/${x}/${y}`)
			}
		}
		this.tileManager.setTilesInView(tilesInView)

		this.device.queue.writeBuffer(
			this.viewMatrixUniformBuffer,
			0,
			new Float32Array(
				Mat4.fromOrthographic(
					this.lng - degreesPerPx * (this.width / 2),
					this.lng + degreesPerPx * (this.width / 2),
					this.lat + degreesPerPx * (this.height / 2),
					this.lat - degreesPerPx * (this.height / 2),
					-1,
					1,
				),
			),
		)
	}
}
