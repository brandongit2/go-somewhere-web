import {
	type MercatorCoord,
	type TileId,
	type TileLocalCoord,
	type WorldCoord,
	type LngLat,
	type TileIdStr,
	type Coord2d,
} from "@/types"

export const breakDownTileId = (tileId: TileIdStr) => {
	const [zoom, x, y] = tileId.split(`/`).map(Number) as [number, number, number]
	return {zoom, x, y}
}

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const degToRad = (a: number) => a * (Math.PI / 180)

export const groupByTwos = <T extends Coord2d = Coord2d>(vertexArray: number[]) => {
	if (vertexArray.length % 2 !== 0) throw new Error(`vertexArray must have an even number of elements.`)

	const coordArray: T[] = []
	for (let i = 0; i < vertexArray.length; i += 2) {
		coordArray.push([vertexArray[i]!, vertexArray[i + 1]!] as T)
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

export const lngLatToMercator = (lngLat: LngLat): MercatorCoord => {
	const lambda = degToRad(lngLat.lng)
	const phi = degToRad(lngLat.lat)
	const x = (lambda + Math.PI) / (2 * Math.PI)
	const y = (Math.PI - Math.log(Math.tan(Math.PI / 4 + phi / 2))) / (2 * Math.PI)
	return [x, y] as MercatorCoord
}

export const lngLatToTile = (lngLat: LngLat, zoom: number): TileId => mercatorToTile(lngLatToMercator(lngLat), zoom)

export const lngLatToWorld = (lngLat: LngLat, radius = 1): WorldCoord => {
	const lng = degToRad(lngLat.lng)
	const lat = degToRad(lngLat.lat)

	const cosLat = Math.cos(lat)
	const sinLat = Math.sin(lat)
	const cosLng = Math.cos(lng)
	const sinLng = Math.sin(lng)

	return [cosLat * sinLng * radius, sinLat * radius, cosLat * cosLng * radius] as WorldCoord
}

export const mercatorToLngLat = (point: MercatorCoord): LngLat => {
	const [x, y] = point
	const lambda = 2 * Math.PI * x - Math.PI
	const phi = 2 * Math.atan(Math.exp(Math.PI - 2 * Math.PI * y)) - Math.PI / 2
	return {lng: radToDeg(lambda), lat: radToDeg(phi)}
}

export const mercatorToTile = (point: MercatorCoord, zoom: number): TileId => {
	const [x, y] = point
	const tileCount = 1 << zoom
	const xTile = Math.floor(x * tileCount)
	const yTile = Math.floor(y * tileCount)
	return {zoom, x: xTile, y: yTile}
}

export const mercatorToWorld = (point: MercatorCoord): WorldCoord => lngLatToWorld(mercatorToLngLat(point))

export const radToDeg = (a: number) => a * (180 / Math.PI)

export const roughEq = (a: number, b: number, epsilon = 1e-6) => Math.abs(a - b) < epsilon

export const roundToNearest = (value: number, nearest: number) => Math.round(value / nearest) * nearest

export const tileLocalCoordToLngLat = (coord: TileLocalCoord, tileId: TileId): LngLat =>
	tileToLngLat({
		zoom: tileId.zoom,
		x: tileId.x + coord[0],
		y: tileId.y + coord[1],
	})

export const tileLocalCoordToMercator = (
	coord: TileLocalCoord,
	tileId: TileId,
	featureExtent: number,
): MercatorCoord => {
	const [tileLocalX, tileLocalY] = coord
	const {zoom, x, y} = tileId
	const tileCount = 2 ** zoom
	const mercatorX = (tileLocalX / featureExtent + x) / tileCount
	const mercatorY = (tileLocalY / featureExtent + y) / tileCount
	return [mercatorX, mercatorY] as MercatorCoord
}

export const tileIdToStr = (tileId: TileId): TileIdStr => `${tileId.zoom}/${tileId.x}/${tileId.y}`

export const tileToLngLat = (tileId: TileId): LngLat => mercatorToLngLat(tileToMercator(tileId))

export const tileToMercator = (tileId: TileId): MercatorCoord => {
	const {zoom, x, y} = tileId
	const tileCount = 2 ** zoom
	return [x / tileCount, y / tileCount] as MercatorCoord
}

export const tileToWorld = (tileId: TileId, radius = 1): WorldCoord => lngLatToWorld(tileToLngLat(tileId), radius)

export const vec2ArrayToVec3Array = (array: number[]) =>
	array.flatMap((coord, i) => (i % 2 === 0 ? [coord] : [coord, 0]))
