import {MapLayer} from "./MapLayer"
import {type TileManager} from "./TileManager"
import {type MapContext} from "@/map/MapContext"
import {type MapTileType} from "@/types"

export class MapTile {
	layers: MapLayer[] = []

	constructor(
		private mapContext: MapContext,
		public tileManager: TileManager,
		public tile: MapTileType,
	) {
		if (tile.layers.water) this.layers.push(new MapLayer(mapContext, this, tile.layers.water, [0.0, 0.2, 0.4]))
		if (tile.layers.admin) this.layers.push(new MapLayer(mapContext, this, tile.layers.admin, [0.9, 0.9, 0.9]))
		if (tile.layers.road) this.layers.push(new MapLayer(mapContext, this, tile.layers.road, [0.8, 0.7, 0.1]))
	}

	preDraw = async () => {
		await Promise.allSettled(this.layers.map((layer) => layer.preDraw()))
	}

	draw = (encoder: GPURenderPassEncoder) => {
		this.layers.forEach((layer) => layer.draw(encoder))
	}
}
