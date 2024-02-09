"use client"

import {useEffect, useRef} from "react"
import invariant from "tiny-invariant"

import shaders from "./shaders.wgsl"
import {useAsyncError} from "@/hooks/use-async-error"

let didInit = false

export default function Root() {
	const throwError = useAsyncError()

	const canvasRef = useRef<HTMLCanvasElement>(null)
	useEffect(() => {
		const init = async () => {
			if (didInit) return
			if (!canvasRef.current) return

			didInit = true

			const gpu = navigator.gpu
			const adapter = await gpu.requestAdapter()
			if (!adapter) throw new Error(`No suitable GPUs found.`)

			const device = await adapter.requestDevice()
			const context = canvasRef.current.getContext(`webgpu`)
			if (!context) throw new Error(`WebGPU not supported.`)

			const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
			context.configure({
				device,
				format: presentationFormat,
			})

			const module = device.createShaderModule({
				label: `red triangle shaders`,
				code: shaders,
			})

			const pipeline = device.createRenderPipeline({
				label: `red triangle pipeline`,
				layout: `auto`,
				vertex: {
					module,
					entryPoint: `vs`,
				},
				fragment: {
					module,
					entryPoint: `fs`,
					targets: [{format: presentationFormat}],
				},
			})

			function render() {
				invariant(context)

				const encoder = device.createCommandEncoder({label: `our encoder`})

				const pass = encoder.beginRenderPass({
					label: `render pass`,
					colorAttachments: [
						{
							view: context.getCurrentTexture().createView(),
							clearValue: [0.3, 0.3, 0.3, 1],
							loadOp: `clear` as const,
							storeOp: `store` as const,
						},
					],
				})
				pass.setPipeline(pipeline)
				pass.draw(3) // call our vertex shader 3 times
				pass.end()

				const commandBuffer = encoder.finish()
				device.queue.submit([commandBuffer])
			}

			render()
		}

		init().catch(throwError)
	})

	return (
		<div>
			go somewhere
			<canvas ref={canvasRef} />
		</div>
	)
}
