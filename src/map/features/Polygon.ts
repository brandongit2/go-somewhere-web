import {type Feature} from "./Feature"
import shader from "./polygon.wgsl"
import {FOUR_BYTES_PER_FLOAT32, FOUR_BYTES_PER_INT32, THREE_NUMBERS_PER_3D_COORD, TWO_BYTES_PER_INT16} from "@/const"
import {type MapContext} from "@/map/MapContext"
import {type Coord3d} from "@/types"

type PolygonArgs = {
	indices: number[]
	vertices: number[]
	color: Coord3d
}

export class Polygon implements Feature {
	vertexBuffer: GPUBuffer
	indexBuffer: GPUBuffer
	colorBuffer: GPUBuffer
	bindGroup: GPUBindGroup
	renderPipeline: GPURenderPipeline

	constructor(
		private mapContext: MapContext,
		args: PolygonArgs,
	) {
		const {device, viewMatrixBuffer} = mapContext

		this.colorBuffer = device.createBuffer({
			label: `polygon colour buffer`,
			size: 3 * FOUR_BYTES_PER_FLOAT32,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		})

		this.vertexBuffer = null!
		this.indexBuffer = null!
		this.set(args) // Above lines are to appease TypeScript; this line is the real initialization

		const bindGroupLayout = device.createBindGroupLayout({
			label: `polygon bind group layout`,
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
			label: `polygon pipeline layout`,
			bindGroupLayouts: [bindGroupLayout],
		})

		const bindGroup = device.createBindGroup({
			label: `polygon bind group`,
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
			label: `polygon render pipeline`,
			layout: pipelineLayout,
			vertex: {
				module: device.createShaderModule({
					label: `polygon vertex shader`,
					code: shader,
				}),
				entryPoint: `vs`,
				buffers: [
					{
						arrayStride: THREE_NUMBERS_PER_3D_COORD * FOUR_BYTES_PER_FLOAT32,
						attributes: [{shaderLocation: 0, offset: 0, format: `float32x3`}],
					},
				],
			},
			fragment: {
				module: device.createShaderModule({
					label: `polygon fragment shader`,
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
		pass.setIndexBuffer(this.indexBuffer, `uint16`)
		pass.drawIndexed(this.indexBuffer.size / FOUR_BYTES_PER_INT32)
	}

	set = (args: PolygonArgs) => {
		;(this.vertexBuffer as typeof this.vertexBuffer | undefined)?.destroy()
		;(this.indexBuffer as typeof this.indexBuffer | undefined)?.destroy()

		const {device} = this.mapContext

		this.vertexBuffer = device.createBuffer({
			label: `polygon vertex buffer`,
			size: args.vertices.length * THREE_NUMBERS_PER_3D_COORD * FOUR_BYTES_PER_FLOAT32,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.vertexBuffer, 0, new Float32Array(args.vertices))

		this.indexBuffer = device.createBuffer({
			label: `polygon index buffer`,
			size: args.indices.length * TWO_BYTES_PER_INT16,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.indexBuffer, 0, new Uint16Array(args.indices))

		device.queue.writeBuffer(this.colorBuffer, 0, new Float32Array(args.color))
	}
}
