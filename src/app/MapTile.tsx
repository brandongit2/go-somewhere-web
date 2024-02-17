import {VectorTile, VectorTileFeature} from "@mapbox/vector-tile"
import {useSuspenseQuery} from "@tanstack/react-query"
import Pbf from "pbf"
import {useMemo} from "react"
import wretch from "wretch"
// eslint-disable-next-line import/no-named-as-default -- `QueryStringAddon` in this import is an interface, not what we want
import QueryStringAddon from "wretch/addons/queryString"

import type {MapLayerFeature, MapTileLayer} from "./types"

import {MapLayer} from "./MapLayer"
import {MAPBOX_ACCESS_TOKEN} from "@/env"

export type MapTileProps = {
	x: number
	y: number
	zoom: number
}

export const MapTile = ({x, y, zoom}: MapTileProps) => {
	const {data} = useSuspenseQuery({
		queryKey: [`vectortile-${zoom}/${x}/${y}`],
		queryFn: async () =>
			await wretch(`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/${Math.round(zoom)}/${x}/${y}.mvt`)
				.addon(QueryStringAddon)
				.query({access_token: MAPBOX_ACCESS_TOKEN})
				.get()
				.arrayBuffer(),
		staleTime: Infinity,
	})

	const layers = useMemo(() => {
		const tile = new VectorTile(new Pbf(data))
		const layers: Record<string, MapTileLayer> = {}
		for (const name in tile.layers) {
			const layer = tile.layers[name]!

			let features: MapLayerFeature[] = []
			for (let i = 0; i < layer.length; i++) {
				const feature = layer.feature(i)
				features.push({
					extent: feature.extent,
					type: VectorTileFeature.types[feature.type],
					id: feature.id,
					properties: feature.properties,
					geoJson: feature.toGeoJSON(x, y, zoom),
				})
			}

			layers[name] = {
				version: layer.version,
				name: layer.name,
				extent: layer.extent,
				features,
			}
		}
		return layers
	}, [data, x, y, zoom])

	return (
		<>
			{layers.water && <MapLayer layer={layers.water} color="blue" />}
			{layers.waterway && <MapLayer layer={layers.waterway} color="blue" />}
			{layers.admin && <MapLayer layer={layers.admin} color="black" />}
			{layers.building && <MapLayer layer={layers.building} color="orange" />}
			{layers.structure && <MapLayer layer={layers.structure} color="orange" />}
			{layers.road && <MapLayer layer={layers.road} color="gray" />}
			{layers.motorway_junction && <MapLayer layer={layers.motorway_junction} color="gray" />}
			{layers.aeroway && <MapLayer layer={layers.aeroway} color="gray" />}
		</>
	)
}
