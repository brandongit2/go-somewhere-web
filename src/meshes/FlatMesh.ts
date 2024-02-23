import vertShader from "./flat-mesh.vert.wgsl"
import {type Mesh} from "./Mesh"
import {type MapContext} from "@/map/MapContext"
import {type Material} from "@/materials/Material"

type FlatMeshArgs = {
	vertices: number[]
	indices: number[]
}

export class FlatMesh implements Mesh<FlatMeshArgs> {
	renderPipeline: GPURenderPipeline
	bindGroup: GPUBindGroup
	vertexBuffer: GPUBuffer
	indexBuffer: GPUBuffer

	constructor(
		public mapContext: MapContext,
		args: FlatMeshArgs,
		public material: Material,
	) {
		const {device, presentationFormat} = mapContext

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
					resource: {buffer: this.mapContext.viewMatrixUniformBuffer},
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
						arrayStride: 4 * 3,
						attributes: [{shaderLocation: 0, offset: 0, format: `float32x3`}],
					},
				],
			},
			fragment: {
				module: material.fragShaderModule,
				entryPoint: `main`,
				targets: [{format: presentationFormat}],
			},
		})
	}

	draw = (pass: GPURenderPassEncoder) => {
		pass.setPipeline(this.renderPipeline)
		pass.setBindGroup(0, this.bindGroup)
		pass.setBindGroup(1, this.material.bindGroup)

		pass.setVertexBuffer(0, this.vertexBuffer)
		pass.setIndexBuffer(this.indexBuffer, `uint32`)
		pass.drawIndexed(this.indexBuffer.size / 4)
	}

	set = (args: FlatMeshArgs) => {
		;(this.vertexBuffer as typeof this.vertexBuffer | undefined)?.destroy()
		;(this.indexBuffer as typeof this.indexBuffer | undefined)?.destroy()

		const {device} = this.mapContext

		this.vertexBuffer = device.createBuffer({
			size: args.vertices.length * 4,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.vertexBuffer, 0, new Float32Array(args.vertices))

		this.indexBuffer = device.createBuffer({
			size: args.indices.length * 4,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.indexBuffer, 0, new Uint32Array(args.indices))
	}
}
