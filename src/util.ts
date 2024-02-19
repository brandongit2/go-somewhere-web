export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const lng2tile = (lng: number, zoom: number) => ((lng + 180) / 360) * Math.pow(2, zoom)

export const lat2tile = (lat: number, zoom: number) =>
	((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
	Math.pow(2, zoom)

export const roughEq = (a: number, b: number, epsilon = 1e-6) => Math.abs(a - b) < epsilon

export const roundToNearest = (value: number, nearest: number) => Math.round(value / nearest) * nearest

export const tile2lat = (y: number, z: number) => {
	const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z)
	return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

export const tile2lng = (x: number, z: number) => (x / Math.pow(2, z)) * 360 - 180

export const vec2ArrayToVec3Array = (array: number[]) =>
	array.flatMap((coord, i) => (i % 2 === 0 ? [coord] : [coord, 0]))
