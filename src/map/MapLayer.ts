import earcut from "earcut"

import {type MapTile} from "./MapTile"
import {type MapContext} from "@/map/MapContext"
import {type Material} from "@/materials/Material"
import {FlatMesh} from "@/meshes/FlatMesh"
import {LineMesh} from "@/meshes/LineMesh"
import {type Mesh} from "@/meshes/Mesh"
import {type MapTileLayer, type MercatorCoord, type WorldCoord} from "@/types"
import {groupByTwos, mercatorToWorld} from "@/util"

export type MapLayerProps = {
	layer: MapTileLayer
	color: string
}

export class MapLayer {
	meshes: Mesh[] = []

	constructor(
		private mapContext: MapContext,
		public tile: MapTile,
		public layer: MapTileLayer,
		public material: Material,
	) {
		const lines: MercatorCoord[][] = []
		const polygons = {
			vertices: [] as MercatorCoord[],
			indices: [] as number[],
		}
		for (const feature of layer.features) {
			switch (feature.type) {
				case `LineString`: {
					lines.push(...feature.geometry)
					break
				}
				case `Polygon`: {
					const featurePolygons = classifyRings(feature.geometry)
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

						// The indices returned by earcut run CCW; reverse each triangle to make them CW
						for (let i = 0; i < indices.length; i += 3) {
							;[indices[i], indices[i + 2]] = [indices[i + 2]!, indices[i]!]
						}

						polygons.indices.push(...indices.map((index) => index + polygons.vertices.length))
						polygons.vertices.push(...(groupByTwos(vertices) as MercatorCoord[]))
					}
					break
				}
			}
		}

		if (lines.length > 0)
			this.meshes.push(
				new LineMesh(
					mapContext,
					{
						vertices: lines.map((line) => line.map((vertex) => mercatorToWorld(vertex))),
						thickness: 0.002,
					},
					material,
				),
			)
		if (polygons.vertices.length > 0)
			this.meshes.push(
				new FlatMesh(
					mapContext,
					{
						vertices: polygons.vertices.map((v) => mercatorToWorld(v)),
						indices: polygons.indices,
					},
					material,
				),
			)
	}

	draw = (encoder: GPURenderPassEncoder) => {
		this.meshes.forEach((mesh) => mesh.draw(encoder))
	}
}

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
