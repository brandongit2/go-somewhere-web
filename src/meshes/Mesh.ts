import {type Material} from "../materials/Material"

export type Mesh = {
	material: Material
	bindGroup: GPUBindGroup
	renderPipeline: GPURenderPipeline
	draw: (passEncoder: GPURenderPassEncoder) => void
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	set: (args: any) => void
}
