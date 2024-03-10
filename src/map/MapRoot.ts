import {PX_PER_TILE} from "@/const"
import {MapContext} from "@/map/MapContext"
import {FlatMaterial} from "@/materials/FlatMaterial"
import {Frustum} from "@/math/Frustum"
import {Mat4} from "@/math/Mat4"
import {Sphere} from "@/math/Sphere"
import {Vec3} from "@/math/Vec3"
import {Vec4} from "@/math/Vec4"
import {LineMesh} from "@/meshes/LineMesh"
import {type Mesh} from "@/meshes/Mesh"
import {type LngLat, type TileId, type TileLocalCoord, type WorldCoord} from "@/types"
import {breakDownTileId, degToRad, lngLatToWorld, tileIdToStr, tileLocalCoordToLngLat, tileToLngLat} from "@/util"

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
			new FlatMaterial(map.mapContext, [0, 0.3, 0]),
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
			let {zoom, x, y} = breakDownTileId(tileId)

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
		const {tileManager, device, viewMatrixBuffer, cameraPos, zoom, windowWidth, windowHeight} = this.mapContext

		this.mapContext.canvasElement.width = windowWidth * devicePixelRatio
		this.mapContext.canvasElement.height = windowHeight * devicePixelRatio
		this.mapContext.createDepthTexture()

		const fovX = 75
		let viewMatrix = Mat4.makePerspective(fovX, windowWidth / windowHeight, 0.0001)
		const distance = cameraDistanceFromZoom(zoom)
		const cameraPosWorld = new Vec3(lngLatToWorld(cameraPos, distance + 1))
		const rotationMatrix = Mat4.lookAt(cameraPosWorld, new Vec3(0, 0, 0), new Vec3(0, 1, 0))
		viewMatrix = Mat4.mul(viewMatrix, rotationMatrix)

		const visibleTiles = processTile({zoom: 0, x: 0, y: 0}, viewMatrix, cameraPos, zoom, windowWidth, windowHeight)
		tileManager.setTilesInView(visibleTiles.map((tileId) => tileIdToStr(tileId)))
		;(this.extraObjects[0] as LineMesh).set({
			vertices: visibleTiles.map(
				({zoom, x, y}) =>
					[
						lngLatToWorld(tileToLngLat({zoom, x, y})),
						lngLatToWorld(tileToLngLat({zoom, x: x + 1, y})),
						lngLatToWorld(tileToLngLat({zoom, x: x + 1, y: y + 1})),
						lngLatToWorld(tileToLngLat({zoom, x, y: y + 1})),
						lngLatToWorld(tileToLngLat({zoom, x, y})),
					] as WorldCoord[],
			),
			thickness: 0.01,
		})

		device.queue.writeBuffer(viewMatrixBuffer, 0, new Float32Array(viewMatrix))
	}
}

// Distance to surface of globe
const cameraDistanceFromZoom = (zoom: number) => Math.PI / Math.tan(degToRad(75) / 2) / 2 ** zoom

const processTile = (
	tile: TileId,
	viewMatrix: Mat4,
	cameraPos: LngLat,
	zoom: number,
	windowWidth: number,
	windowHeight: number,
	maxZoom = 18,
): TileId[] => {
	if (tile.zoom > maxZoom) return []

	// Determine the points to sample
	let pointsToSample: LngLat[] = []
	if (tile.zoom > 4) {
		// Less distortion; just sample the corners

		const pointsToSampleTileLocal = [
			[0, 0],
			[0, 1],
			[1, 0],
			[1, 1],
		] as TileLocalCoord[]
		pointsToSample = pointsToSampleTileLocal.map((coord) =>
			tileToLngLat({zoom: tile.zoom, x: tile.x + coord[0], y: tile.y + coord[1]}),
		)
	} else {
		// More distortion; sample a lattice of points

		for (let x = 0; x <= 4; x++) {
			for (let y = 0; y <= 4; y++) {
				const tileLocal = [x / 4, y / 4] as TileLocalCoord
				const lngLat = tileLocalCoordToLngLat(tileLocal, tile)
				pointsToSample.push(lngLat)
			}
		}
	}
	const tileTopLeft = tileToLngLat(tile)
	const tileBottomRight = tileToLngLat({zoom: tile.zoom, x: tile.x + 1, y: tile.y + 1})
	if (
		cameraPos.lng >= tileTopLeft.lng &&
		cameraPos.lng <= tileBottomRight.lng &&
		cameraPos.lat <= tileTopLeft.lat &&
		cameraPos.lat >= tileBottomRight.lat
	)
		pointsToSample.push(cameraPos)

	// Determine which points are visible (neither outside the frustum nor beyond the horizon)
	// If tile is not visible, discard
	const cameraPosWorld = new Vec3(lngLatToWorld(cameraPos))
	const toCamera = cameraPosWorld.normalized()
	const cameraDistance = cameraDistanceFromZoom(zoom) + 1
	// The vector from globe centre to horizon and the vector to camera form a right triangle, where the hypotenuse is the
	// vector from the globe centre to camera.
	// cos(θ) = adj. / hyp.; adj. = globe radius = 1; hyp. = camera distance
	const cosThetaForHorizon = 1 / cameraDistance

	const isTileBeyondHorizon =
		tile.zoom > 1 &&
		pointsToSample.every((lngLat) => {
			const toPoint = new Vec3(lngLatToWorld(lngLat)).normalized()
			const cosThetaForPoint = Vec3.dot(toCamera, toPoint)
			const isBeyondHorizon = cosThetaForPoint < cosThetaForHorizon
			return isBeyondHorizon
		})
	const isTileCompletelyInFrustum = pointsToSample.every((lngLat) => {
		const worldCoord = new Vec3(lngLatToWorld(lngLat))
		const projectedPos = Vec4.perspectiveDivide(Vec4.applyMat4(new Vec4(...worldCoord.toTuple(), 1), viewMatrix))
		return projectedPos.x >= -1 && projectedPos.x <= 1 && projectedPos.y >= -1 && projectedPos.y <= 1
	})
	const viewFrustum = new Frustum(viewMatrix)
	const tileCenter = tileToLngLat({zoom: tile.zoom, x: tile.x + 0.5, y: tile.y + 0.5})
	const tileCenterWorld = new Vec3(lngLatToWorld(tileCenter))
	const topLeftWorld = new Vec3(lngLatToWorld(tileTopLeft))
	const tileRadius = tileCenterWorld.distanceTo(topLeftWorld)
	const tileIntersectsViewFrustum = viewFrustum.intersectsSphere(new Sphere(tileCenterWorld, tileRadius))

	const isTileInView = (isTileCompletelyInFrustum || tileIntersectsViewFrustum) && !isTileBeyondHorizon
	if (!isTileInView) return []

	// Determine tile size: if tile renders at greater that 512 px, render its children too
	const sizesAtPoints = pointsToSample.map((point) => {
		const a = (2 * degToRad(point.lat) + Math.PI) / 4
		const latitudeFactor = 2 * Math.sin(a) * Math.cos(a)
		const referenceTileSize = ((PX_PER_TILE * devicePixelRatio) / windowWidth) * 2 * Math.PI
		const d0 = cameraDistanceFromZoom(0)
		const dz = cameraDistanceFromZoom(tile.zoom)
		const zoomFactor = dz / d0
		const pointWorldPos = new Vec3(lngLatToWorld(point))
		const west = Vec3.cross(pointWorldPos, new Vec3(0, 1, 0))
			.normalized()
			.times((referenceTileSize / 2) * zoomFactor * latitudeFactor)
		const north = Vec3.cross(west, pointWorldPos)
			.normalized()
			.times((referenceTileSize / 2) * zoomFactor * latitudeFactor)

		const centerProjected = Vec4.perspectiveDivide(Vec4.applyMat4(new Vec4(...pointWorldPos.toTuple(), 1), viewMatrix))
		const westProjected = Vec4.perspectiveDivide(
			Vec4.applyMat4(new Vec4(...Vec3.add(pointWorldPos, west).toTuple(), 1), viewMatrix),
		)
		const northProjected = Vec4.perspectiveDivide(
			Vec4.applyMat4(new Vec4(...Vec3.add(pointWorldPos, north).toTuple(), 1), viewMatrix),
		)

		let width = Math.abs((centerProjected.x - westProjected.x) * 2)
		let height = Math.abs((northProjected.y - centerProjected.y) * 2)
		return ((width + height) / 2) * windowWidth
	})
	const maxSize = Math.max(...sizesAtPoints)

	const childTiles = [
		{zoom: tile.zoom + 1, x: tile.x * 2, y: tile.y * 2},
		{zoom: tile.zoom + 1, x: tile.x * 2 + 1, y: tile.y * 2},
		{zoom: tile.zoom + 1, x: tile.x * 2, y: tile.y * 2 + 1},
		{zoom: tile.zoom + 1, x: tile.x * 2 + 1, y: tile.y * 2 + 1},
	]

	if (maxSize < PX_PER_TILE * devicePixelRatio) return [tile]

	const children = childTiles.flatMap((tile) =>
		processTile(tile, viewMatrix, cameraPos, zoom, windowWidth, windowHeight, maxZoom),
	)
	return children
}
