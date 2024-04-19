import {type RefObject} from "react"
import {create} from "zustand"

import {Camera} from "@/map/Camera"
import {type MapTile} from "@/map/MapTile"
import {type TileIdStr} from "@/types"

type MapState = {
	canvasRef: RefObject<HTMLCanvasElement>
	camera: Camera

	tileCache: Map<TileIdStr, MapTile>
	addTileToCache: (tile: MapTile) => void
}

export const useMapState = create<MapState>((set, get) => ({
	canvasRef: {current: null},
	camera: new Camera(80, 1, 0.00001, 10),

	tileCache: new Map<TileIdStr, MapTile>(), // Mutable
	addTileToCache: (tile: MapTile) => get().tileCache.set(tile.id, tile),
}))
