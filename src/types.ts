import {type VectorTileFeature} from "@mapbox/vector-tile"
import {type Opaque} from "type-fest"

export type Coord2d = [number, number]

export type Coord3d = [number, number, number]

export type LngLat = Opaque<Coord2d, "LngLat">

export type MapLayerFeature = {
	extent: number
	type: (typeof VectorTileFeature.types)[number]
	id: number
	properties: Record<string, string | number | boolean>
	geometry: MercatorCoord[][]
}

export type MapTileType = {
	x: number
	y: number
	zoom: number
	layers: Record<string, MapTileLayer>
}

export type MapTileLayer = {
	version?: number
	name: string
	extent: number
	features: MapLayerFeature[]
}

export type MercatorCoord = Opaque<Coord2d, "MercatorCoord">

export type TileIdArr = Opaque<[number, number, number], "TileIdArr"> // [zoom, x, y]

export type TileIdStr = `${number}/${number}/${number}`

export type TileCoord = Opaque<Coord2d, "TileCoord">

export type WorldCoord = Opaque<Coord3d, "WorldCoord">
