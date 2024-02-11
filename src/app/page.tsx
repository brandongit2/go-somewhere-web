"use client"

import {useQuery} from "@tanstack/react-query"
import earcut from "earcut"
import Pbf from "pbf"
import {useCallback, useEffect, useMemo, useRef, useState} from "react"
import invariant from "tiny-invariant"
import wretch from "wretch"
// eslint-disable-next-line import/no-named-as-default -- `QueryStringAddon` in this import is an interface, not what we want
import QueryStringAddon from "wretch/addons/queryString"

import shaders from "./shaders.wgsl"
import {MAPBOX_ACCESS_TOKEN} from "@/env"
import {useWebgpu} from "@/hooks/useWebgpu"
import {Tile} from "@/mvt"

export default function Root() {
	const {data} = useQuery({
		queryKey: [`map`],
		queryFn: async () =>
			await wretch(`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/0/0/0.mvt`)
				.addon(QueryStringAddon)
				.query({access_token: MAPBOX_ACCESS_TOKEN})
				.get()
				.arrayBuffer(),
	})
	const shapes = useMemo(() => {
		if (!data) return
		const pbf = new Pbf(data)
		const tile = Tile.read(pbf)

		const waterLayer = tile.layers?.find((layer) => layer.name === `water`)
		if (!waterLayer) return

		const shapes: number[][][] = []
		let shapeDraft: number[][] = []
		for (const feature of waterLayer.features ?? []) {
			const geometry = feature.geometry
			if (!geometry) continue

			let integerType: "command" | "parameter" = `command`
			let commandType: number | null = null
			let commandsLeft = 0
			let cursor: [number, number] = [0, 0]
			let geometryDraft: number[] = []
			for (let i = 0; i < geometry.length; i++) {
				const integer = geometry[i]

				switch (integerType) {
					case `command`: {
						commandType = integer & 0x7
						const commandCount = integer >> 3
						commandsLeft = commandCount

						if (commandType === commandTypes.closePath) {
							const area = calculatePolygonArea(geometryDraft)
							if (shapeDraft.length === 0 || area < 0) shapeDraft.push(geometryDraft)
							else {
								shapes.push(shapeDraft)
								shapeDraft = [geometryDraft]
							}
							geometryDraft = []
						} else integerType = `parameter`

						break
					}
					case `parameter`: {
						switch (commandType) {
							case commandTypes.moveTo: {
								const x = cursor[0] + decodeParameterInteger(integer)
								const y = cursor[1] + decodeParameterInteger(geometry[i + 1])
								geometryDraft.push(x / waterLayer.extent, y / waterLayer.extent)
								cursor = [x, y]
								i++
								break
							}
							case commandTypes.lineTo: {
								const x = cursor[0] + decodeParameterInteger(integer)
								const y = cursor[1] + decodeParameterInteger(geometry[i + 1])
								geometryDraft.push(x / waterLayer.extent, y / waterLayer.extent)
								cursor = [x, y]
								i++
								break
							}
						}

						commandsLeft--
					}
				}

				if (commandsLeft === 0) integerType = `command`
			}
		}

		return shapes
	}, [data])

	const canvasRef = useRef<HTMLCanvasElement>(null)
	const {device, context, presentationFormat} = useWebgpu(canvasRef)

	// Create the pipeline
	const [pipeline, setPipeline] = useState<GPURenderPipeline>()
	useEffect(() => {
		if (!device || !context || !presentationFormat) return
		const module = device.createShaderModule({
			label: `rgb triangle shaders`,
			code: shaders,
		})
		const pipeline = device.createRenderPipeline({
			label: `rgb triangle pipeline`,
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
		setPipeline(pipeline)
	}, [context, device, presentationFormat])

	const render = useCallback(() => {
		if (!device || !context || !pipeline || !canvasRef.current || !shapes) return

		const encoder = device.createCommandEncoder({label: `encoder`})
		const pass = encoder.beginRenderPass({
			label: `render pass`,
			colorAttachments: [
				{
					view: context.getCurrentTexture().createView(),
					clearValue: [0.3, 0.3, 0.3, 1],
					loadOp: `clear` as const,
					storeOp: `store` as const,
				},
			],
		})
		pass.setPipeline(pipeline)

		const aspect = canvasRef.current.width / canvasRef.current.height

		let shapesWithHoles = shapes.map((shape) => {
			let geometries = shape.flat()
			if (shape.length === 1) return {geometries, holeIndices: undefined}

			let holeIndices: number[] = []
			let i = 0
			for (const geometry of shape.slice(0, -1)) {
				i += geometry.length / 2
				holeIndices.push(i)
			}

			return {geometries, holeIndices}
		})

		for (let i = 0; i < shapesWithHoles.length; i++) {
			const vertices = shapesWithHoles[i].geometries.map((coord, i) => (i % 2 === 0 ? coord / aspect : 1 - coord))
			const indices = earcut(shapesWithHoles[i].geometries, shapesWithHoles[i].holeIndices)

			const vertexData = new Float32Array(vertices)
			const vertexBuffer = device.createBuffer({
				label: `vertex buffer: shape ${i}`,
				size: vertexData.byteLength,
				usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			})
			device.queue.writeBuffer(vertexBuffer, 0, vertexData)

			const indexData = new Uint32Array(indices)
			const indexBuffer = device.createBuffer({
				label: `index buffer: shape ${i}`,
				size: indexData.byteLength,
				usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
			})
			device.queue.writeBuffer(indexBuffer, 0, indexData)

			pass.setVertexBuffer(0, vertexBuffer)
			pass.setIndexBuffer(indexBuffer, `uint32`)
			pass.drawIndexed(indices.length)
		}
		pass.end()

		const commandBuffer = encoder.finish()
		device.queue.submit([commandBuffer])
	}, [context, device, pipeline, shapes])

	// Keep canvas size in sync with the display size
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
	}, [device, render])

	return <canvas ref={canvasRef} className="absolute left-0 top-0 h-full w-full" />
}

const commandTypes = {
	moveTo: 1,
	lineTo: 2,
	closePath: 7,
}

const decodeParameterInteger = (integer: number) => (integer >> 1) ^ -(integer & 1)

const calculatePolygonArea = (vertices: number[]) => {
	let area = 0
	const n = vertices.length / 2

	for (let i = 0; i < n; i++) {
		const j = (i + 1) % n // Next vertex index, wrapping around to 0 at the end

		const xi = vertices[i * 2]
		const yi = vertices[i * 2 + 1]
		const xj = vertices[j * 2]
		const yj = vertices[j * 2 + 1]

		area += xi * yj - xj * yi
	}

	return area / 2
}
