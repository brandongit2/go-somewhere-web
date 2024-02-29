import {MapContext} from "@/map/MapContext"
import {Mat4} from "@/math/Mat4"
import {Vec3} from "@/math/Vec3"
import {latLngToEcef, tileIdStrToArr} from "@/util"

const CONSTRUCTOR_KEY = Symbol(`MapRoot constructor key`)

export class MapRoot {
	private mapContext: MapContext = null! // Only way to construct a MapRoot is with MapRoot.create(). MapRoot.create() is assumed to set mapContext.

	constructor(key: typeof CONSTRUCTOR_KEY) {
		if (key !== CONSTRUCTOR_KEY) throw new Error(`MapRoot is not constructable. Use MapRoot.create() instead.`)
	}

	static create = async (canvasElement: HTMLCanvasElement): Promise<[MapRoot, MapContext]> => {
		const map = new MapRoot(CONSTRUCTOR_KEY)

		const gpu = navigator.gpu
		const adapter = await gpu.requestAdapter()
		if (!adapter) throw new Error(`No suitable GPUs found.`)

		const device = await adapter.requestDevice()
		device.lost
			.then((info) => {
				if (info.reason !== `destroyed`) throw new Error(`GPU lost. Info: ${info.message}`)
			})
			.catch((error) => {
				throw error
			})

		const canvasContext = canvasElement.getContext(`webgpu`)
		if (!canvasContext) throw new Error(`WebGPU not supported.`)

		map.mapContext = new MapContext({
			canvasContext,
			canvasElement,
			device,
		})

		return [map, map.mapContext]
	}

	destroy = () => {
		this.mapContext.device.destroy()
	}

	render = () => {
		const {device, canvasContext, tileManager, depthTexture} = this.mapContext

		const encoder = device.createCommandEncoder({label: `encoder`})
		const pass = encoder.beginRenderPass({
			label: `render pass`,
			colorAttachments: [
				{
					view: canvasContext.getCurrentTexture().createView(),
					clearValue: [0, 0, 0, 1],
					loadOp: `clear`,
					storeOp: `store`,
				},
			],
			depthStencilAttachment: {
				view: depthTexture.createView({label: `depth texture view`}),
				depthClearValue: 0,
				depthLoadOp: `clear`,
				depthStoreOp: `store`,
			},
		})

		tileManager.tilesInView.forEach((tileId) => {
			let [zoom, x, y] = tileIdStrToArr(tileId)

			// Try to find the tile in cache
			let tile = tileManager.fetchTileFromCache(`${zoom}/${x}/${y}`)
			// If it's not there (it should already be fetching), try to find a parent tile to render
			while (!tile) {
				;[x, y, zoom] = [x >> 1, y >> 1, zoom - 1]
				tile = tileManager.fetchTileFromCache(`${zoom}/${x}/${y}`)
				if (zoom <= 0) return
			}

			tile.draw(pass)
		})

		pass.end()
		const commandBuffer = encoder.finish()
		device.queue.submit([commandBuffer])
	}

	updateCamera = () => {
		const {tileManager, device, viewMatrixBuffer, lat, lng, width, height} = this.mapContext

		tileManager.setTilesInView([
			`2/0/0`,
			`2/0/1`,
			`2/0/2`,
			`2/0/3`,
			`2/1/0`,
			`2/1/1`,
			`2/1/2`,
			`2/1/3`,
			`2/2/0`,
			`2/2/1`,
			`2/2/2`,
			`2/2/3`,
			`2/3/0`,
			`2/3/1`,
			`2/3/2`,
			`2/3/3`,
		])

		this.mapContext.canvasElement.width = width * devicePixelRatio
		this.mapContext.canvasElement.height = height * devicePixelRatio
		this.mapContext.createDepthTexture()

		let viewMatrix = Mat4.makePerspective(75, width / height, 0.1)
		const ecefPos = latLngToEcef(lat, lng, 1)
		const cameraPos = new Vec3(ecefPos[1], ecefPos[2], ecefPos[0])
		const rotationMatrix = Mat4.lookAt(cameraPos, new Vec3(0, 0, 0), new Vec3(0, 1, 0))
		const translationMatrix = Mat4.makeTranslation(cameraPos.times(-1).toTuple())
		viewMatrix = Mat4.mul(viewMatrix, rotationMatrix, translationMatrix)
		device.queue.writeBuffer(viewMatrixBuffer, 0, new Float32Array(viewMatrix))
	}
}
