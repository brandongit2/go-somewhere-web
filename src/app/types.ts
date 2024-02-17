import type {VectorTileFeature} from "@mapbox/vector-tile"
import type {Feature} from "geojson"

export type MapTileLayer = {
	version?: number
	name: string
	extent: number
	features: MapLayerFeature[]
}

export type MapLayerFeature = {
	extent: number
	type: (typeof VectorTileFeature.types)[number]
	id: number
	properties: Record<string, string | number | boolean>
	geoJson: Feature
}
