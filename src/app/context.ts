export type WebgpuContext = {
	height: number
	width: number

	canvasContext: GPUCanvasContext
	canvasElement: HTMLCanvasElement
	device: GPUDevice
	presentationFormat: GPUTextureFormat

	pipelineLayout: GPUPipelineLayout
	uniformBuffer: GPUBuffer
	bindGroup: GPUBindGroup
}
