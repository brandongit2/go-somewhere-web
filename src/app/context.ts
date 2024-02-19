import type {MotionValue} from "framer-motion"

export type WebgpuContext = {
	height: number
	width: number
	lng: MotionValue<number>
	lat: MotionValue<number>
	zoom: MotionValue<number>
	degreesPerPx: MotionValue<number>

	canvasContext: GPUCanvasContext
	canvasElement: HTMLCanvasElement
	device: GPUDevice
	presentationFormat: GPUTextureFormat

	pipelineLayout: GPUPipelineLayout
	viewMatrixUniformBuffer: GPUBuffer
	colorUniformBuffer: GPUBuffer
	bindGroup: GPUBindGroup
}
