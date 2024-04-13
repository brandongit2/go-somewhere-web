import earcut from "earcut"

import {PX_PER_TILE} from "@/const"
import {Line} from "@/map/features/Line"
import {Polygon} from "@/map/features/Polygon"
import {type MapRoot} from "@/map/MapRoot"
import {type PerspectiveCamera} from "@/map/PerspectiveCamera"
import {Mat4} from "@/math/Mat4"
import {Vec3} from "@/math/Vec3"
import {
	type LngLat,
	type TileId,
	type WorldCoord,
	type Coord3d,
	type MercatorCoord,
	type TileIdStr,
	type MapObject,
	type MapTileLayer,
} from "@/types"
import {degToRad, lngLatToWorld, tileToLngLat, mercatorToWorld, roughEq, groupByTwos} from "@/util"
import {dispatchToWorker} from "@/worker-pool"

const baseLineThickness = 0.008
const layerColors: Record<string, Coord3d> = {
	water: [0.0, 0.2, 0.4],
	admin: [0.9, 0.9, 0.9],
	road: [0.8, 0.7, 0.1],
}

export class MapTile implements MapObject {
	abortController = new AbortController()
	children: MapObject[] = []
	loaded = false
	// obb: Obb

	constructor(
		private map: MapRoot,
		public tileId: TileIdStr,
	) {
		if (!this.loaded)
			dispatchToWorker(`fetchTile`, {tileId}, {signal: this.abortController.signal})
				.then(({layers}) => {
					this.setLayers(layers)
				})
				.catch((err) => {
					throw err
				})

		// const topLeft = new Vec3(tileToWorld(tileId))
		// const bottomLeft = new Vec3(tileToWorld({zoom: tileId.zoom, x: tileId.x, y: tileId.y + 1}))
		// const bottomRight = new Vec3(tileToWorld({zoom: tileId.zoom, x: tileId.x + 1, y: tileId.y + 1}))
		// const center = new Vec3(tileToWorld({zoom: tileId.zoom, x: tileId.x + 0.5, y: tileId.y + 0.5}))

		// const north = Vec3.subtract(null, topLeft, bottomLeft)
		// const northExtent = north.length()
		// north.scaleBy(1 / northExtent)
		// const east = Vec3.subtract(null, bottomRight, bottomLeft)
		// const eastExtent = east.length()
		// east.scaleBy(1 / eastExtent)
		// const up = Vec3.cross(null, east, north).normalize()
		// const bottomLeftToCenter = Vec3.subtract(null, center, bottomLeft)
		// const upExtent = Vec3.dot(up, bottomLeftToCenter)
		// const orientation = new Mat4(east, up, north)

		// this.obb = new Obb(
		// 	Vec3.subtract(null, center, Vec3.scaleBy(null, up, upExtent / 2)),
		// 	new Vec3(eastExtent / 2, upExtent / 2, northExtent / 2),
		// 	orientation,
		// )
		// const basisX = new Vec3()
		// const basisY = new Vec3()
		// const basisZ = new Vec3()
		// Mat4.extractBasis(basisX, basisY, basisZ, this.obb.orientation)
		// basisX.scaleBy(this.obb.halfSizes.x * 2)
		// basisY.scaleBy(this.obb.halfSizes.y * 2)
		// basisZ.scaleBy(this.obb.halfSizes.z * 2)
		// const posCorner = Vec3.add(null, this.obb.center, basisX).add(basisY).add(basisZ).scaleBy(0.5)
		// const negX = Vec3.subtract(null, posCorner, basisX)
		// const negY = Vec3.subtract(null, posCorner, basisY)
		// const negZ = Vec3.subtract(null, posCorner, basisZ)
		// const negXZ = Vec3.subtract(null, negX, basisZ)
		// this.children.push(
		// 	new NativeLine(mapContext, {
		// 		indices: [[0, 1, 4, 3, 0, 2, 5, 7, 6]],
		// 		vertices: [
		// 			posCorner.as<WorldCoord>(),
		// 			negX.as<WorldCoord>(),
		// 			negY.as<WorldCoord>(),
		// 			negZ.as<WorldCoord>(),
		// 			negXZ.as<WorldCoord>(),
		// 			negY.subtract(basisX).as<WorldCoord>(),
		// 			negY.subtract(basisZ).as<WorldCoord>(),
		// 			negXZ.subtract(basisY).as<WorldCoord>(),
		// 		],
		// 		color: [1, 0, 0],
		// 	}),
		// )
	}

	preDraw = async () => {
		await Promise.allSettled(
			this.children
				.filter((child): child is Line => child instanceof Line)
				.map(async (line) => {
					await line.setThickness(baseLineThickness * 2 ** -this.map.zoom)
				}),
		)
	}

	setLayers = (layers: Record<string, MapTileLayer>) => {
		for (const [layerName, layer] of Object.entries(layers)) {
			let lines: MercatorCoord[][] = []
			const polygons: MercatorCoord[][] = []
			for (const feature of layer.features) {
				let arr: MercatorCoord[][]
				if (feature.type === `LineString`) arr = lines
				else if (feature.type === `Polygon`) arr = polygons
				else continue

				arr.push(...feature.geometry)
			}

			if (lines.length > 0)
				this.children.push(
					new Line(this.map, {
						lines: lines.map((line) => line.map((coord) => mercatorToWorld(coord))),
						thickness: baseLineThickness,
						viewPoint: [0, 0, 0] as WorldCoord,
						color: layerColors[layerName]!,
					}),
				)
			if (polygons.length > 0) {
				const {indices, vertices} = processPolygons(polygons)
				this.children.push(new Polygon(this.map, {indices, vertices, color: layerColors[layerName]!}))
			}
		}
	}
}

const processPolygons = (polygons: MercatorCoord[][]) => {
	const indices: number[] = []
	const vertices: WorldCoord[] = []

	const featurePolygons = classifyRings(polygons)
	for (let polygon of featurePolygons) {
		const polygonVertices = polygon.flat(2)
		let i = 0
		const holeIndices = polygon
			.map((ring) => {
				const holeIndex = i
				i += ring.length
				return holeIndex
			})
			.slice(1)

		let polygonIndices = earcut(polygonVertices, holeIndices)

		// In transforming from Mercator coord to world space, the vertical axis is flipped. So that this doesn't mess with
		// the winding order, we reverse the order of every triangle's vertices.
		for (let i = 0; i < polygonIndices.length; i += 3) {
			;[polygonIndices[i], polygonIndices[i + 2]] = [polygonIndices[i + 2]!, polygonIndices[i]!]
		}

		indices.push(...polygonIndices.map((index) => index + vertices.length))
		vertices.push(...groupByTwos<MercatorCoord>(polygonVertices).map((coord) => mercatorToWorld(coord)))
	}

	return {indices, vertices}
}

const classifyRings = (rings: MercatorCoord[][]) => {
	if (rings.length <= 1) return [rings]

	let polygons: MercatorCoord[][][] = []
	let currentPolygon: MercatorCoord[][] = []
	for (const ring of rings) {
		let area = signedArea(ring)

		if (roughEq(area, 0)) continue
		if (area > 0) {
			if (currentPolygon.length > 0) polygons.push(currentPolygon)
			currentPolygon = [ring]
		} else {
			currentPolygon.push(ring)
		}
	}
	if (polygons.at(-1)! !== currentPolygon) polygons.push(currentPolygon)

	return polygons
}

const signedArea = (ring: MercatorCoord[]) => {
	let area = 0
	for (let i = 0; i < ring.length; i++) {
		const [x1, y1] = ring[i]!
		const [x2, y2] = ring[(i + 1) % ring.length]!

		area += x1 * y2 - x2 * y1
	}

	return area / 2
}

const isTileInView = () => {
	return true
}

const isTileTooBig = (
	tile: TileId,
	camera: PerspectiveCamera,
	cameraPos: LngLat,
	windowWidth: number,
	windowHeight: number,
) => {
	let closestPointOnTile: LngLat
	if (tile.zoom === 0) {
		closestPointOnTile = cameraPos
	} else {
		const tileTopLeftLngLat = tileToLngLat(tile)
		const tileBottomRightLngLat = tileToLngLat({zoom: tile.zoom, x: tile.x + 1, y: tile.y + 1})
		const tileTopLeft = new Vec3(lngLatToWorld(tileTopLeftLngLat))
		const tileBottomRight = new Vec3(lngLatToWorld(tileBottomRightLngLat))

		const leftPlaneNormal = Vec3.cross(null, tileTopLeft, new Vec3(0, 1, 0))
		const topPlaneNormal = Vec3.cross(null, leftPlaneNormal, tileTopLeft)
		const rightPlaneNormal = Vec3.cross(null, tileBottomRight, new Vec3(0, -1, 0))
		const bottomPlaneNormal = Vec3.cross(null, rightPlaneNormal, tileBottomRight)

		const cameraPosWorld = new Vec3(lngLatToWorld(cameraPos))
		const isCameraAboveTile =
			tile.zoom === 1 ? cameraPos.lat > tileTopLeftLngLat.lat : Vec3.dot(cameraPosWorld, topPlaneNormal) > 0
		const isCameraBelowTile =
			tile.zoom === 1 ? cameraPos.lat < tileBottomRightLngLat.lat : Vec3.dot(cameraPosWorld, bottomPlaneNormal) > 0
		const isCameraLeftOfTile = Vec3.dot(cameraPosWorld, leftPlaneNormal) > 0
		const isCameraRightOfTile = Vec3.dot(cameraPosWorld, rightPlaneNormal) > 0

		if (isCameraAboveTile) {
			if (isCameraLeftOfTile) closestPointOnTile = tileTopLeftLngLat
			else if (isCameraRightOfTile) closestPointOnTile = {lng: tileBottomRightLngLat.lng, lat: tileTopLeftLngLat.lat}
			else closestPointOnTile = {lng: cameraPos.lng, lat: tileTopLeftLngLat.lat}
		} else if (isCameraBelowTile) {
			if (isCameraLeftOfTile) closestPointOnTile = {lng: tileTopLeftLngLat.lng, lat: tileBottomRightLngLat.lat}
			else if (isCameraRightOfTile) closestPointOnTile = tileBottomRightLngLat
			else closestPointOnTile = {lng: cameraPos.lng, lat: tileBottomRightLngLat.lat}
		} else {
			if (isCameraLeftOfTile) closestPointOnTile = {lng: tileTopLeftLngLat.lng, lat: cameraPos.lat}
			else if (isCameraRightOfTile) closestPointOnTile = {lng: tileBottomRightLngLat.lng, lat: cameraPos.lat}
			else closestPointOnTile = cameraPos
		}
	}

	const a = (2 * degToRad(closestPointOnTile.lat) + Math.PI) / 4
	const latitudeFactor = 2 * Math.sin(a) * Math.cos(a)
	const referenceTileSize = Math.PI
	const zoomFactor = 2 ** -tile.zoom
	const pointWorldPos = new Vec3(lngLatToWorld(closestPointOnTile))
	const west = Vec3.cross(null, pointWorldPos, new Vec3(0, 1, 0))
		.normalize()
		.scaleBy((referenceTileSize / 2) * zoomFactor * latitudeFactor)
	const north = Vec3.cross(null, west, pointWorldPos)
		.normalize()
		.scaleBy((referenceTileSize / 2) * zoomFactor * latitudeFactor)

	const viewProjectionMatrix = Mat4.multiply(null, camera.projectionMatrix, camera.viewMatrix)
	const centerProjected = Vec3.applyMat4(null, viewProjectionMatrix, pointWorldPos)
	const westProjected = Vec3.add(null, pointWorldPos, west).applyMat4(viewProjectionMatrix)
	const northProjected = Vec3.add(null, pointWorldPos, north).applyMat4(viewProjectionMatrix)

	let width = Math.abs((centerProjected.x - westProjected.x) * 2) * windowWidth
	let height = Math.abs((northProjected.y - centerProjected.y) * 2) * windowHeight
	const avgSize = (width + height) / 2

	return avgSize > PX_PER_TILE
}
