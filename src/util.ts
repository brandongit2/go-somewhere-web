import {type EcefCoord, type MercatorCoord, type TileIdArr, type TileIdStr, type TileCoord} from "@/types"

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

export const latLngToEcef = (lat: number, lng: number, radius = 1): EcefCoord => {
	lat = degToRad(lat)
	lng = degToRad(lng)

	const cosLat = Math.cos(lat)
	const sinLat = Math.sin(lat)
	const cosLng = Math.cos(lng)
	const sinLng = Math.sin(lng)

	return [radius * cosLat * cosLng, radius * cosLat * sinLng, radius * sinLat] as EcefCoord
}

/** Continuous, not discrete!! */
export const latTotile = (lat: number, zoom: number) =>
	((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
	Math.pow(2, zoom)

/** Continuous, not discrete!! */
export const lngToTile = (lng: number, zoom: number) => ((lng + 180) / 360) * Math.pow(2, zoom)

export const mercatorToEcef = (point: MercatorCoord, radius?: number): EcefCoord => {
	const lat = mercatorYToLat(point[1])
	const lng = mercatorXToLng(point[0])
	const pos = latLngToEcef(lat, lng, radius)
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
