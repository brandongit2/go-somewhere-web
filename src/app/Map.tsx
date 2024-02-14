import {useQuery} from "@tanstack/react-query"
import {motion, useMotionValue} from "framer-motion"
import Pbf from "pbf"
import {useCallback, useEffect, useMemo} from "react"
import invariant from "tiny-invariant"
import wretch from "wretch"
// eslint-disable-next-line import/no-named-as-default -- `QueryStringAddon` in this import is an interface, not what we want
import QueryStringAddon from "wretch/addons/queryString"

import {MAPBOX_ACCESS_TOKEN} from "@/env"
import {Tile} from "@/mvt/generated"
import {parseLineStringGeometry} from "@/mvt/parse-linestring-geometry"
import {parsePolygonGeometry, type Polygon} from "@/mvt/parse-polygon-geometry"
import {useWebgpu} from "@/WebgpuContext"

const zoom = 6
const tileX = 18
const tileY = 24

export function Map() {
	const {data} = useQuery({
		queryKey: [`vectortile-${zoom}/${tileX}/${tileY}`],
		queryFn: async () =>
			await wretch(`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/${zoom}/${tileX}/${tileY}.mvt`)
				.addon(QueryStringAddon)
				.query({access_token: MAPBOX_ACCESS_TOKEN})
				.get()
				.arrayBuffer(),
	})

	const tile = useMemo(() => {
		if (!data) return
		const pbf = new Pbf(data)
		const tile = Tile.read(pbf)
		return tile
	}, [data])

	const linestrings = useMemo(() => {
		if (!tile) return

		const adminLayer = tile.layers?.find((layer) => layer.name === `admin`)
		if (!adminLayer) return

		let linestrings: {vertices: number[]; indices: number[]}[] = []
		for (const feature of adminLayer.features ?? []) {
			const geometry = feature.geometry
			if (!geometry) continue

			linestrings = linestrings.concat(parseLineStringGeometry(geometry, adminLayer.extent))
		}

		return linestrings
	}, [tile])

	const polygons = useMemo(() => {
		if (!tile) return

		const waterLayer = tile.layers?.find((layer) => layer.name === `water`)
		if (!waterLayer) return

		let polygons: Polygon[] = []
		for (const feature of waterLayer.features ?? []) {
			const geometry = feature.geometry
			if (!geometry) continue

			polygons = parsePolygonGeometry(geometry, waterLayer.extent)
		}

		return polygons
	}, [tile])

	const {device, context, presentationFormat, canvasRef} = useWebgpu()

	// Create the pipeline
	const pipeline = useMemo(() => {
		if (!device || !context || !presentationFormat) return

		const module = device.createShaderModule({
			label: `shaders`,
			code: shaders,
		})
		const pipeline = device.createRenderPipeline({
			label: `pipeline`,
			layout: `auto`,
			vertex: {
				module,
				entryPoint: `vs`,
				buffers: [
					{
						arrayStride: 2 * 4,
						attributes: [{shaderLocation: 0, offset: 0, format: `float32x2` as const}],
					},
				],
			},
			fragment: {
				module,
				entryPoint: `fs`,
				targets: [{format: presentationFormat}],
			},
		})

		return pipeline
	}, [context, device, presentationFormat])

	const render = useCallback(() => {
		if (!device || !context || !pipeline || !polygons || !linestrings) return

		const encoder = device.createCommandEncoder({label: `encoder`})
		const pass = encoder.beginRenderPass({
			label: `render pass`,
			colorAttachments: [
				{
					view: context.getCurrentTexture().createView(),
					clearValue: [0, 1, 0, 1],
					loadOp: `clear` as const,
					storeOp: `store` as const,
				},
			],
		})
		pass.setPipeline(pipeline)

		for (let i = 0; i < polygons.length; i++) {
			const polygon = polygons[i]

			const vertexData = new Float32Array(polygon.vertices)
			const vertexBuffer = device.createBuffer({
				label: `vertex buffer: polygon ${i}`,
				size: vertexData.byteLength,
				usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			})
			device.queue.writeBuffer(vertexBuffer, 0, vertexData)

			const indexData = new Uint32Array(polygon.indices)
			const indexBuffer = device.createBuffer({
				label: `index buffer: polygon ${i}`,
				size: indexData.byteLength,
				usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
			})
			device.queue.writeBuffer(indexBuffer, 0, indexData)

			pass.setVertexBuffer(0, vertexBuffer)
			pass.setIndexBuffer(indexBuffer, `uint32`)
			pass.drawIndexed(polygon.indices.length)
		}

		for (let i = 0; i < linestrings.length; i++) {
			const linestring = linestrings[i]

			const vertexData = new Float32Array(linestring.vertices)
			const vertexBuffer = device.createBuffer({
				label: `vertex buffer: linestring ${i}`,
				size: vertexData.byteLength,
				usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			})
			device.queue.writeBuffer(vertexBuffer, 0, vertexData)

			const indexData = new Uint32Array(linestring.indices)
			const indexBuffer = device.createBuffer({
				label: `index buffer: linestring ${i}`,
				size: indexData.byteLength,
				usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
			})
			device.queue.writeBuffer(indexBuffer, 0, indexData)

			pass.setVertexBuffer(0, vertexBuffer)
			pass.setIndexBuffer(indexBuffer, `uint32`)
			pass.drawIndexed(linestring.indices.length)
		}

		pass.end()

		const commandBuffer = encoder.finish()
		device.queue.submit([commandBuffer])
	}, [context, device, linestrings, pipeline, polygons])

	// Keep canvas size in sync with display size
	useEffect(() => {
		const onResize = () => {
			if (!device) return
			invariant(canvasRef.current)

			const width = canvasRef.current.getBoundingClientRect().width
			const height = canvasRef.current.getBoundingClientRect().height
			canvasRef.current.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D)) * devicePixelRatio
			canvasRef.current.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D)) * devicePixelRatio
			render()
		}

		window.addEventListener(`resize`, onResize)
		onResize()
		return () => window.removeEventListener(`resize`, onResize)
	}, [canvasRef, device, render])

	const x = useMotionValue(0)
	const y = useMotionValue(0)

	return <motion.canvas ref={canvasRef} style={{x, y}} className="absolute left-0 top-0 h-full w-full" />
}
