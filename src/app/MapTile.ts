import type {TileManager} from "./TileManager"
import type {MapTileType} from "./types"

import {FlatMaterial} from "./FlatMaterial"
import {MapLayer} from "./MapLayer"
import {Mesh} from "./Mesh"
import {tile2lat, tile2lng} from "@/util"

export class MapTile {
	layers: MapLayer[] = []
	bgMesh: Mesh

	constructor(
		public tileManager: TileManager,
		public tile: MapTileType,
	) {
		if (tile.layers.water)
			this.layers.push(new MapLayer(this, tile.layers.water, new FlatMaterial(tileManager.mapContext, [0, 0, 1])))
		if (tile.layers.admin)
			this.layers.push(new MapLayer(this, tile.layers.admin, new FlatMaterial(tileManager.mapContext, [0.2, 0.2, 0.2])))

		this.bgMesh = new Mesh(
			tileManager.mapContext,
			[0, 0, -1, 1, 0, -1, 1, 1, -1, 0, 1, -1],
			[0, 1, 2, 2, 3, 0],
			new FlatMaterial(tileManager.mapContext, [0, 0.6, 0]),
		)
	}

	draw(encoder: GPURenderPassEncoder) {
		const {x, y, zoom} = this.tile
		const zoomRounded = Math.floor(zoom)
		const top = tile2lat(y, zoomRounded)
		const right = tile2lng(x + 1, zoomRounded)
		const bottom = tile2lat(y + 1, zoomRounded)
		const left = tile2lng(x, zoomRounded)
		this.tileManager.mapContext.device.queue.writeBuffer(
			this.bgMesh.vertexBuffer,
			0,
			new Float32Array([left, top, -1, right, top, -1, right, bottom, -1, left, bottom, -1]),
		)
		this.tileManager.mapContext.device.queue.writeBuffer(
			this.bgMesh.indexBuffer,
			0,
			new Uint32Array([0, 1, 2, 2, 3, 0]),
		)
		this.bgMesh.draw(encoder)

		this.layers.forEach((layer) => layer.draw(encoder))
	}
}
