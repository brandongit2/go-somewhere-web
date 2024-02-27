import {VectorTile, VectorTileFeature} from "@mapbox/vector-tile"
import {throttle} from "lodash"
import pLimit from "p-limit"
import Pbf from "pbf"
import wretch from "wretch"
import AbortAddon from "wretch/addons/abort"
// eslint-disable-next-line import/no-named-as-default -- `QueryStringAddon` in this import is an interface, not what we want
import QueryStringAddon from "wretch/addons/queryString"

import {type MapContext} from "./MapContext"
import {MapTile} from "./MapTile"
import {MAPBOX_ACCESS_TOKEN} from "@/env"
import {type MapLayerFeature, type MapTileLayer, type TileId} from "@/types"
import {tileCoordToMercator} from "@/util"

const fetchLimit = pLimit(20)

export class TileManager {
	private _tilesInView = new Set<TileId>()
	tileCache = new Map<TileId, MapTile>()
	tilesBeingFetched = new Map<TileId, [AbortController, Promise<MapTile | null>]>()
	tilesAborted = new Set<TileId>()

	constructor(private mapContext: MapContext) {}

	get tilesInView() {
		return this._tilesInView
	}

	static tileIdToCoords = (tileId: TileId) =>
		tileId.split(`/`).map((coord) => parseInt(coord)) as [number, number, number]

	fetchTile = async (tileId: TileId): Promise<MapTile | null> => {
		if (this.tileCache.has(tileId)) return this.tileCache.get(tileId)!
		if (this.tilesBeingFetched.has(tileId)) return this.tilesBeingFetched.get(tileId)![1]

		const [zoom, x, y] = TileManager.tileIdToCoords(tileId)
		const controller = new AbortController()

		const fetchPromise = fetchLimit(
			wretch(`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/${zoom}/${x}/${y}.mvt`)
				.addon(AbortAddon())
				.addon(QueryStringAddon)
				.query({access_token: MAPBOX_ACCESS_TOKEN})
				.signal(controller)
				.get().arrayBuffer,
		)
			.then((data) => {
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
								.map((mesh) => mesh.map((geom) => tileCoordToMercator(geom.x, geom.y, {zoom, x, y}, feature.extent))),
						})
					}

					layers[name] = {
						version: layer.version,
						name: layer.name,
						extent: layer.extent,
						features,
					}
				}

				const tile = new MapTile(this.mapContext, this, {x, y, zoom, layers})
				this.tileCache.set(`${zoom}/${x}/${y}`, tile)
				return tile
			})
			.catch((error) => {
				if (error instanceof DOMException && error.name === `AbortError`) return null
				throw error
			})
			.finally(() => {
				this.tilesBeingFetched.delete(tileId)
			})

		this.tilesBeingFetched.set(tileId, [controller, fetchPromise])
		return fetchPromise
	}

	fetchTileFromCache = (tileId: TileId): MapTile | undefined => this.tileCache.get(tileId)

	fetchTiles = (tileIds: TileId[]): Array<Promise<MapTile | null>> => tileIds.map((tileId) => this.fetchTile(tileId))

	private setTilesInViewImpl = (tileIds: TileId[]) => {
		this._tilesInView = new Set(tileIds)

		// Abort fetching tiles that are no longer in view
		for (const [tileId] of this.tilesBeingFetched) {
			if (!tileIds.includes(tileId)) {
				this.tilesBeingFetched.get(tileId)![0].abort()
				this.tilesBeingFetched.delete(tileId)
			}
		}

		this.fetchTiles(tileIds).forEach((tilePromise) => {
			tilePromise.catch(console.error)
		})
	}
	setTilesInView = throttle(this.setTilesInViewImpl, 100)
}
