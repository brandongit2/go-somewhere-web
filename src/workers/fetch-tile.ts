import {VectorTile, VectorTileFeature} from "@mapbox/vector-tile"
import Pbf from "pbf"
import wretch from "wretch"
import AbortAddon from "wretch/addons/abort"
// eslint-disable-next-line import/no-named-as-default -- `QueryStringAddon` in this import is an interface, not what we want
import QueryStringAddon from "wretch/addons/queryString"

import {MAPBOX_ACCESS_TOKEN} from "@/env"
import {type MapLayerFeature, type MapTileLayer, type TileIdStr, type TileLocalCoord} from "@/types"
import {breakDownTileId, tileLocalCoordToMercator} from "@/util"

export type FetchTileArgs = {
	tileId: TileIdStr
}

export type FetchTileReturn = {
	layers: Record<string, MapTileLayer>
}

export const fetchTile = async ({tileId}: FetchTileArgs, abortController: AbortController) => {
	const {zoom, x, y} = breakDownTileId(tileId)

	const data = await wretch(`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/${zoom}/${x}/${y}.mvt`)
		.addon(AbortAddon())
		.addon(QueryStringAddon)
		.query({access_token: MAPBOX_ACCESS_TOKEN})
		.signal(abortController)
		.get()
		.arrayBuffer()
		.catch((err) => {
			if (err instanceof DOMException && err.name === `AbortError`) return null
			throw err
		})
	if (!data) return

	const tileData = new VectorTile(new Pbf(data))
	const layers: Record<string, MapTileLayer> = {}
	for (const name in tileData.layers) {
		const layer = tileData.layers[name]!

		let features: MapLayerFeature[] = []
		for (let i = 0; i < layer.length; i++) {
			const feature = layer.feature(i)
			features.push({
				extent: feature.extent,
				type: VectorTileFeature.types[feature.type],
				id: feature.id,
				properties: feature.properties,
				geometry: feature
					.loadGeometry()
					.map((shape) =>
						shape.map((coord) =>
							tileLocalCoordToMercator([coord.x, coord.y] as TileLocalCoord, {zoom, x, y}, feature.extent),
						),
					),
			})
		}

		layers[name] = {
			version: layer.version,
			name: layer.name,
			extent: layer.extent,
			features,
		}
	}

	postMessage({layers})
}
