import type {MapContext} from "./MapContext"
import type {Material} from "./Material"

import flatMaterialShaders from "./flat-material-shaders.wgsl"

export class FlatMaterial implements Material {
	bindGroup: GPUBindGroup
	pipeline: GPURenderPipeline
	colorUniformBuffer: GPUBuffer

	constructor(
		public mapContext: MapContext,
		color: [number, number, number],
	) {
		const {device, presentationFormat} = mapContext

		const shaderModule = device.createShaderModule({code: flatMaterialShaders})
		this.pipeline = device.createRenderPipeline({
			label: `flat material pipeline`,
			layout: mapContext.pipelineLayout,
			vertex: {
				module: shaderModule,
				entryPoint: `vs`,
				buffers: [
					{
						arrayStride: 3 * 4,
						attributes: [{shaderLocation: 0, offset: 0, format: `float32x3`}],
					},
				],
			},
			fragment: {
				module: shaderModule,
				entryPoint: `fs`,
				targets: [{format: presentationFormat}],
			},
		})

		this.colorUniformBuffer = device.createBuffer({
			size: 4 * 16,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.colorUniformBuffer, 0, new Float32Array(color))

		this.bindGroup = device.createBindGroup({
			layout: mapContext.bindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {buffer: mapContext.viewMatrixUniformBuffer},
				},
				{
					binding: 1,
					resource: {buffer: this.colorUniformBuffer},
				},
			],
		})
	}
}
