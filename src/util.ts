export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const lng2tile = (lng: number, zoom: number) => Math.floor(((lng + 180) / 360) * Math.pow(2, zoom))

export const lat2tile = (lat: number, zoom: number) =>
	Math.floor(
		((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
			Math.pow(2, zoom),
	)

export const roundToNearest = (value: number, nearest: number) => Math.round(value / nearest) * nearest
