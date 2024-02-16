import {VectorTileFeature} from "@mapbox/vector-tile"
import earcut, {flatten} from "earcut"
import {Fragment} from "react"

import type {VectorTileLayer} from "@mapbox/vector-tile"
import type {Feature} from "geojson"

type MapLayerFeature = {
	extent: number
	type: (typeof VectorTileFeature.types)[number]
	id: number
	properties: Record<string, string | number | boolean>
	geoJson: Feature
}

export type WaterLayerProps = {
	layer: VectorTileLayer
}

export function WaterLayer({layer}: WaterLayerProps) {
	let features: MapLayerFeature[] = []
	for (let i = 0; i < layer.length; i++) {
		const feature = layer.feature(i)
		features.push({
			extent: feature.extent,
			type: VectorTileFeature.types[feature.type],
			id: feature.id,
			properties: feature.properties,
			geoJson: feature.toGeoJSON(0, 0, 0),
		})
	}

	const _geometries = features.map((feature) => feature.geoJson.geometry)
	const geometries = []
	for (const geometry of _geometries) {
		if (geometry.type === `GeometryCollection`) geometries.push(...geometry.geometries)
		else geometries.push(geometry)
	}

	return (
		<Fragment key={JSON.stringify(features)}>
			{geometries.map((geometry, i) => {
				switch (geometry.type) {
					case `LineString`: {
						return (
							<mesh key={i}>
								{/* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- Getter/setter for `points` are not compatible */}
								<meshLineGeometry points={geometry.coordinates as any} />
								<meshLineMaterial color="blue" />
							</mesh>
						)
					}
					case `MultiLineString`: {
						return geometry.coordinates.map((geometryCoords) => (
							<mesh key={i}>
								{/* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- Getter/setter for `points` are not compatible */}
								<meshLineGeometry points={geometryCoords as any} />
								<meshLineMaterial color="blue" />
							</mesh>
						))
					}
					case `Polygon`: {
						const data = flatten(geometry.coordinates)
						const indices = earcut(data.vertices, data.holes, data.dimensions)
						const vertices = data.vertices

						return (
							<mesh key={i}>
								<bufferGeometry>
									<bufferAttribute attach="attributes-position" args={[new Float32Array(vertices), 2]} />
									<bufferAttribute attach="index" args={[new Uint16Array(indices), 1]} />
								</bufferGeometry>
								<meshBasicMaterial color="blue" />
							</mesh>
						)
					}
					case `MultiPolygon`: {
						return geometry.coordinates.map((geometryCoords, i) => {
							const data = flatten(geometryCoords)
							const indices = earcut(data.vertices, data.holes, data.dimensions)
							const vertices = data.vertices.flatMap((coord, i) => (i % 2 === 0 ? coord : [coord, 0]))

							return (
								<mesh key={i}>
									<bufferGeometry>
										<bufferAttribute attach="attributes-position" args={[new Float32Array(vertices), 3]} />
										<bufferAttribute attach="index" args={[new Uint16Array(indices), 1]} />
									</bufferGeometry>
									<meshBasicMaterial color="blue" />
								</mesh>
							)
						})
					}
				}
			})}
		</Fragment>
	)
}
