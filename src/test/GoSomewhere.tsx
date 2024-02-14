import {useSuspenseQuery} from "@tanstack/react-query"
import Pbf from "pbf"
import {useMemo, type ReactNode} from "react"
import wretch from "wretch"
// eslint-disable-next-line import/no-named-as-default -- `QueryStringAddon` in this import is an interface, not what we want
import QueryStringAddon from "wretch/addons/queryString"

import {MapCanvas} from "./MapCanvas"
import {MAPBOX_ACCESS_TOKEN} from "@/env"
import {Tile} from "@/mvt/generated"

const zoom = 6
const tileX = 18
const tileY = 24

export function GoSomewhere() {
	const {data} = useSuspenseQuery({
		queryKey: [`vectortile-${zoom}/${tileX}/${tileY}`],
		queryFn: async () =>
			await wretch(`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/${zoom}/${tileX}/${tileY}.mvt`)
				.addon(QueryStringAddon)
				.query({access_token: MAPBOX_ACCESS_TOKEN})
				.get()
				.arrayBuffer(),
	})

	const tile = useMemo(() => {
		const pbf = new Pbf(data)
		const tile = Tile.read(pbf)
		return tile
	}, [data])

	return (
		<MapCanvas>
			{tile.layers!.map((layer, i) => (
				<layer key={i}></layer>
			))}
		</MapCanvas>
	)
}

declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace JSX {
		// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
		interface IntrinsicElements {
			layer: {key: string | number; children?: ReactNode}
		}
	}
}
