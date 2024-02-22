import type {TileManager} from "./TileManager"
import type {MapTileType} from "./types"

import {FlatMaterial} from "./FlatMaterial"
import {MapLayer} from "./MapLayer"

export class MapTile {
	layers: MapLayer[] = []

	constructor(
		public tileManager: TileManager,
		public tile: MapTileType,
	) {
		if (tile.layers.water)
			this.layers.push(new MapLayer(this, tile.layers.water, new FlatMaterial(tileManager.mapContext, [0, 0, 1])))
		// if (tile.layers.admin) this.layers.push(new MapLayer(tile.layers.admin, [0, 0, 0], webgpuContext))
	}

	draw(encoder: GPURenderPassEncoder) {
		this.layers.forEach((layer) => layer.draw(encoder))
	}
}
