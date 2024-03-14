import earcut from "earcut"

import {type Feature} from "./Feature"
import shader from "./surface-polygon.wgsl"
import {FOUR_BYTES_PER_FLOAT, FOUR_BYTES_PER_INT32, THREE_NUMBERS_PER_3D_COORD} from "@/const"
import {type MapContext} from "@/map/MapContext"
import {type Coord3d, type MercatorCoord} from "@/types"
import {groupByTwos, mercatorToWorld} from "@/util"

type SurfacePolygonArgs = {
	polygons: MercatorCoord[][]
	color: Coord3d
}

export class SurfacePolygon implements Feature {
	vertexBuffer: GPUBuffer
	indexBuffer: GPUBuffer
	colorBuffer: GPUBuffer
	bindGroup: GPUBindGroup
	renderPipeline: GPURenderPipeline

	constructor(
		private mapContext: MapContext,
		args: SurfacePolygonArgs,
	) {
		const {device, viewMatrixBuffer} = mapContext

		this.vertexBuffer = null!
		this.indexBuffer = null!
		this.colorBuffer = null!
		this.set(args) // Above lines are to appease TypeScript; this line is the real initialization

		const bindGroupLayout = device.createBindGroupLayout({
			label: `surface polygon bind group layout`,
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX,
					buffer: {type: `uniform`},
				},
				{
					binding: 1,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {type: `uniform`},
				},
			],
		})

		const pipelineLayout = device.createPipelineLayout({
			label: `surface polygon pipeline layout`,
			bindGroupLayouts: [bindGroupLayout],
		})

		const bindGroup = device.createBindGroup({
			label: `surface polygon bind group`,
			layout: bindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {buffer: viewMatrixBuffer},
				},
				{
					binding: 1,
					resource: {buffer: this.colorBuffer},
				},
			],
		})

		const renderPipeline = device.createRenderPipeline({
			label: `surface polygon render pipeline`,
			layout: pipelineLayout,
			vertex: {
				module: device.createShaderModule({
					label: `surface polygon vertex shader`,
					code: shader,
				}),
				entryPoint: `vs`,
				buffers: [
					{
						arrayStride: THREE_NUMBERS_PER_3D_COORD * FOUR_BYTES_PER_FLOAT,
						attributes: [{shaderLocation: 0, offset: 0, format: `float32x3`}],
					},
				],
			},
			fragment: {
				module: device.createShaderModule({
					label: `surface polygon fragment shader`,
					code: shader,
				}),
				entryPoint: `fs`,
				targets: [{format: mapContext.presentationFormat}],
			},
			primitive: {
				cullMode: `back`,
			},
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: `greater`,
				format: `depth24plus`,
			},
		})

		this.bindGroup = bindGroup
		this.renderPipeline = renderPipeline
	}

	draw = (pass: GPURenderPassEncoder) => {
		pass.setPipeline(this.renderPipeline)
		pass.setBindGroup(0, this.bindGroup)

		pass.setVertexBuffer(0, this.vertexBuffer)
		pass.setIndexBuffer(this.indexBuffer, `uint32`)
		pass.drawIndexed(this.indexBuffer.size / FOUR_BYTES_PER_INT32)
	}

	set = (args: SurfacePolygonArgs) => {
		;(this.vertexBuffer as typeof this.vertexBuffer | undefined)?.destroy()
		;(this.indexBuffer as typeof this.indexBuffer | undefined)?.destroy()
		;(this.colorBuffer as typeof this.colorBuffer | undefined)?.destroy()

		const geometries2d = {
			vertices: [] as MercatorCoord[],
			indices: [] as number[],
		}

		const featurePolygons = classifyRings(args.polygons)
		for (let polygon of featurePolygons) {
			const vertices = polygon.flat().flat()
			let i = 0
			const holeIndices = polygon
				.map((ring) => {
					const holeIndex = i
					i += ring.length
					return holeIndex
				})
				.slice(1)

			let indices = earcut(vertices, holeIndices)

			// In transforming from Mercator coord to world space, the vertical axis is flipped. So that this doesn't mess
			// with the winding order, we reverse the order of every triangle's vertices.
			for (let i = 0; i < indices.length; i += 3) {
				;[indices[i], indices[i + 2]] = [indices[i + 2]!, indices[i]!]
			}

			geometries2d.indices.push(...indices.map((index) => index + geometries2d.vertices.length))
			geometries2d.vertices.push(...(groupByTwos(vertices) as MercatorCoord[]))
		}

		const geometries3d = {
			vertices: geometries2d.vertices.map((v) => mercatorToWorld(v)),
			indices: geometries2d.indices,
		}

		const {device} = this.mapContext

		this.vertexBuffer = device.createBuffer({
			label: `surface polygon vertex buffer`,
			size: geometries3d.vertices.length * THREE_NUMBERS_PER_3D_COORD * FOUR_BYTES_PER_FLOAT,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.vertexBuffer, 0, new Float32Array(geometries3d.vertices.flatMap((v) => v)))

		this.indexBuffer = device.createBuffer({
			label: `surface polygon index buffer`,
			size: geometries3d.indices.length * FOUR_BYTES_PER_INT32,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.indexBuffer, 0, new Uint32Array(geometries3d.indices))

		this.colorBuffer = device.createBuffer({
			label: `surface polygon colour buffer`,
			size: 3 * FOUR_BYTES_PER_FLOAT,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.colorBuffer, 0, new Float32Array(args.color))
	}
}

const classifyRings = (rings: MercatorCoord[][]) => {
	if (rings.length <= 1) return [rings]

	let polygons: MercatorCoord[][][] = []
	let polygon: MercatorCoord[][] = []

	for (const ring of rings) {
		let area = signedArea(ring)

		if (area === 0) continue
		if (area > 0) {
			if (polygon.length > 0) polygons.push(polygon)
			polygon = [ring]
		} else {
			polygon.push(ring)
		}
	}
	if (polygons.at(-1)! !== polygon) polygons.push(polygon)

	return polygons
}

const signedArea = (ring: MercatorCoord[]) => {
	let area = 0
	for (let i = 0; i < ring.length; i++) {
		const [x1, y1] = ring[i]!
		const [x2, y2] = ring[(i + 1) % ring.length]!

		area += x1 * y2 - x2 * y1
	}

	return area / 2
}
