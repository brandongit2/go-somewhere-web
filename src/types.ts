import {type VectorTileFeature} from "@mapbox/vector-tile"
import {type Opaque} from "type-fest"

export type Coord2d = [number, number]

export type Coord3d = [number, number, number]

/** ECEF stands for Earth-centered, Earth-fixed. */
export type EcefCoord = Opaque<[number, number, number], "EcefCoord">

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

export type MercatorCoord = Opaque<[number, number], "MercatorCoord">

export type TileIdArr = Opaque<[number, number, number], "TileIdArr"> // [zoom, x, y]

export type TileIdStr = `${number}/${number}/${number}`

export type TileCoord = Opaque<[number, number], "TileCoord">

export type WorldCoord = Opaque<[number, number, number], "WorldCoord">
