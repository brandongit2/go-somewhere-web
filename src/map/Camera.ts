import {FOUR_BYTES_PER_FLOAT32, SIXTEEN_NUMBERS_PER_MAT4} from "@/const"
import {Mat4} from "@/math/Mat4"
import {PerspectiveMatrix} from "@/math/PerspectiveMatrix"
import {device} from "@/webgpu"

export class Camera {
	projectionMatrix: Mat4
	projectionMatrixBuffer: GPUBuffer
	viewMatrix: Mat4
	viewMatrixBuffer: GPUBuffer

	constructor(
		public fovX: number,
		public aspect: number,
		public near: number,
		public far: number,
		viewMatrix = new Mat4(),
	) {
		this.projectionMatrix = new PerspectiveMatrix(fovX, aspect, near, far)
		this.projectionMatrixBuffer = device.createBuffer({
			label: `camera projection matrix buffer`,
			size: SIXTEEN_NUMBERS_PER_MAT4 * FOUR_BYTES_PER_FLOAT32,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		})
		this.updateProjectionMatrixBuffer()

		this.viewMatrix = viewMatrix
		this.viewMatrixBuffer = device.createBuffer({
			label: `camera view matrix buffer`,
			size: SIXTEEN_NUMBERS_PER_MAT4 * FOUR_BYTES_PER_FLOAT32,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		})
		this.updateViewMatrixBuffer()
	}

	updateProjectionMatrix = (opts?: {fovX?: number; aspect?: number; near?: number; far?: number}) => {
		this.projectionMatrix = new PerspectiveMatrix(
			opts?.fovX ?? this.fovX,
			opts?.aspect ?? this.aspect,
			opts?.near ?? this.near,
			opts?.far ?? this.far,
		)
		this.updateProjectionMatrixBuffer()
	}

	updateProjectionMatrixBuffer = () => {
		device.queue.writeBuffer(this.projectionMatrixBuffer, 0, new Float32Array(this.projectionMatrix))
	}

	updateViewMatrixBuffer = () => {
		device.queue.writeBuffer(this.viewMatrixBuffer, 0, new Float32Array(this.viewMatrix))
	}
}
