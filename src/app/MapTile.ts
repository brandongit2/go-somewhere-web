import type {WebgpuContext} from "./context"
import type {MapTileType} from "./types"

import {MapLayer} from "./MapLayer"

export class MapTile {
	layers: MapLayer[] = []

	constructor(
		public tile: MapTileType,
		webgpuContext: WebgpuContext,
	) {
		if (tile.layers.water) this.layers.push(new MapLayer(tile.layers.water, [0, 0, 1], webgpuContext))
		// if (tile.layers.admin) this.layers.push(new MapLayer(tile.layers.admin, [0, 0, 0], webgpuContext))
	}

	draw(encoder: GPURenderPassEncoder, webgpuContext: WebgpuContext) {
		this.layers.forEach((layer) => layer.draw(encoder, webgpuContext))
	}
}
