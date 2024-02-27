import {MapLayer} from "./MapLayer"
import {type TileManager} from "./TileManager"
import {type MapContext} from "@/map/MapContext"
import {FlatMaterial} from "@/materials/FlatMaterial"
import {FlatMesh} from "@/meshes/FlatMesh"
import {type MapTileType} from "@/types"
import {tileTolat, tileTolng} from "@/util"

export class MapTile {
	layers: MapLayer[] = []
	bgMesh: FlatMesh

	constructor(
		private mapContext: MapContext,
		public tileManager: TileManager,
		public tile: MapTileType,
	) {
		if (tile.layers.water)
			this.layers.push(new MapLayer(mapContext, this, tile.layers.water, new FlatMaterial(mapContext, [0, 0, 1])))
		if (tile.layers.admin)
			this.layers.push(new MapLayer(mapContext, this, tile.layers.admin, new FlatMaterial(mapContext, [0.2, 0.2, 0.2])))
		if (tile.layers.road)
			this.layers.push(new MapLayer(mapContext, this, tile.layers.road, new FlatMaterial(mapContext, [0.8, 0.7, 0])))

		this.bgMesh = new FlatMesh(
			mapContext,
			{
				vertices: [0, 0, -1, 1, 0, -1, 1, 1, -1, 0, 1, -1],
				indices: [0, 1, 2, 2, 3, 0],
			},
			new FlatMaterial(mapContext, [0, 0.6, 0]),
		)
	}

	draw(encoder: GPURenderPassEncoder) {
		const {x, y, zoom} = this.tile
		const zoomRounded = Math.floor(zoom)
		const top = tileTolat(y, zoomRounded)
		const right = tileTolng(x + 1, zoomRounded)
		const bottom = tileTolat(y + 1, zoomRounded)
		const left = tileTolng(x, zoomRounded)
		this.mapContext.device.queue.writeBuffer(
			this.bgMesh.vertexBuffer,
			0,
			new Float32Array([left, top, -1, right, top, -1, right, bottom, -1, left, bottom, -1]),
		)
		this.mapContext.device.queue.writeBuffer(this.bgMesh.indexBuffer, 0, new Uint32Array([0, 1, 2, 2, 3, 0]))
		this.bgMesh.draw(encoder)

		this.layers.forEach((layer) => layer.draw(encoder))
	}
}
