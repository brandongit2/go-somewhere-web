import {FOUR_BYTES_PER_FLOAT32, SIXTEEN_NUMBERS_PER_MAT4} from "@/const"
import {type MapRoot} from "@/map/MapRoot"
import {Mat4} from "@/math/Mat4"
import {PerspectiveMatrix} from "@/math/PerspectiveMatrix"

export class PerspectiveCamera {
	projectionMatrix: Mat4
	projectionMatrixBuffer: GPUBuffer
	viewMatrix: Mat4
	viewMatrixBuffer: GPUBuffer

	constructor(
		private map: MapRoot,
		fovX: number,
		near: number,
		far: number,
		viewMatrix = new Mat4(),
	) {
		const {device} = map.canvas

		this.projectionMatrix = new PerspectiveMatrix(fovX, 1, near, far)
		this.projectionMatrixBuffer = device.createBuffer({
			label: `perspective camera projection matrix buffer`,
			size: SIXTEEN_NUMBERS_PER_MAT4 * FOUR_BYTES_PER_FLOAT32,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		})
		this.updateProjectionMatrixBuffer()

		this.viewMatrix = viewMatrix
		this.viewMatrixBuffer = device.createBuffer({
			label: `perspective camera view matrix buffer`,
			size: SIXTEEN_NUMBERS_PER_MAT4 * FOUR_BYTES_PER_FLOAT32,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		})
		this.updateViewMatrixBuffer()
	}

	updateProjectionMatrixBuffer = () => {
		this.map.canvas.device.queue.writeBuffer(this.projectionMatrixBuffer, 0, new Float32Array(this.projectionMatrix))
	}

	updateViewMatrixBuffer = () => {
		this.map.canvas.device.queue.writeBuffer(this.viewMatrixBuffer, 0, new Float32Array(this.viewMatrix))
	}
}
