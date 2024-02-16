"use client"

import {VectorTile} from "@mapbox/vector-tile"
import {OrthographicCamera} from "@react-three/drei"
import {Canvas, extend, type BufferGeometryNode, type MaterialNode} from "@react-three/fiber"
import {useSuspenseQuery} from "@tanstack/react-query"
import {motion, useMotionValue} from "framer-motion"
import {MeshLineGeometry, MeshLineMaterial} from "meshline"
import Pbf from "pbf"
import {useMemo} from "react"
import wretch from "wretch"
// eslint-disable-next-line import/no-named-as-default -- `QueryStringAddon` in this import is an interface, not what we want
import QueryStringAddon from "wretch/addons/queryString"

import {WaterLayer} from "./WaterLayer"
import {MAPBOX_ACCESS_TOKEN} from "@/env"

extend({MeshLineGeometry, MeshLineMaterial})

const zoom = 0
const tileX = 0
const tileY = 0

const MotionCanvas = motion(Canvas)

export function Map() {
	const {data} = useSuspenseQuery({
		queryKey: [`vectortile-${zoom}/${tileX}/${tileY}`],
		queryFn: async () =>
			await wretch(`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/${zoom}/${tileX}/${tileY}.mvt`)
				.addon(QueryStringAddon)
				.query({access_token: MAPBOX_ACCESS_TOKEN})
				.get()
				.arrayBuffer(),
	})

	const layers = useMemo(() => {
		const tile = new VectorTile(new Pbf(data))
		return tile.layers
	}, [data])

	const x = useMotionValue(0)
	const y = useMotionValue(0)

	return (
		<MotionCanvas style={{x, y}}>
			<WaterLayer layer={layers.water} />

			<OrthographicCamera makeDefault manual left={-100} right={100} top={100} bottom={-100} position={[0, 0, 5]} />
		</MotionCanvas>
	)
}

declare module "@react-three/fiber" {
	// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
	interface ThreeElements {
		meshLineGeometry: BufferGeometryNode<MeshLineGeometry, typeof MeshLineGeometry>
		meshLineMaterial: MaterialNode<MeshLineMaterial, typeof MeshLineMaterial>
	}
}
