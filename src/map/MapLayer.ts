import {type MapTile} from "./MapTile"
import {type Feature} from "@/map/features/Feature"
import {SurfaceLine} from "@/map/features/SurfaceLine"
import {SurfacePolygon} from "@/map/features/SurfacePolygon"
import {type MapContext} from "@/map/MapContext"
import {type Coord3d, type MapTileLayer, type MercatorCoord} from "@/types"

export class MapLayer {
	features: Feature[] = []

	constructor(
		private mapContext: MapContext,
		public tile: MapTile,
		public layer: MapTileLayer,
		public color: Coord3d,
	) {
		const lines: MercatorCoord[][] = []
		const polygons: MercatorCoord[][] = []
		for (const feature of layer.features) {
			let arr = feature.type === `LineString` ? lines : polygons
			arr.push(...feature.geometry)
		}

		if (lines.length > 0) this.features.push(new SurfaceLine(mapContext, {lines, thickness: 0.002, color}))
		if (polygons.length > 0) this.features.push(new SurfacePolygon(mapContext, {polygons, color}))
	}

	draw = (encoder: GPURenderPassEncoder) => {
		this.features.forEach((feature) => feature.draw(encoder))
	}
}
