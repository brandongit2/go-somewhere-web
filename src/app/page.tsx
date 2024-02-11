"use client"

import {useQuery} from "@tanstack/react-query"
import Pbf from "pbf"
import {useCallback, useEffect, useRef, useState} from "react"
import invariant from "tiny-invariant"
import wretch from "wretch"
// eslint-disable-next-line import/no-named-as-default -- `QueryStringAddon` in this import is an interface, not what we want
import QueryStringAddon from "wretch/addons/queryString"

import shaders from "./shaders.wgsl"
import {MAPBOX_ACCESS_TOKEN} from "@/env"
import {useWebgpu} from "@/hooks/useWebgpu"
import {Tile} from "@/mvt"

export default function Root() {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const {device, context, presentationFormat} = useWebgpu(canvasRef)

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
		if (!device || !context || !pipeline || !canvasRef.current) return

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

		const numObjects = 100
		const colorSize = 4
		const scaleSize = 2
		const translateSize = 2
		const colorOffset = 0
		const scaleOffset = colorOffset + colorSize
		const translateOffset = scaleOffset + scaleSize
		const variantSize = colorSize + scaleSize + translateSize
		const variantsBufferSize = variantSize * numObjects

		const variantsBufferValues = new Float32Array(variantsBufferSize)
		const variantsBuffer = device.createBuffer({
			label: `variants buffer`,
			size: variantsBufferSize * 4,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		})
		for (let i = 0; i < numObjects; i++) {
			const scale = rand(0.2, 0.5)
			variantsBufferValues.set([rand(0, 1), rand(0, 1), rand(0, 1), 1], i * variantSize + colorOffset)
			variantsBufferValues.set([scale / aspect, scale], i * variantSize + scaleOffset)
			variantsBufferValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], i * variantSize + translateOffset)
		}
		device.queue.writeBuffer(variantsBuffer, 0, variantsBufferValues)

		const {vertexData, numVertices} = createCircleVertices({
			radius: 0.5,
			innerRadius: 0.25,
		})
		const vertexBuffer = device.createBuffer({
			label: `vertex buffer`,
			size: numVertices * 2 * 4,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(vertexBuffer, 0, vertexData)

		const bindGroup = device.createBindGroup({
			label: `bind group`,
			layout: pipeline.getBindGroupLayout(0),
			entries: [
				{binding: 0, resource: {buffer: variantsBuffer}},
				{binding: 1, resource: {buffer: vertexBuffer}},
			],
		})
		pass.setBindGroup(0, bindGroup)
		pass.draw(numVertices, numObjects)
		pass.end()

		const commandBuffer = encoder.finish()
		device.queue.submit([commandBuffer])
	}, [context, device, pipeline])

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

	const {data} = useQuery({
		queryKey: [`map`],
		queryFn: async () =>
			await wretch(`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/1/0/0.mvt`)
				.addon(QueryStringAddon)
				.query({access_token: MAPBOX_ACCESS_TOKEN})
				.get()
				.arrayBuffer(),
	})
	const pbf = new Pbf(data)
	console.log(Tile.read(pbf))

	return <canvas ref={canvasRef} className="absolute left-0 top-0 h-full w-full" />
}

const rand = (min: number, max: number) => min + Math.random() * (max - min)

const createCircleVertices = ({
	radius = 1,
	numSubdivisions = 24,
	innerRadius = 0,
	startAngle = 0,
	endAngle = Math.PI * 2,
} = {}) => {
	// 2 triangles per subdivision, 3 verts per tri, 2 values (xy) each.
	const numVertices = numSubdivisions * 3 * 2
	const vertexData = new Float32Array(numSubdivisions * 2 * 3 * 2)

	let offset = 0
	const addVertex = (x: number, y: number) => {
		vertexData[offset++] = x
		vertexData[offset++] = y
	}

	// 2 triangles per subdivision
	//
	// 0--1 4
	// | / /|
	// |/ / |
	// 2 3--5
	for (let i = 0; i < numSubdivisions; ++i) {
		const angle1 = startAngle + ((i + 0) * (endAngle - startAngle)) / numSubdivisions
		const angle2 = startAngle + ((i + 1) * (endAngle - startAngle)) / numSubdivisions

		const c1 = Math.cos(angle1)
		const s1 = Math.sin(angle1)
		const c2 = Math.cos(angle2)
		const s2 = Math.sin(angle2)

		// first triangle
		addVertex(c1 * radius, s1 * radius)
		addVertex(c2 * radius, s2 * radius)
		addVertex(c1 * innerRadius, s1 * innerRadius)

		// second triangle
		addVertex(c1 * innerRadius, s1 * innerRadius)
		addVertex(c2 * radius, s2 * radius)
		addVertex(c2 * innerRadius, s2 * innerRadius)
	}

	return {
		vertexData,
		numVertices,
	}
}
