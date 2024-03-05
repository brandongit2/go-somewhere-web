import {type MercatorCoord, type TileIdArr, type TileIdStr, type TileCoord, type WorldCoord, type LngLat} from "@/types"

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const degToRad = (a: number) => a * (Math.PI / 180)

export const groupByTwos = (vertexArray: number[]) => {
	if (vertexArray.length % 2 !== 0) throw new Error(`vertexArray must have an even number of elements.`)

	const coordArray: Array<[number, number]> = []
	for (let i = 0; i < vertexArray.length; i += 2) {
		coordArray.push([vertexArray[i]!, vertexArray[i + 1]!])
	}
	return coordArray
}

export const groupByThrees = (vertexArray: number[]) => {
	if (vertexArray.length % 3 !== 0) throw new Error(`vertexArray length must be 3n.`)

	const coordArray: Array<[number, number, number]> = []
	for (let i = 0; i < vertexArray.length; i += 3) {
		coordArray.push([vertexArray[i]!, vertexArray[i + 1]!, vertexArray[i + 2]!])
	}
	return coordArray
}

/** Continuous, not discrrete!! */
export const lngLatToTile = (lngLat: LngLat, zoom: number): TileIdArr => {
	const x = lngToTileX(lngLat[0], zoom)
	const y = latToTileY(lngLat[1], zoom)
	return [zoom, x, y] as TileIdArr
}

export const lngLatToWorld = (lngLat: LngLat, radius = 1): WorldCoord => {
	const lng = degToRad(lngLat[0])
	const lat = degToRad(lngLat[1])

	const cosLat = Math.cos(lat)
	const sinLat = Math.sin(lat)
	const cosLng = Math.cos(lng)
	const sinLng = Math.sin(lng)

	return [cosLat * sinLng * radius, sinLat * radius, cosLat * cosLng * radius] as WorldCoord
}

export const latToMercatorY = (lat: number) =>
	(180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360

/** Continuous, not discrete!! */
export const latToTileY = (lat: number, zoom: number) =>
	((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
	Math.pow(2, zoom)

export const lngToMercatorX = (lng: number) => (180 + lng) / 360

/** Continuous, not discrete!! */
export const lngToTileX = (lng: number, zoom: number) => ((lng + 180) / 360) * Math.pow(2, zoom)

export const mercatorToWorld = (point: MercatorCoord): WorldCoord => {
	const lat = mercatorYToLat(point[1])
	const lng = mercatorXToLng(point[0])
	const pos = lngLatToWorld([lng, lat] as LngLat)
	return pos
}

export const mercatorXToLng = (x: number) => x * 360 - 180

export const mercatorYToLat = (y: number) => {
	const y2 = 180 - y * 360
	return (360 / Math.PI) * Math.atan(Math.exp((y2 * Math.PI) / 180)) - 90
}

export const radToDeg = (a: number) => a * (180 / Math.PI)

export const roughEq = (a: number, b: number, epsilon = 1e-6) => Math.abs(a - b) < epsilon

export const roundToNearest = (value: number, nearest: number) => Math.round(value / nearest) * nearest

export const tileIdStrToArr = (tileId: TileIdStr): TileIdArr =>
	tileId.split(`/`).map((coord) => parseInt(coord)) as TileIdArr

export const tileToLngLat = (tileId: TileIdArr) => {
	const [zoom, x, y] = tileId
	const lng = tileXToLng(x, zoom)
	const lat = tileYToLat(y, zoom)
	return [lng, lat] as LngLat
}

export const tileXToLng = (x: number, z: number) => (x / Math.pow(2, z)) * 360 - 180

export const tileYToLat = (y: number, z: number) => {
	const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z)
	return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

export const tileCoordToMercator = (coord: TileCoord, tileId: TileIdArr, featureExtent: number): MercatorCoord => {
	const [tileX, tileY] = coord
	const [zoom, x, y] = tileId
	const tileCount = 1 << zoom
	const mercatorX = (tileX / featureExtent + x) / tileCount
	const mercatorY = (tileY / featureExtent + y) / tileCount
	return [mercatorX, mercatorY] as MercatorCoord
}

export const vec2ArrayToVec3Array = (array: number[]) =>
	array.flatMap((coord, i) => (i % 2 === 0 ? [coord] : [coord, 0]))
