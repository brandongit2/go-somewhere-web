import {type Promisable} from "type-fest"

import {FOUR_BYTES_PER_FLOAT32, fovX, PX_PER_TILE, SIXTEEN_NUMBERS_PER_MAT4} from "@/const"
import {type Feature} from "@/map/features/Feature"
import {Line} from "@/map/features/Line"
import {type MapContext} from "@/map/MapContext"
import {type MapTile} from "@/map/MapTile"
import {TileManager} from "@/map/TileManager"
import {Frustum} from "@/math/Frustum"
import {Mat4} from "@/math/Mat4"
import {Sphere} from "@/math/Sphere"
import {Vec3} from "@/math/Vec3"
import {Vec4} from "@/math/Vec4"
import {type LngLat, type TileId, type TileLocalCoord, type WorldCoord} from "@/types"
import {
	breakDownTileId,
	clamp,
	degToRad,
	lngLatToWorld,
	tileIdToStr,
	tileLocalCoordToLngLat,
	tileToLngLat,
	tileToWorld,
} from "@/util"

const CONSTRUCTOR_KEY = Symbol(`\`MapRoot\` constructor key`)

export class MapRoot {
	mapContext: MapContext | undefined
	extraObjects: Feature[] = []

	constructor(key: typeof CONSTRUCTOR_KEY) {
		if (key !== CONSTRUCTOR_KEY) throw new Error(`\`MapRoot\` is not constructible. Use \`MapRoot.create()\` instead.`)
	}

	static create = async (canvasElement: HTMLCanvasElement) => {
		const map = new MapRoot(CONSTRUCTOR_KEY)

		const gpu = navigator.gpu
		const adapter = await gpu.requestAdapter()
		if (!adapter) throw new Error(`No suitable GPUs found.`)

		const device = await adapter.requestDevice({
			requiredFeatures: [`shader-f16`],
		})
		device.lost
			.then((info) => {
				if (info.reason !== `destroyed`) throw new Error(`GPU lost. Info: ${info.message}`)
			})
			.catch((error) => {
				throw error
			})

		const canvasContext = canvasElement.getContext(`webgpu`)
		if (!canvasContext) throw new Error(`WebGPU not supported.`)

		map.mapContext = {
			windowHeight: null!,
			windowWidth: null!,
			cameraPos: {lng: 0, lat: 0},
			zoom: 0,
			tileManager: null!,

			canvasContext,
			canvasElement,
			device,
			presentationFormat: navigator.gpu.getPreferredCanvasFormat(),
			depthTexture: null!,
			viewMatrixBuffer: device.createBuffer({
				label: `view matrix uniform buffer`,
				size: 16 * 4 * 4,
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			}),
		}
		canvasContext.configure({
			device,
			format: map.mapContext.presentationFormat,
		})
		map.mapContext.viewMatrixBuffer = device.createBuffer({
			label: `view matrix uniform buffer`,
			size: SIXTEEN_NUMBERS_PER_MAT4 * FOUR_BYTES_PER_FLOAT32,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		})

		map.onResize()
		map.mapContext.tileManager = new TileManager(map.mapContext)

		map.extraObjects[0] = new Line(map.mapContext, {
			lines: [],
			thickness: 0.01,
			viewPoint: [0, 0, 0] as WorldCoord,
			color: [0, 0.6, 0.2],
		})
		map.extraObjects[1] = new Line(map.mapContext, {
			lines: [
				[
					[-Math.PI + 0.01, 0, 1],
					[Math.PI - 0.01, 0, 1],
				] as WorldCoord[],
			],
			thickness: 0.01,
			viewPoint: lngLatToWorld(map.mapContext.cameraPos),
			color: [1, 0, 0],
		})

		return map
	}

	destroy = () => {
		this.mapContext?.device.destroy()
	}

	onResize = () => {
		if (!this.mapContext) return
		const {device, canvasElement} = this.mapContext

		this.mapContext.windowWidth = clamp(
			canvasElement.getBoundingClientRect().width * devicePixelRatio,
			1,
			device.limits.maxTextureDimension2D,
		)
		this.mapContext.windowHeight = clamp(
			canvasElement.getBoundingClientRect().height * devicePixelRatio,
			1,
			device.limits.maxTextureDimension2D,
		)
		canvasElement.width = this.mapContext.windowWidth
		canvasElement.height = this.mapContext.windowHeight

		this.mapContext.depthTexture = device.createTexture({
			label: `depth texture`,
			size: [this.mapContext.windowWidth, this.mapContext.windowHeight],
			format: `depth24plus`,
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
		})
	}

	beforeNextRender: Array<() => Promisable<void>> = []
	render = async () => {
		if (!this.mapContext) return
		const {
			device,
			canvasContext,
			tileManager,
			depthTexture,
			viewMatrixBuffer,
			cameraPos,
			zoom,
			windowHeight,
			windowWidth,
		} = this.mapContext

		let viewMatrix = Mat4.makePerspective(fovX, windowWidth / windowHeight, 0.000001)
		const distance = cameraDistanceFromZoom(zoom)
		const cameraPosWorld = new Vec3(lngLatToWorld(cameraPos, distance + 1))
		const rotationMatrix = Mat4.lookAt(cameraPosWorld, new Vec3(0, 0, 0), new Vec3(0, 1, 0))
		viewMatrix = Mat4.mul(viewMatrix, rotationMatrix)
		device.queue.writeBuffer(viewMatrixBuffer, 0, new Float32Array(viewMatrix))

		const visibleTiles: TileId[] = []
		const stack: TileId[] = [{zoom: 0, x: 0, y: 0}]
		while (stack.length > 0) {
			const tile = stack.pop()!
			const pointsToSample = getPointsToSample(tile, cameraPos)

			const isInView = isTileInView(tile, pointsToSample, viewMatrix, cameraPos, zoom)
			if (!isInView) continue

			const isTooBig = isTileTooBig(tile, pointsToSample, viewMatrix, windowWidth, windowHeight)
			if (isTooBig) {
				const childTiles = [
					{zoom: tile.zoom + 1, x: tile.x * 2, y: tile.y * 2},
					{zoom: tile.zoom + 1, x: tile.x * 2 + 1, y: tile.y * 2},
					{zoom: tile.zoom + 1, x: tile.x * 2, y: tile.y * 2 + 1},
					{zoom: tile.zoom + 1, x: tile.x * 2 + 1, y: tile.y * 2 + 1},
				]
				stack.push(...childTiles)
			} else {
				visibleTiles.push(tile)
			}
		}

		tileManager.setTilesInView(visibleTiles.map((tileId) => tileIdToStr(tileId)))
		;(this.extraObjects[0] as Line)
			.setGeom(
				visibleTiles.map(
					({zoom, x, y}) =>
						[
							tileToWorld({zoom, x, y}),
							tileToWorld({zoom, x: x + 1, y}),
							tileToWorld({zoom, x: x + 1, y: y + 1}),
							tileToWorld({zoom, x, y: y + 1}),
							tileToWorld({zoom, x, y}),
						] as WorldCoord[],
				),
			)
			.catch((err) => {
				throw err
			})

		const tilesToDraw: MapTile[] = []
		tileManager.tilesInView.forEach((tileId) => {
			// Try to find the tile in cache
			let tile = tileManager.fetchTileFromCache(tileId)
			// If it's not there (it should already be fetching), try to find a parent tile to render
			if (!tile) {
				let {zoom, x, y} = breakDownTileId(tileId)
				while (!tile) {
					;[x, y, zoom] = [x >> 1, y >> 1, zoom - 1]
					tile = tileManager.fetchTileFromCache(`${zoom}/${x}/${y}`)
					if (zoom <= 0) return
				}
			}

			tilesToDraw.push(tile)
		})

		await Promise.allSettled([
			...tilesToDraw.map(async (tile) => await tile.preDraw()),
			...this.beforeNextRender.map((fn) => fn()),
		])
		this.beforeNextRender = []

		const encoder = device.createCommandEncoder({label: `encoder`})
		const pass = encoder.beginRenderPass({
			label: `render pass`,
			colorAttachments: [
				{
					view: canvasContext.getCurrentTexture().createView({label: `colour texture view`}),
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

		tilesToDraw.forEach((tile) => tile.draw(pass))
		this.extraObjects.forEach((obj) => obj.draw(pass))

		pass.end()
		const commandBuffer = encoder.finish()
		device.queue.submit([commandBuffer])
	}

	zoomChangeAmt = 0
	setZoom = (newZoom: number) => {
		if (!this.mapContext) return

		this.zoomChangeAmt += newZoom - this.mapContext.zoom

		this.beforeNextRender.push(() => {
			if (!this.mapContext) return
			this.mapContext.zoom = clamp(this.mapContext.zoom + this.zoomChangeAmt, 0, 18)
			this.zoomChangeAmt = 0
		})
	}
}

// Distance to surface of globe
const cameraDistanceFromZoom = (zoom: number) => (Math.PI / Math.tan(degToRad(fovX) / 2)) * 2 ** -zoom

const getPointsToSample = (tile: TileId, cameraPos: LngLat): LngLat[] => {
	const buffer = 0.05
	const tileTopLeft = tileToLngLat({zoom: tile.zoom, x: tile.x - buffer, y: tile.y - buffer})
	const tileBottomRight = tileToLngLat({zoom: tile.zoom, x: tile.x + 1 + buffer, y: tile.y + 1 + buffer})

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

	if (
		cameraPos.lng >= tileTopLeft.lng &&
		cameraPos.lng <= tileBottomRight.lng &&
		cameraPos.lat <= tileTopLeft.lat &&
		cameraPos.lat >= tileBottomRight.lat
	)
		pointsToSample.push(cameraPos)

	return pointsToSample
}

const isTileInView = (tile: TileId, pointsToSample: LngLat[], viewMatrix: Mat4, cameraPos: LngLat, zoom: number) => {
	const tileTopLeft = tileToLngLat(tile)

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

	return (isTileCompletelyInFrustum || tileIntersectsViewFrustum) && !isTileBeyondHorizon
}

const isTileTooBig = (
	tile: TileId,
	pointsToSample: LngLat[],
	viewMatrix: Mat4,
	windowWidth: number,
	windowHeight: number,
) => {
	const sizesAtPoints = pointsToSample.map((point) => {
		const a = (2 * degToRad(point.lat) + Math.PI) / 4
		const latitudeFactor = 2 * Math.sin(a) * Math.cos(a)
		const referenceTileSize = Math.PI / 2
		const zoomFactor = 2 ** -tile.zoom
		const pointWorldPos = new Vec3(lngLatToWorld(point))
		const west = Vec3.cross(pointWorldPos, new Vec3(0, 1, 0))
			.normalized()
			.scaledBy((referenceTileSize / 2) * zoomFactor * latitudeFactor)
		const north = Vec3.cross(west, pointWorldPos)
			.normalized()
			.scaledBy((referenceTileSize / 2) * zoomFactor * latitudeFactor)

		const centerProjected = Vec4.perspectiveDivide(Vec4.applyMat4(new Vec4(...pointWorldPos.toTuple(), 1), viewMatrix))
		const westProjected = Vec4.perspectiveDivide(
			Vec4.applyMat4(new Vec4(...Vec3.add(pointWorldPos, west).toTuple(), 1), viewMatrix),
		)
		const northProjected = Vec4.perspectiveDivide(
			Vec4.applyMat4(new Vec4(...Vec3.add(pointWorldPos, north).toTuple(), 1), viewMatrix),
		)

		let width = Math.abs((centerProjected.x - westProjected.x) * 2) * windowWidth
		let height = Math.abs((northProjected.y - centerProjected.y) * 2) * windowHeight
		return (width + height) / 2
	})
	const maxSize = Math.max(...sizesAtPoints)

	return maxSize > PX_PER_TILE
}
