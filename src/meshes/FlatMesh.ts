import vertShader from "./flat-mesh.vert.wgsl"
import {type Mesh} from "./Mesh"
import {FOUR_BYTES_PER_FLOAT, FOUR_BYTES_PER_INT32, SIXTEEN_NUMBERS_PER_MAT4, THREE_NUMBERS_PER_3D_COORD} from "@/const"
import {type MapContext} from "@/map/MapContext"
import {type Material} from "@/materials/Material"
import {Mat4} from "@/math/Mat4"
import {type Coord3d, type WorldCoord} from "@/types"

type FlatMeshArgs = {
	vertices: WorldCoord[]
	indices: number[]
	pos?: Coord3d
}

export class FlatMesh implements Mesh {
	renderPipeline: GPURenderPipeline
	bindGroup: GPUBindGroup
	modelMatrixBuffer: GPUBuffer
	vertexBuffer: GPUBuffer
	indexBuffer: GPUBuffer

	constructor(
		private mapContext: MapContext,
		args: FlatMeshArgs,
		public material: Material,
	) {
		const {device, presentationFormat} = mapContext

		this.modelMatrixBuffer = null!
		this.vertexBuffer = null!
		this.indexBuffer = null!
		this.set(args) // Above lines are to appease TypeScript; this line is the real initialization

		const bindGroupLayout = device.createBindGroupLayout({
			label: `flat mesh bind group layout`,
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX,
					buffer: {type: `uniform`},
				},
				{
					binding: 1,
					visibility: GPUShaderStage.VERTEX,
					buffer: {type: `uniform`},
				},
			],
		})

		const layout = device.createPipelineLayout({
			label: `flat mesh pipeline layout`,
			bindGroupLayouts: [bindGroupLayout, material.bindGroupLayout],
		})

		this.bindGroup = device.createBindGroup({
			label: `flat mesh bind group`,
			layout: bindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {buffer: this.mapContext.viewMatrixBuffer},
				},
				{
					binding: 1,
					resource: {buffer: this.modelMatrixBuffer},
				},
			],
		})

		const vertShaderModule = device.createShaderModule({
			label: `flat mesh vertex shader`,
			code: vertShader,
		})

		this.renderPipeline = device.createRenderPipeline({
			label: `flat mesh render pipeline`,
			layout,
			vertex: {
				module: vertShaderModule,
				entryPoint: `main`,
				buffers: [
					{
						arrayStride: THREE_NUMBERS_PER_3D_COORD * FOUR_BYTES_PER_FLOAT,
						attributes: [{shaderLocation: 0, offset: 0, format: `float32x3`}],
					},
				],
			},
			fragment: {
				module: material.fragShaderModule,
				entryPoint: `main`,
				targets: [{format: presentationFormat}],
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
	}

	draw = (pass: GPURenderPassEncoder) => {
		pass.setPipeline(this.renderPipeline)
		pass.setBindGroup(0, this.bindGroup)
		pass.setBindGroup(1, this.material.bindGroup)

		pass.setVertexBuffer(0, this.vertexBuffer)
		pass.setIndexBuffer(this.indexBuffer, `uint32`)
		pass.drawIndexed(this.indexBuffer.size / FOUR_BYTES_PER_INT32)
	}

	set = (args: FlatMeshArgs) => {
		;(this.modelMatrixBuffer as typeof this.modelMatrixBuffer | undefined)?.destroy()
		;(this.vertexBuffer as typeof this.vertexBuffer | undefined)?.destroy()
		;(this.indexBuffer as typeof this.indexBuffer | undefined)?.destroy()

		const {device} = this.mapContext

		const pos = args.pos ?? ([0, 0, 0] as Coord3d)
		this.modelMatrixBuffer = device.createBuffer({
			size: SIXTEEN_NUMBERS_PER_MAT4 * FOUR_BYTES_PER_FLOAT,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.modelMatrixBuffer, 0, new Float32Array(Mat4.makeTranslation(pos)))

		this.vertexBuffer = device.createBuffer({
			size: args.vertices.length * THREE_NUMBERS_PER_3D_COORD * FOUR_BYTES_PER_FLOAT,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.vertexBuffer, 0, new Float32Array(args.vertices.flatMap((v) => v)))

		this.indexBuffer = device.createBuffer({
			size: args.indices.length * FOUR_BYTES_PER_INT32,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.indexBuffer, 0, new Uint32Array(args.indices))
	}
}
