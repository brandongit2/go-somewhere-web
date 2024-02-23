import earcut, {flatten} from "earcut"

import {type MapTile} from "./MapTile"
import {type MapTileLayer} from "@/app/types"
import {type MapContext} from "@/map/MapContext"
import {type Material} from "@/materials/Material"
import {FlatMesh} from "@/meshes/FlatMesh"
import {LineMesh} from "@/meshes/LineMesh"
import {type Mesh} from "@/meshes/Mesh"
import {vec2ArrayToVec3Array} from "@/util"

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
		const geometries = layer.features
			.map((feature) => feature.geoJson.geometry)
			.flatMap((geometry) => {
				if (geometry.type === `GeometryCollection`) return geometry.geometries
				else return [geometry]
			})

		const lines: number[][] = []
		const polygons = {
			vertices: [] as number[],
			indices: [] as number[],
		}
		for (const geometry of geometries) {
			switch (geometry.type) {
				case `LineString`: {
					lines.push(geometry.coordinates.flat())
					break
				}
				case `MultiLineString`: {
					lines.push(...geometry.coordinates.map((coords) => coords.flat()))
					break
				}
				case `Polygon`: {
					const data = flatten(geometry.coordinates)
					const indices = earcut(data.vertices, data.holes, data.dimensions)
					const vertices = vec2ArrayToVec3Array(data.vertices)

					polygons.indices.push(...indices.map((index) => index + polygons.vertices.length / 3))
					polygons.vertices.push(...vertices)
					break
				}
				case `MultiPolygon`: {
					geometry.coordinates.forEach((coords) => {
						const data = flatten(coords)
						const indices = earcut(data.vertices, data.holes, data.dimensions)
						const vertices = vec2ArrayToVec3Array(data.vertices)

						polygons.indices.push(...indices.map((index) => index + polygons.vertices.length / 3))
						polygons.vertices.push(...vertices)
					})
					break
				}
			}
		}

		if (lines.length > 0) this.meshes.push(new LineMesh(mapContext, {vertices: lines, thickness: 1}, material))
		if (polygons.vertices.length > 0)
			this.meshes.push(new FlatMesh(mapContext, {vertices: polygons.vertices, indices: polygons.indices}, material))
	}

	draw = (encoder: GPURenderPassEncoder) => {
		this.meshes.forEach((mesh) => mesh.draw(encoder))
	}
}