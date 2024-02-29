import vertShader from "./globe-projected-mesh.vert.wgsl"
import {type Mesh} from "./Mesh"
import {FOUR_BYTES_PER_FLOAT, FOUR_BYTES_PER_INT32, THREE_NUMBERS_PER_3D_COORD} from "@/const"
import {type MapContext} from "@/map/MapContext"
import {type Material} from "@/materials/Material"
import {type MercatorCoord} from "@/types"
import {mercatorToEcef} from "@/util"

type GlobeProjectedMeshArgs = {
	vertices: MercatorCoord[]
	indices: number[]
}

export class GlobeProjectedMesh implements Mesh {
	renderPipeline: GPURenderPipeline
	bindGroup: GPUBindGroup
	vertexBuffer: GPUBuffer
	indexBuffer: GPUBuffer

	constructor(
		private mapContext: MapContext,
		args: GlobeProjectedMeshArgs,
		public material: Material,
	) {
		const {device, presentationFormat} = mapContext

		this.vertexBuffer = null!
		this.indexBuffer = null!
		this.set(args) // Above lines are to appease TypeScript; this line is the real initialization

		const bindGroupLayout = device.createBindGroupLayout({
			label: `globe-projected mesh bind group layout`,
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX,
					buffer: {type: `uniform`},
				},
			],
		})

		const layout = device.createPipelineLayout({
			label: `globe-projected mesh pipeline layout`,
			bindGroupLayouts: [bindGroupLayout, material.bindGroupLayout],
		})

		this.bindGroup = device.createBindGroup({
			label: `globe-projected mesh bind group`,
			layout: bindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {buffer: this.mapContext.viewMatrixBuffer},
				},
			],
		})

		const vertShaderModule = device.createShaderModule({
			label: `globe-projected mesh vertex shader`,
			code: vertShader,
		})

		this.renderPipeline = device.createRenderPipeline({
			label: `globe-projected mesh render pipeline`,
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

	set = (args: GlobeProjectedMeshArgs) => {
		;(this.vertexBuffer as typeof this.vertexBuffer | undefined)?.destroy()
		;(this.indexBuffer as typeof this.indexBuffer | undefined)?.destroy()

		const {device} = this.mapContext

		const vertices3d = args.vertices.map((v) => mercatorToEcef(v))

		this.vertexBuffer = device.createBuffer({
			size: vertices3d.length * THREE_NUMBERS_PER_3D_COORD * FOUR_BYTES_PER_FLOAT,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.vertexBuffer, 0, new Float32Array(vertices3d.flatMap((v) => [v[1], v[2], v[0]])))

		this.indexBuffer = device.createBuffer({
			size: args.indices.length * FOUR_BYTES_PER_INT32,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.indexBuffer, 0, new Uint32Array(args.indices))
	}
}
