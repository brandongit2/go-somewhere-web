import {type Material} from "../materials/Material"

export type Mesh<Args extends Record<string, unknown> = Record<string, unknown>> = {
	material: Material
	bindGroup: GPUBindGroup
	renderPipeline: GPURenderPipeline
	draw: (passEncoder: GPURenderPassEncoder) => void
	set(args: Args): void
}
