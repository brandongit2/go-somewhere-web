import type {MapContext} from "./MapContext"
import type {Material} from "./Material"

export class Mesh {
	vertexBuffer: GPUBuffer
	indexBuffer: GPUBuffer

	constructor(
		mapContext: MapContext,
		vertices: number[],
		indices: number[],
		public material: Material,
	) {
		const {device} = mapContext

		this.vertexBuffer = device.createBuffer({
			size: vertices.length * 4,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.vertexBuffer, 0, new Float32Array(vertices))

		this.indexBuffer = device.createBuffer({
			size: indices.length * 4,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
		})
		device.queue.writeBuffer(this.indexBuffer, 0, new Uint32Array(indices))
	}

	draw = (pass: GPURenderPassEncoder) => {
		pass.setPipeline(this.material.pipeline)
		pass.setBindGroup(0, this.material.bindGroup)

		pass.setVertexBuffer(0, this.vertexBuffer)
		pass.setIndexBuffer(this.indexBuffer, `uint32`)
		pass.drawIndexed(this.indexBuffer.size / 4)
	}
}
