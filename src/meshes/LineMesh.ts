import vertShader from "./line-mesh.vert.wgsl"
import {type Mesh} from "./Mesh"
import {FOUR_BYTES_PER_FLOAT, FOUR_BYTES_PER_INT32, THREE_NUMBERS_PER_3D_COORD} from "@/const"
import {linestringToMesh} from "@/linestring-to-mesh"
import {type MapContext} from "@/map/MapContext"
import {type Material} from "@/materials/Material"
import {type MercatorCoord, type WorldCoord} from "@/types"

type LineMeshArgs = {
	vertices: MercatorCoord[][]
	thickness: number
}

export class LineMesh implements Mesh {
	bindGroup: GPUBindGroup
	renderPipeline: GPURenderPipeline
	vertexBuffer: GPUBuffer
	normalBuffer: GPUBuffer
	miterLengthBuffer: GPUBuffer
	indexBuffer: GPUBuffer
	thickness: number
	thicknessUniformBuffer: GPUBuffer

	constructor(
		private mapContext: MapContext,
		args: LineMeshArgs,
		public material: Material,
	) {
		const {device, presentationFormat} = mapContext

		this.vertexBuffer = null!
		this.normalBuffer = null!
		this.miterLengthBuffer = null!
		this.indexBuffer = null!
		this.set(args) // Above lines are to appease TypeScript; this line is the real initialization

		const bindGroupLayout = device.createBindGroupLayout({
			label: `line mesh bind group layout`,
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

		this.thicknessUniformBuffer = device.createBuffer({
			label: `line mesh thickness uniform buffer`,
			size: FOUR_BYTES_PER_FLOAT,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		})

		this.bindGroup = device.createBindGroup({
			label: `line mesh bind group`,
			layout: bindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {buffer: this.mapContext.viewMatrixBuffer},
				},
				{
					binding: 1,
					resource: {buffer: this.thicknessUniformBuffer},
				},
			],
		})

		const pipelineLayout = device.createPipelineLayout({
			label: `line mesh pipeline layout`,
			bindGroupLayouts: [bindGroupLayout, material.bindGroupLayout],
		})

		const vertShaderModule = device.createShaderModule({
			label: `line mesh vertex shader`,
			code: vertShader,
		})

		this.renderPipeline = device.createRenderPipeline({
			label: `line material pipeline`,
			layout: pipelineLayout,
			vertex: {
				module: vertShaderModule,
				entryPoint: `main`,
				buffers: [
					{
						arrayStride: THREE_NUMBERS_PER_3D_COORD * FOUR_BYTES_PER_FLOAT,
						attributes: [{shaderLocation: 0, offset: 0, format: `float32x3`}],
					},
					{
						arrayStride: THREE_NUMBERS_PER_3D_COORD * FOUR_BYTES_PER_FLOAT,
						attributes: [{shaderLocation: 1, offset: 0, format: `float32x3`}],
					},
					{
						arrayStride: FOUR_BYTES_PER_FLOAT,
						attributes: [{shaderLocation: 2, offset: 0, format: `float32`}],
					},
				],
			},
			fragment: {
				module: material.fragShaderModule,
				entryPoint: `main`,
				targets: [{format: presentationFormat}],
			},
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: `greater`,
				format: `depth24plus`,
			},
		})

		this.thickness = args.thickness
	}

	draw = (pass: GPURenderPassEncoder) => {
		const {device, degreesPerPx} = this.mapContext

		device.queue.writeBuffer(this.thicknessUniformBuffer, 0, new Float32Array([this.thickness * degreesPerPx]))

		pass.setPipeline(this.renderPipeline)
		pass.setBindGroup(0, this.bindGroup)
		pass.setBindGroup(1, this.material.bindGroup)

		pass.setVertexBuffer(0, this.vertexBuffer)
		pass.setVertexBuffer(1, this.normalBuffer)
		pass.setVertexBuffer(2, this.miterLengthBuffer)
		pass.setIndexBuffer(this.indexBuffer, `uint32`)
		pass.drawIndexed(this.indexBuffer.size / 4)
	}

	set = (args: LineMeshArgs) => {
		;(this.vertexBuffer as typeof this.vertexBuffer | undefined)?.destroy()
		;(this.normalBuffer as typeof this.normalBuffer | undefined)?.destroy()
		;(this.miterLengthBuffer as typeof this.miterLengthBuffer | undefined)?.destroy()
		;(this.indexBuffer as typeof this.indexBuffer | undefined)?.destroy()

		const {device} = this.mapContext

		const mesh = args.vertices
			.map((coords) => linestringToMesh(coords))
			.reduce(
				(acc, cur) => {
					acc.indices.push(...cur.indices.map((i) => i + acc.vertices.length))
					acc.vertices.push(...cur.vertices)
					acc.normals.push(...cur.normals)
					acc.miterLengths.push(...cur.miterLengths)
					return acc
				},
				{
					vertices: [] as WorldCoord[],
					normals: [] as Array<[number, number, number]>,
					miterLengths: [] as number[],
					indices: [] as number[],
				},
			)

		this.vertexBuffer = device.createBuffer({
			size: mesh.vertices.length * THREE_NUMBERS_PER_3D_COORD * FOUR_BYTES_PER_FLOAT,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.vertexBuffer, 0, new Float32Array(mesh.vertices.flatMap((v) => v)))

		this.normalBuffer = device.createBuffer({
			size: mesh.normals.length * THREE_NUMBERS_PER_3D_COORD * FOUR_BYTES_PER_FLOAT,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.normalBuffer, 0, new Float32Array(mesh.normals.flatMap((n) => n)))

		this.miterLengthBuffer = device.createBuffer({
			size: mesh.miterLengths.length * FOUR_BYTES_PER_FLOAT,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.miterLengthBuffer, 0, new Float32Array(mesh.miterLengths))

		this.indexBuffer = device.createBuffer({
			size: mesh.indices.length * FOUR_BYTES_PER_INT32,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.indexBuffer, 0, new Uint32Array(mesh.indices))
	}
}
