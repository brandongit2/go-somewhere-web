import earcut, {flatten} from "earcut"

import type {MapTile} from "./MapTile"
import type {Material} from "./Material"
import type {MapTileLayer} from "./types"

import {linestringToMesh} from "./linestring-to-mesh"
import {Mesh} from "./Mesh"

export type MapLayerProps = {
	layer: MapTileLayer
	color: string
}

export class MapLayer {
	mesh: Mesh

	constructor(
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

		const geoms = geometries.flatMap((geometry) => {
			switch (geometry.type) {
				case `LineString`: {
					return [linestringToMesh(geometry.coordinates.flat(), 0.1)]
				}
				case `MultiLineString`: {
					return geometry.coordinates.map((coords) => linestringToMesh(coords.flat(), 0.1))
				}
				case `Polygon`: {
					const data = flatten(geometry.coordinates)
					const indices = earcut(data.vertices, data.holes, data.dimensions)
					const vertices = data.vertices.flatMap((coord, i) => (i % 2 === 0 ? coord : [coord, 0]))

					return [{vertices, indices}]
				}
				case `MultiPolygon`: {
					return geometry.coordinates.map((coords) => {
						const data = flatten(coords)
						const indices = earcut(data.vertices, data.holes, data.dimensions)
						const vertices = data.vertices.flatMap((coord, i) => (i % 2 === 0 ? coord : [coord, 0]))

						return {vertices, indices}
					})
				}
				default: {
					return []
				}
			}
		})

		let singleGeom = {vertices: [] as number[], indices: [] as number[]}
		for (const geom of geoms) {
			singleGeom.indices.push(...geom.indices.map((index) => index + singleGeom.vertices.length / 3))
			singleGeom.vertices.push(...geom.vertices)
		}

		this.mesh = new Mesh(tile.tileManager.mapContext, singleGeom.vertices, singleGeom.indices, material)
	}

	draw(encoder: GPURenderPassEncoder) {
		this.mesh.draw(encoder)
	}
}
