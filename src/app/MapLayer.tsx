import earcut, {flatten} from "earcut"
import {Fragment} from "react"

import type {MapTileLayer} from "./types"

export type MapLayerProps = {
	layer: MapTileLayer
	color: string
}

export const MapLayer = ({layer, color}: MapLayerProps) => {
	const geometries = layer.features
		.map((feature) => feature.geoJson.geometry)
		.flatMap((geometry) => {
			if (geometry.type === `GeometryCollection`) return geometry.geometries
			else return [geometry]
		})

	return (
		<Fragment key={layer.name}>
			{geometries.map((geometry, i) => {
				switch (geometry.type) {
					case `LineString`: {
						return (
							<mesh key={i}>
								{/* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- Getter/setter for `points` are not compatible */}
								<meshLineGeometry points={geometry.coordinates as any} />
								<meshLineMaterial color={color} lineWidth={0.002} />
							</mesh>
						)
					}
					case `MultiLineString`: {
						return geometry.coordinates.map((geometryCoords, j) => (
							<mesh key={`${i}.${j}`}>
								{/* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- Getter/setter for `points` are not compatible */}
								<meshLineGeometry points={geometryCoords as any} />
								<meshLineMaterial color={color} lineWidth={0.002} />
							</mesh>
						))
					}
					case `Polygon`: {
						const data = flatten(geometry.coordinates)
						const indices = earcut(data.vertices, data.holes, data.dimensions)
						const vertices = data.vertices.flatMap((coord, i) => (i % 2 === 0 ? coord : [coord, 0]))

						return (
							<mesh key={i}>
								<bufferGeometry>
									<bufferAttribute attach="attributes-position" args={[new Float32Array(vertices), 3]} />
									<bufferAttribute attach="index" args={[new Uint16Array(indices), 1]} />
								</bufferGeometry>
								<meshBasicMaterial color={color} />
							</mesh>
						)
					}
					case `MultiPolygon`: {
						return geometry.coordinates.map((geometryCoords, j) => {
							const data = flatten(geometryCoords)
							const indices = earcut(data.vertices, data.holes, data.dimensions)
							const vertices = data.vertices.flatMap((coord, i) => (i % 2 === 0 ? coord : [coord, 0]))

							return (
								<mesh key={`${i}.${j}`}>
									<bufferGeometry>
										<bufferAttribute attach="attributes-position" args={[new Float32Array(vertices), 3]} />
										<bufferAttribute attach="index" args={[new Uint16Array(indices), 1]} />
									</bufferGeometry>
									<meshBasicMaterial color={color} />
								</mesh>
							)
						})
					}
				}
			})}
		</Fragment>
	)
}
