export class Material {
	_pipeline: GPURenderPipeline

	constructor(fragmentShader: string) {
		const fragmentShaderModule = device.createShaderModule({
			label:
		})

		this._pipeline = device.createRenderPipeline({

		})
	}
}
