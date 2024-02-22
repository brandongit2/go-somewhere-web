import earcut, {flatten} from "earcut"

import type {MapTile} from "./MapTile"
import type {Material} from "./Material"
import type {MapTileLayer} from "./types"

import {FlatMaterial} from "./FlatMaterial"
import {linestringToMesh} from "./linestring-to-mesh"
import {Mesh} from "./Mesh"
import {tile2lat, tile2lng} from "@/util"

export type MapLayerProps = {
	layer: MapTileLayer
	color: string
}

export class MapLayer {
	mesh: Mesh
	bgMesh: Mesh

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
					return [linestringToMesh(geometry.coordinates.flat(), 0.01)]
				}
				case `MultiLineString`: {
					return geometry.coordinates.map((coords) => linestringToMesh(coords.flat(), 0.01))
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

		this.bgMesh = new Mesh(
			tile.tileManager.mapContext,
			[0, 0, -1, 1, 0, -1, 1, 1, -1, 0, 1, -1],
			[0, 1, 2, 2, 3, 0],
			new FlatMaterial(tile.tileManager.mapContext, [0, 0.6, 0]),
		)
	}

	draw(encoder: GPURenderPassEncoder) {
		const {x, y, zoom} = this.tile.tile
		const zoomRounded = Math.floor(zoom)
		const top = tile2lat(y, zoomRounded)
		const right = tile2lng(x + 1, zoomRounded)
		const bottom = tile2lat(y + 1, zoomRounded)
		const left = tile2lng(x, zoomRounded)
		this.tile.tileManager.mapContext.device.queue.writeBuffer(
			this.bgMesh.vertexBuffer,
			0,
			new Float32Array([left, top, -1, right, top, -1, right, bottom, -1, left, bottom, -1]),
		)
		this.tile.tileManager.mapContext.device.queue.writeBuffer(
			this.bgMesh.indexBuffer,
			0,
			new Uint32Array([0, 1, 2, 2, 3, 0]),
		)
		this.bgMesh.draw(encoder)

		this.mesh.draw(encoder)
	}
}
