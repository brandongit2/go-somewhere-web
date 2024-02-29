import fragShader from "./flat-material.frag.wgsl"
import {type Material} from "./Material"
import {type MapContext} from "@/map/MapContext"

export class FlatMaterial implements Material {
	bindGroupLayout: GPUBindGroupLayout
	bindGroup: GPUBindGroup
	fragShaderModule: GPUShaderModule
	colorUniformBuffer: GPUBuffer

	constructor(
		private mapContext: MapContext,
		color: [number, number, number],
	) {
		const {device} = mapContext

		this.fragShaderModule = device.createShaderModule({
			label: `flat material fragment shader`,
			code: fragShader,
		})

		this.colorUniformBuffer = device.createBuffer({
			label: `flat material color uniform buffer`,
			size: 4 * 16,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.colorUniformBuffer, 0, new Float32Array(color))

		this.bindGroupLayout = device.createBindGroupLayout({
			label: `flat material bind group layout`,
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {type: `uniform`},
				},
			],
		})

		this.bindGroup = device.createBindGroup({
			label: `flat material bind group`,
			layout: this.bindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {buffer: this.colorUniformBuffer},
				},
			],
		})
	}
}
