import {type TileCoords} from "@/types"

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const degToRad = (a: number) => a * (Math.PI / 180)

export const lngTotile = (lng: number, zoom: number) => ((lng + 180) / 360) * Math.pow(2, zoom)

export const lngFromMercatorX = (x: number) => {
	return x * 360 - 180
}

export const latTotile = (lat: number, zoom: number) =>
	((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
	Math.pow(2, zoom)

export const latFromMercatorY = (y: number) => {
	const y2 = 180 - y * 360
	return (360 / Math.PI) * Math.atan(Math.exp((y2 * Math.PI) / 180)) - 90
}

export const latLngToECEF = (lat: number, lng: number, radius = 1): [number, number, number] => {
	lng = degToRad(lng)
	const cosLat = Math.cos(degToRad(lat))
	const sinLat = Math.sin(degToRad(lat))
	const sinLng = Math.sin(degToRad(lng))

	return [cosLat * radius, sinLng * radius, sinLat * radius]
}

export const radToDeg = (a: number) => {
	return a * (180 / Math.PI)
}

export const roughEq = (a: number, b: number, epsilon = 1e-6) => Math.abs(a - b) < epsilon

export const roundToNearest = (value: number, nearest: number) => Math.round(value / nearest) * nearest

export const tileTolat = (y: number, z: number) => {
	const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z)
	return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

export const tileTolng = (x: number, z: number) => (x / Math.pow(2, z)) * 360 - 180

export const tileCoordToECEF = (
	x: number,
	y: number,
	tileCoords: TileCoords,
	featureExtent: number,
	radius?: number,
): [number, number, number] => {
	const tileCount = 1 << tileCoords.zoom
	const mercatorX = (x / featureExtent + tileCoords.x) / tileCount
	const mercatorY = (y / featureExtent + tileCoords.y) / tileCount
	const lat = latFromMercatorY(mercatorY)
	const lng = lngFromMercatorX(mercatorX)
	const pos = latLngToECEF(lat, lng, radius)
	return pos
}

export const tileCoordToMercator = (x: number, y: number, tileCoords: TileCoords, featureExtent: number) => {
	const tileCount = 1 << tileCoords.zoom
	const mercatorX = (x / featureExtent + tileCoords.x) / tileCount
	const mercatorY = (y / featureExtent + tileCoords.y) / tileCount
	return [mercatorX, mercatorY]
}

export const vec2ArrayToVec3Array = (array: number[]) =>
	array.flatMap((coord, i) => (i % 2 === 0 ? [coord] : [coord, 0]))
