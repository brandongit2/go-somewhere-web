import earcut from "earcut"

import {type MapTile} from "./MapTile"
import {type Feature} from "@/map/features/Feature"
import {Line} from "@/map/features/Line"
import {Polygon} from "@/map/features/Polygon"
import {type MapContext} from "@/map/MapContext"
import {type Coord3d, type MapTileLayer, type MercatorCoord, type WorldCoord} from "@/types"
import {mercatorToWorld} from "@/util"

const baseLineThickness = 0.002

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

		if (lines.length > 0)
			this.features.push(
				new Line(mapContext, {
					lines: lines.map((line) => line.map((coord) => mercatorToWorld(coord))),
					thickness: baseLineThickness,
					viewPoint: [0, 0, 0] as WorldCoord,
					color,
				}),
			)
		if (polygons.length > 0) {
			const classifyRings = (rings: MercatorCoord[][]) => {
				if (rings.length <= 1) return [rings]

				let polygons: MercatorCoord[][][] = []
				let polygon: MercatorCoord[][] = []

				for (const ring of rings) {
					let area = signedArea(ring)

					if (area === 0) continue
					if (area > 0) {
						if (polygon.length > 0) polygons.push(polygon)
						polygon = [ring]
					} else {
						polygon.push(ring)
					}
				}
				if (polygons.at(-1)! !== polygon) polygons.push(polygon)

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

			const indices: number[] = []
			const vertices: number[] = []

			const featurePolygons = classifyRings(polygons)
			for (let polygon of featurePolygons) {
				const vertices = polygon.flat().flat()
				let i = 0
				const holeIndices = polygon
					.map((ring) => {
						const holeIndex = i
						i += ring.length
						return holeIndex
					})
					.slice(1)

				let indices = earcut(vertices, holeIndices)

				// In transforming from Mercator coord to world space, the vertical axis is flipped. So that this doesn't mess
				// with the winding order, we reverse the order of every triangle's vertices.
				for (let i = 0; i < indices.length; i += 3) {
					;[indices[i], indices[i + 2]] = [indices[i + 2]!, indices[i]!]
				}

				indices.push(...indices.map((index) => index + vertices.length))
				vertices.push(...vertices)
			}

			this.features.push(new Polygon(mapContext, {indices, vertices, color}))
		}
	}

	preDraw = async () => {
		await Promise.allSettled(
			this.features.map(async (feature) => {
				if (feature instanceof Line) await feature.setThickness(baseLineThickness * 2 ** -this.mapContext.zoom)
			}),
		)
	}

	draw = (encoder: GPURenderPassEncoder) => {
		this.features.forEach((feature) => feature.draw(encoder))
	}
}
