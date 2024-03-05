import {PX_PER_TILE} from "@/const"
import {MapContext} from "@/map/MapContext"
import {FlatMaterial} from "@/materials/FlatMaterial"
import {Mat4} from "@/math/Mat4"
import {Vec3} from "@/math/Vec3"
import {Vec4} from "@/math/Vec4"
import {LineMesh} from "@/meshes/LineMesh"
import {type Mesh} from "@/meshes/Mesh"
import {type LngLat, type TileCoord, type TileIdArr, type WorldCoord} from "@/types"
import {degToRad, lngLatToWorld, tileIdStrToArr, tileToLngLat} from "@/util"

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

		const visibleTiles = processTile(
			[0, 0, 0] as TileIdArr,
			viewMatrix,
			[lng, lat] as LngLat,
			cameraPos,
			width,
			referenceTileSize,
		)
		console.log(visibleTiles)
		;(this.extraObjects[1] as LineMesh).set({
			vertices: visibleTiles.map(
				([zoom, x, y]) =>
					[
						lngLatToWorld(tileToLngLat([zoom, x, y] as TileIdArr)),
						lngLatToWorld(tileToLngLat([zoom, x + 1, y] as TileIdArr)),
						lngLatToWorld(tileToLngLat([zoom, x + 1, y + 1] as TileIdArr)),
						lngLatToWorld(tileToLngLat([zoom, x, y + 1] as TileIdArr)),
						lngLatToWorld(tileToLngLat([zoom, x, y] as TileIdArr)),
					] as WorldCoord[],
			),
			thickness: 0.01,
		})

		device.queue.writeBuffer(viewMatrixBuffer, 0, new Float32Array(viewMatrix))
	}
}

const processTile = (
	tile: TileIdArr,
	viewMatrix: Mat4,
	lngLat: LngLat,
	cameraPos: Vec3,
	screenWidth: number,
	referenceTileSize: number,
	recursionLimit = tile[0] + 12,
	knownToBeInView = false,
): TileIdArr[] => {
	if (tile[0] > recursionLimit) return []

	const topLeft = tileToLngLat([tile[0], tile[1], tile[2]] as TileIdArr)
	const topRight = tileToLngLat([tile[0], tile[1] + 1, tile[2]] as TileIdArr)
	const bottomLeft = tileToLngLat([tile[0], tile[1], tile[2] + 1] as TileIdArr)
	const bottomRight = tileToLngLat([tile[0], tile[1] + 1, tile[2] + 1] as TileIdArr)

	const earthRadius = 1
	const cameraDistance = cameraPos.length
	const toCamera = cameraPos.normalized()
	const cosThetaForHorizon = earthRadius / (earthRadius + cameraDistance)

	const calcTileSize = (pointWorldPos: Vec3, latitude: number) => {
		const zoomFactor = 2 ** -Math.ceil(tile[0])
		const west = Vec3.cross(pointWorldPos, new Vec3(0, 1, 0))
			.normalized()
			.times((referenceTileSize / 2) * zoomFactor * Math.cos(degToRad(latitude)))
		const north = Vec3.cross(west, pointWorldPos)
			.normalized()
			.times((referenceTileSize / 2) * zoomFactor)

		const centerProjected = Vec4.perspectiveDivide(Vec4.applyMat4(new Vec4(...pointWorldPos.toTuple(), 1), viewMatrix))
		const westProjected = Vec4.perspectiveDivide(
			Vec4.applyMat4(new Vec4(...Vec3.add(pointWorldPos, west).toTuple(), 1), viewMatrix),
		)
		const northProjected = Vec4.perspectiveDivide(
			Vec4.applyMat4(new Vec4(...Vec3.add(pointWorldPos, north).toTuple(), 1), viewMatrix),
		)

		let width = Math.abs((centerProjected.x - westProjected.x) * 2) * ((screenWidth * devicePixelRatio) / PX_PER_TILE)
		let height = Math.abs((northProjected.y - centerProjected.y) * 2) * ((screenWidth * devicePixelRatio) / PX_PER_TILE)
		return (width + height) / 2
	}

	const topLeftWorldPos = new Vec3(lngLatToWorld(topLeft))
	const topRightWorldPos = new Vec3(lngLatToWorld(topRight))
	const bottomLeftWorldPos = new Vec3(lngLatToWorld(bottomLeft))
	const bottomRightWorldPos = new Vec3(lngLatToWorld(bottomRight))
	const topLeftTileSize = calcTileSize(topLeftWorldPos, topLeft[1])
	const topRightTileSize = calcTileSize(topRightWorldPos, topRight[1])
	const bottomLeftTileSize = calcTileSize(bottomLeftWorldPos, bottomLeft[1])
	const bottomRightTileSize = calcTileSize(bottomRightWorldPos, bottomRight[1])
	const maxTileSize = Math.max(topLeftTileSize, topRightTileSize, bottomLeftTileSize, bottomRightTileSize)

	let isTileInView = false
	if (!knownToBeInView) {
		const topLeftProjected = Vec4.perspectiveDivide(
			Vec4.applyMat4(new Vec4(...topLeftWorldPos.toTuple(), 1), viewMatrix),
		)
		const topRightProjected = Vec4.perspectiveDivide(
			Vec4.applyMat4(new Vec4(...topRightWorldPos.toTuple(), 1), viewMatrix),
		)
		const bottomLeftProjected = Vec4.perspectiveDivide(
			Vec4.applyMat4(new Vec4(...bottomLeftWorldPos.toTuple(), 1), viewMatrix),
		)
		const bottomRightProjected = Vec4.perspectiveDivide(
			Vec4.applyMat4(new Vec4(...bottomRightWorldPos.toTuple(), 1), viewMatrix),
		)

		const isBeyondHorizon = (lngLat: LngLat) => {
			const toPoint = new Vec3(lngLatToWorld(lngLat, earthRadius)).normalized()
			const cosThetaForPoint = Vec3.dot(toCamera, toPoint)
			return cosThetaForPoint < cosThetaForHorizon
		}
		const isInViewFrustum = (projectedPos: Vec3) =>
			projectedPos.x >= -1 && projectedPos.x <= 1 && projectedPos.y >= -1 && projectedPos.y <= 1

		const isTopLeftBeyondHorizon = isBeyondHorizon(topLeft)
		const isTopRightBeyondHorizon = isBeyondHorizon(topRight)
		const isBottomLeftBeyondHorizon = isBeyondHorizon(bottomLeft)
		const isBottomRightBeyondHorizon = isBeyondHorizon(bottomRight)
		const isTopLeftInView = isInViewFrustum(topLeftProjected) && !isTopLeftBeyondHorizon
		const isTopRightInView = isInViewFrustum(topRightProjected) && !isTopRightBeyondHorizon
		const isBottomLeftInView = isInViewFrustum(bottomLeftProjected) && !isBottomLeftBeyondHorizon
		const isBottomRightInView = isInViewFrustum(bottomRightProjected) && !isBottomRightBeyondHorizon
		let couldTileBeInView = isTopLeftInView || isTopRightInView || isBottomLeftInView || isBottomRightInView
		isTileInView = isTopLeftInView && isTopRightInView && isBottomLeftInView && isBottomRightInView

		let closestPoint: TileCoord
		if (lngLat[0] < tile[1]) {
			if (lngLat[1] < tile[2]) closestPoint = [tile[1], tile[2]] as TileCoord
			else if (lngLat[1] > tile[2] + 1) closestPoint = [tile[1], tile[2] + 1] as TileCoord
			else closestPoint = [tile[1], lngLat[1]] as TileCoord
		} else if (lngLat[0] > tile[1] + 1) {
			if (lngLat[1] < tile[2]) closestPoint = [tile[1] + 1, tile[2]] as TileCoord
			else if (lngLat[1] > tile[2] + 1) closestPoint = [tile[1] + 1, tile[2] + 1] as TileCoord
			else closestPoint = [tile[1] + 1, lngLat[1]] as TileCoord
		} else {
			if (lngLat[1] < tile[2]) closestPoint = [lngLat[0], tile[2]] as TileCoord
			else if (lngLat[1] > tile[2] + 1) closestPoint = [lngLat[0], tile[2] + 1] as TileCoord
			else closestPoint = [lngLat[0], lngLat[1]] as TileCoord
		}

		const isClosestPointInTile =
			closestPoint[0] >= topLeft[0] &&
			closestPoint[0] <= topRight[0] &&
			closestPoint[1] >= bottomLeft[1] &&
			closestPoint[1] <= topLeft[1]
		couldTileBeInView ||= isClosestPointInTile
		isTileInView ||= isClosestPointInTile

		if (!couldTileBeInView) return []
	}

	if (maxTileSize < 1) return [tile]

	const childTopLeft = processTile(
		[tile[0] + 1, tile[1] * 2, tile[2] * 2] as TileIdArr,
		viewMatrix,
		lngLat,
		cameraPos,
		screenWidth,
		referenceTileSize,
		recursionLimit,
		isTileInView,
	)
	const childTopRight = processTile(
		[tile[0] + 1, tile[1] * 2 + 1, tile[2] * 2] as TileIdArr,
		viewMatrix,
		lngLat,
		cameraPos,
		screenWidth,
		referenceTileSize,
		recursionLimit,
		isTileInView,
	)
	const childBottomLeft = processTile(
		[tile[0] + 1, tile[1] * 2, tile[2] * 2 + 1] as TileIdArr,
		viewMatrix,
		lngLat,
		cameraPos,
		screenWidth,
		referenceTileSize,
		recursionLimit,
		isTileInView,
	)
	const childBottomRight = processTile(
		[tile[0] + 1, tile[1] * 2 + 1, tile[2] * 2 + 1] as TileIdArr,
		viewMatrix,
		lngLat,
		cameraPos,
		screenWidth,
		referenceTileSize,
		recursionLimit,
		isTileInView,
	)
	return [tile, ...childTopLeft, ...childTopRight, ...childBottomLeft, ...childBottomRight]
}
