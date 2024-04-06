import shader from "./native-line.wgsl"
import {FOUR_BYTES_PER_FLOAT32, FOUR_BYTES_PER_INT32, THREE_NUMBERS_PER_3D_COORD} from "@/const"
import {type MapRoot} from "@/map/MapRoot"
import {type Coord3d, type MapObject, type WorldCoord} from "@/types"

export type NativeLineArgs = {
	indices: number[][]
	vertices: WorldCoord[]
	color: Coord3d
}

export class NativeLine implements MapObject {
	bindGroup: GPUBindGroup
	renderPipeline: GPURenderPipeline
	indexBuffer: GPUBuffer | undefined
	numIndices = 0
	vertexBuffer: GPUBuffer | undefined
	numVertices = 0
	colorBuffer: GPUBuffer

	constructor(
		private map: MapRoot,
		args: NativeLineArgs,
	) {
		const {
			camera,
			canvas: {device, presentationFormat},
		} = map

		this.colorBuffer = device.createBuffer({
			label: `line colour buffer`,
			size: 3 * FOUR_BYTES_PER_FLOAT32,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		})

		this.set(args)

		const bindGroupLayout = device.createBindGroupLayout({
			label: `native line bind group layout`,
			entries: [
				{
					// `projectionMatrix`
					binding: 0,
					visibility: GPUShaderStage.VERTEX,
					buffer: {type: `uniform`},
				},
				{
					// `viewMatrix`
					binding: 1,
					visibility: GPUShaderStage.VERTEX,
					buffer: {type: `uniform`},
				},
				{
					// `color`
					binding: 2,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {type: `uniform`},
				},
			],
		})

		const pipelineLayout = device.createPipelineLayout({
			label: `native line pipeline layout`,
			bindGroupLayouts: [bindGroupLayout],
		})

		const bindGroup = device.createBindGroup({
			label: `native line bind group`,
			layout: bindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {buffer: camera.projectionMatrixBuffer},
				},
				{
					binding: 1,
					resource: {buffer: camera.viewMatrixBuffer},
				},
				{
					binding: 2,
					resource: {buffer: this.colorBuffer},
				},
			],
		})

		const renderPipeline = device.createRenderPipeline({
			label: `native line render pipeline`,
			layout: pipelineLayout,
			vertex: {
				module: device.createShaderModule({
					label: `native line vertex shader`,
					code: shader,
				}),
				entryPoint: `vs`,
				buffers: [
					{
						// `vertex`
						arrayStride: THREE_NUMBERS_PER_3D_COORD * FOUR_BYTES_PER_FLOAT32,
						attributes: [{shaderLocation: 0, offset: 0, format: `float32x3`}],
					},
				],
			},
			fragment: {
				module: device.createShaderModule({
					label: `native line fragment shader`,
					code: shader,
				}),
				entryPoint: `fs`,
				targets: [{format: presentationFormat}],
			},
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: `greater`,
				format: `depth24plus`,
			},
			primitive: {
				topology: `line-strip`,
				stripIndexFormat: `uint32`,
			},
		})

		this.bindGroup = bindGroup
		this.renderPipeline = renderPipeline
	}

	draw = (pass: GPURenderPassEncoder) => {
		if (!this.indexBuffer || !this.vertexBuffer) return

		pass.setPipeline(this.renderPipeline)
		pass.setBindGroup(0, this.bindGroup)

		pass.setIndexBuffer(this.indexBuffer, `uint32`)
		pass.setVertexBuffer(0, this.vertexBuffer)
		pass.drawIndexed(this.numIndices)
	}

	set = (args: NativeLineArgs) => {
		const {device} = this.map.canvas

		const indices: number[] = []
		for (let i = 0; i < args.indices.length; i++) {
			const line = args.indices[i]!
			if (i > 0) indices.push(0, 0, 0, 0)
			indices.push(...line)
		}

		const oldVertexBuffer = this.vertexBuffer
		if (!this.vertexBuffer || this.vertexBuffer.size < this.numVertices * FOUR_BYTES_PER_FLOAT32) {
			this.vertexBuffer = device.createBuffer({
				label: `native line vertex buffer`,
				size: args.vertices.length * THREE_NUMBERS_PER_3D_COORD * FOUR_BYTES_PER_FLOAT32,
				usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			})
			oldVertexBuffer?.destroy()
		}
		device.queue.writeBuffer(this.vertexBuffer, 0, new Float32Array(args.vertices.flat()))

		const oldIndexBuffer = this.indexBuffer
		if (!this.indexBuffer || this.indexBuffer.size < this.numVertices * FOUR_BYTES_PER_FLOAT32) {
			this.vertexBuffer = device.createBuffer({
				label: `native line index buffer`,
				size: indices.length * FOUR_BYTES_PER_INT32,
				usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
			})
			oldIndexBuffer?.destroy()
		}
		device.queue.writeBuffer(this.vertexBuffer, 0, new Int32Array(indices))
	}
}
