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
	lng: number
	lat: number
	zoom: number
}

export const MapTile = ({lng, lat, zoom}: MapTileProps) => {
	const {data} = useSuspenseQuery({
		queryKey: [`vectortile-${zoom}/${lng}/${lat}`],
		queryFn: async () =>
			await wretch(`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/${Math.round(zoom)}/${lng}/${lat}.mvt`)
				.addon(QueryStringAddon)
				.query({access_token: MAPBOX_ACCESS_TOKEN})
				.get()
				.arrayBuffer(),
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
					geoJson: feature.toGeoJSON(lng, lat, zoom),
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
	}, [data, lng, lat, zoom])
	// console.log(layers)

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
			<line>
				<bufferGeometry>
					<bufferAttribute
						attach="attributes-position"
						args={[
							new Float32Array([
								lng,
								lat,
								0,
								lng + 360 / 2 ** zoom,
								lat,
								0,
								lng + 360 / 2 ** zoom,
								lat + 360 / 2 ** zoom,
								0,
								lng,
								lat + 360 / 2 ** zoom,
								0,
								lng,
								lat,
								0,
							]),
							3,
						]}
					/>
				</bufferGeometry>
				<lineBasicMaterial color="red" />
			</line>
		</>
	)
}
