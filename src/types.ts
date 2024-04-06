import {type VectorTileFeature} from "@mapbox/vector-tile"
import {type Opaque, type Promisable} from "type-fest"

export type Coord2d = [number, number]

export type Coord3d = [number, number, number]

export type LngLat = {
	lng: number
	lat: number
}

export type MapLayerFeature = {
	extent: number
	type: (typeof VectorTileFeature.types)[number]
	id: number
	properties: Record<string, string | number | boolean>
	geometry: MercatorCoord[][]
}

export type MapObject = {
	children?: MapObject[]
	preDraw?: () => Promisable<void>
	draw?: (pass: GPURenderPassEncoder) => void
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

// [0, 1] range
export type MercatorCoord = Opaque<Coord2d, "MercatorCoord">

export type TileId = {
	zoom: number
	x: number
	y: number
}

export type TileIdStr = `${number}/${number}/${number}`

// [0, 1] range
export type TileLocalCoord = Opaque<Coord2d, "TileLocalCoord">

export type WindowCoord = Opaque<Coord2d, "WindowCoord">

export type WorldCoord = Opaque<Coord3d, "WorldCoord">
