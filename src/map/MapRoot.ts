import {PX_PER_TILE} from "@/const"
import {MapContext} from "@/map/MapContext"
import {FlatMaterial} from "@/materials/FlatMaterial"
import {Mat4} from "@/math/Mat4"
import {Vec3} from "@/math/Vec3"
import {Vec4} from "@/math/Vec4"
import {LineMesh} from "@/meshes/LineMesh"
import {type Mesh} from "@/meshes/Mesh"
import {type LngLat, type TileIdArr, type WorldCoord} from "@/types"
import {degToRad, lngLatToWorld, mercatorYToLat, tileIdStrToArr, tileToLngLat} from "@/util"

const CONSTRUCTOR_KEY = Symbol(`MapRoot constructor key`)

export class MapRoot {
	private mapContext: MapContext = null! // Only way to construct a MapRoot is with MapRoot.create(). MapRoot.create() is assumed to set mapContext.
	extraObjects: Mesh[] = []

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

		map.extraObjects[0] = new LineMesh(
			map.mapContext,
			{
				vertices: [],
				thickness: 0.01,
			},
			new FlatMaterial(map.mapContext, [0, 1, 0]),
		)
		map.extraObjects[1] = new LineMesh(
			map.mapContext,
			{
				vertices: [],
				thickness: 0.01,
			},
			new FlatMaterial(map.mapContext, [1, 0, 0]),
		)

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
		this.extraObjects.forEach((obj) => obj.draw(pass))

		pass.end()
		const commandBuffer = encoder.finish()
		device.queue.submit([commandBuffer])
	}

	updateCamera = () => {
		const {tileManager, device, viewMatrixBuffer, lat, lng, width, height, zoom} = this.mapContext

		tileManager.setTilesInView([`0/0/0`])

		const vertices: WorldCoord[][] = []
		const zoomRounded = Math.ceil(zoom)

		// Longitude lines
		for (let i = 0; i < 2 ** zoomRounded; i++) {
			let theta = i * (360 / 2 ** zoomRounded) - 90
			let ring = []
			for (let j = 0; j <= 90; j++) {
				ring.push([
					Math.sin(degToRad(j * 2)) * Math.cos(degToRad(theta)) * 1.001,
					Math.cos(degToRad(j * 2)) * 1.001,
					Math.sin(degToRad(j * 2)) * Math.sin(degToRad(theta)) * 1.001,
				] as WorldCoord)
			}
			vertices.push(ring)
		}

		// Latitude lines
		for (let i = 0; i <= 2 ** zoomRounded; i++) {
			let phi = mercatorYToLat(i / 2 ** zoomRounded)
			let ring = []
			for (let j = 0; j <= 90; j++) {
				ring.push([
					Math.cos(degToRad(phi)) * Math.cos(degToRad(j * 4)) * 1.001,
					Math.sin(degToRad(phi)) * 1.001,
					Math.cos(degToRad(phi)) * Math.sin(degToRad(j * 4)) * 1.001,
				] as WorldCoord)
			}
			vertices.push(ring)
		}

		;(this.extraObjects[0] as LineMesh).set({
			vertices,
			thickness: 0.01,
		})

		this.mapContext.canvasElement.width = width * devicePixelRatio
		this.mapContext.canvasElement.height = height * devicePixelRatio
		this.mapContext.createDepthTexture()

		const fovX = 75
		let viewMatrix = Mat4.makePerspective(fovX, width / height, 0.001)
		const distance = Math.PI / Math.tan(degToRad(fovX) / 2) / 2 ** zoom + 1
		const cameraPos = new Vec3(lngLatToWorld([lng, lat] as LngLat, distance))
		const rotationMatrix = Mat4.lookAt(cameraPos, new Vec3(0, 0, 0), new Vec3(0, 1, 0))
		viewMatrix = Mat4.mul(viewMatrix, rotationMatrix)

		const referenceTileSize = (PX_PER_TILE / (width * devicePixelRatio)) * 2 * Math.PI

		;(this.extraObjects[1] as LineMesh).set({
			vertices: [
				[
					[-referenceTileSize / 2, 0, 1],
					[referenceTileSize / 2, 0, 1],
				] as WorldCoord[],
				[
					[0, -referenceTileSize / 2, 1],
					[0, referenceTileSize / 2, 1],
				] as WorldCoord[],
			],
			thickness: 0.01,
		})

		let visibleTiles: TileIdArr[] = []

		processTile([1, 0, 0] as TileIdArr, viewMatrix, cameraPos, width, referenceTileSize)

		device.queue.writeBuffer(viewMatrixBuffer, 0, new Float32Array(viewMatrix))
	}
}

const processTile = (
	tile: TileIdArr,
	viewMatrix: Mat4,
	cameraPos: Vec3,
	screenWidth: number,
	referenceTileSize: number,
	recursionLimit = tile[0] + 7,
	knownToBeInView = false,
): TileIdArr[] => {
	if (tile[0] >= recursionLimit) return []

	const topLeft = tileToLngLat([tile[0], tile[1], tile[2]] as TileIdArr)
	const topRight = tileToLngLat([tile[0], tile[1] + 1, tile[2]] as TileIdArr)
	const bottomLeft = tileToLngLat([tile[0], tile[1], tile[2] + 1] as TileIdArr)
	const bottomRight = tileToLngLat([tile[0], tile[1] + 1, tile[2] + 1] as TileIdArr)

	const topLeftWorldPos = new Vec3(lngLatToWorld(topLeft))
	const topRightWorldPos = new Vec3(lngLatToWorld(topRight))
	const bottomLeftWorldPos = new Vec3(lngLatToWorld(bottomLeft))
	const bottomRightWorldPos = new Vec3(lngLatToWorld(bottomRight))

	const topLeftProjected = Vec4.perspectiveDivide(Vec4.applyMat4(new Vec4(...topLeftWorldPos.toTuple(), 1), viewMatrix))
	const topRightProjected = Vec4.perspectiveDivide(
		Vec4.applyMat4(new Vec4(...topRightWorldPos.toTuple(), 1), viewMatrix),
	)
	const bottomLeftProjected = Vec4.perspectiveDivide(
		Vec4.applyMat4(new Vec4(...bottomLeftWorldPos.toTuple(), 1), viewMatrix),
	)
	const bottomRightProjected = Vec4.perspectiveDivide(
		Vec4.applyMat4(new Vec4(...bottomRightWorldPos.toTuple(), 1), viewMatrix),
	)

	const earthRadius = 1
	const cameraDistance = cameraPos.length
	const toCamera = cameraPos.normalized()
	const cosThetaForHorizon = earthRadius / (earthRadius + cameraDistance)

	const calcTileSize = (pointLngLat: LngLat) => {
		const worldPos = new Vec3(lngLatToWorld(pointLngLat))
		const west = Vec3.cross(worldPos, new Vec3(0, 1, 0))
			.normalized()
			.times((referenceTileSize / 2) * Math.cos(degToRad(pointLngLat[1])))
		const north = Vec3.cross(west, worldPos)
			.normalized()
			.times(referenceTileSize / 2)

		const centerProjected = Vec4.perspectiveDivide(Vec4.applyMat4(new Vec4(...worldPos.toTuple(), 1), viewMatrix))
		const westProjected = Vec4.perspectiveDivide(
			Vec4.applyMat4(new Vec4(...Vec3.add(worldPos, west).toTuple(), 1), viewMatrix),
		)
		const northProjected = Vec4.perspectiveDivide(
			Vec4.applyMat4(new Vec4(...Vec3.add(worldPos, north).toTuple(), 1), viewMatrix),
		)

		let width = Math.abs((centerProjected.x - westProjected.x) * 2)
		let height = Math.abs((northProjected.y - centerProjected.y) * 2)

		return [(width * screenWidth) / PX_PER_TILE, (height * screenWidth) / PX_PER_TILE]
	}

	const isBeyondHorizon = (lngLat: LngLat) => {
		const toPoint = new Vec3(lngLatToWorld(lngLat, earthRadius)).normalized()
		const cosThetaForPoint = Vec3.dot(toCamera, toPoint)
		return cosThetaForPoint < cosThetaForHorizon
	}

	if (tile[0] === 1) console.log(calcTileSize(bottomRight), isBeyondHorizon(bottomRight))

	const isInViewFrustum = (projectedPos: Vec3) =>
		projectedPos.x >= -1 && projectedPos.x <= 1 && projectedPos.y >= -1 && projectedPos.y <= 1
	const areAllCornersInViewFrustum =
		isInViewFrustum(topLeftProjected) &&
		isInViewFrustum(topRightProjected) &&
		isInViewFrustum(bottomLeftProjected) &&
		isInViewFrustum(bottomRightProjected)

	// const childTopLeftProcessed = processTile(
	// 	[tile[0] + 1, tile[1] * 2, tile[2] * 2] as TileIdArr,
	// 	viewMatrix,
	// 	cameraPos,
	// 	recursionLimit,
	// )
	// const childTopRightProcessed = processTile(
	// 	[tile[0] + 1, tile[1] * 2 + 1, tile[2] * 2] as TileIdArr,
	// 	viewMatrix,
	// 	cameraPos,
	// 	recursionLimit,
	// )
	// const childBottomLeftProcessed = processTile(
	// 	[tile[0] + 1, tile[1] * 2, tile[2] * 2 + 1] as TileIdArr,
	// 	viewMatrix,
	// 	cameraPos,
	// 	recursionLimit,
	// )
	// const childBottomRightProcessed = processTile(
	// 	[tile[0] + 1, tile[1] * 2 + 1, tile[2] * 2 + 1] as TileIdArr,
	// 	viewMatrix,
	// 	cameraPos,
	// 	recursionLimit,
	// )

	// let inView =
	// 	(areAllCornersInViewFrustum && !areAnyCornersBeyondHorizon) ||
	// 	childTopLeftProcessed !== null ||
	// 	childTopRightProcessed !== null ||
	// 	childBottomLeftProcessed !== null ||
	// 	childBottomRightProcessed !== null

	// if (inView) {
	// 	visibleTiles.push({
	// 		tile,
	// 		tileSize: maxTileSize,
	// 	})
	// }

	// return maxTileSize
}
