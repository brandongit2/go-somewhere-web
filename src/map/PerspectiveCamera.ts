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
		public fovX: number,
		public near: number,
		public far: number,
		viewMatrix = new Mat4(),
	) {
		const {device, mapWidth, mapHeight} = map.canvas

		this.projectionMatrix = new PerspectiveMatrix(fovX, mapWidth / mapHeight, near, far)
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

	updateProjectionMatrix = (opts?: {fovX?: number; near?: number; far?: number}) => {
		this.projectionMatrix = new PerspectiveMatrix(
			opts?.fovX ?? this.fovX,
			this.map.canvas.mapWidth / this.map.canvas.mapHeight,
			opts?.near ?? this.near,
			opts?.far ?? this.far,
		)
		this.updateProjectionMatrixBuffer()
	}

	updateProjectionMatrixBuffer = () => {
		this.map.canvas.device.queue.writeBuffer(this.projectionMatrixBuffer, 0, new Float32Array(this.projectionMatrix))
	}

	updateViewMatrixBuffer = () => {
		this.map.canvas.device.queue.writeBuffer(this.viewMatrixBuffer, 0, new Float32Array(this.viewMatrix))
	}
}
