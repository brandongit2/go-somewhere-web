export const MercatorCoordinate = {
	mercatorXfromLng: (lng: number) => (180 + lng) / 360,
	mercatorYfromLat: (lat: number) =>
		(180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360,
	fromLngLat: (lngLat: [number, number]) => {
		let x = MercatorCoordinate.mercatorXfromLng(lngLat[0])
		let y = MercatorCoordinate.mercatorYfromLat(lngLat[1])

		x = -1 + x * 2
		y = 1 - y * 2

		return [x, y]
	},
}
