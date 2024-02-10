"use client"

import {useCallback, useEffect, useRef, useState} from "react"
import invariant from "tiny-invariant"

import shaders from "./shaders.wgsl"
import {useWebgpu} from "@/hooks/useWebgpu"

export default function Root() {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const {device, context, presentationFormat} = useWebgpu(canvasRef)

	const [pipeline, setPipeline] = useState<GPURenderPipeline>()
	useEffect(() => {
		if (!device || !context || !presentationFormat) return
		const module = device.createShaderModule({
			label: `rgb triangle shaders`,
			code: shaders,
		})
		const pipeline = device.createRenderPipeline({
			label: `rgb triangle pipeline`,
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
		setPipeline(pipeline)
	}, [context, device, presentationFormat])

	const render = useCallback(() => {
		if (!device || !context || !pipeline || !canvasRef.current) return

		const encoder = device.createCommandEncoder({label: `encoder`})
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

		const aspect = canvasRef.current.width / canvasRef.current.height

		const colorSize = 4
		const scaleSize = 2
		const translateSize = 2
		const colorOffset = 0
		const scaleOffset = colorOffset + colorSize
		const translateOffset = scaleOffset + scaleSize
		const uniformBufferSize = (colorSize + scaleSize + translateSize) * 4

		const uniformValues = new Float32Array(uniformBufferSize / 4)
		const numObjects = 100
		for (let i = 0; i < numObjects; i++) {
			const uniformBuffer = device.createBuffer({
				label: `uniforms for obj: ${i}`,
				size: uniformBufferSize,
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			})

			const scale = rand(0.2, 0.5)
			uniformValues.set([rand(0, 1), rand(0, 1), rand(0, 1), 1], colorOffset)
			uniformValues.set([scale / aspect, scale], scaleOffset)
			uniformValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], translateOffset)

			const bindGroup = device.createBindGroup({
				label: `bind group for obj: ${i}`,
				layout: pipeline.getBindGroupLayout(0),
				entries: [{binding: 0, resource: {buffer: uniformBuffer}}],
			})

			device.queue.writeBuffer(uniformBuffer, 0, uniformValues)
			pass.setBindGroup(0, bindGroup)
			pass.draw(3)
		}
		pass.end()

		const commandBuffer = encoder.finish()
		device.queue.submit([commandBuffer])
	}, [context, device, pipeline])

	useEffect(() => {
		const onResize = () => {
			if (!device) return
			invariant(canvasRef.current)

			const width = canvasRef.current.getBoundingClientRect().width
			const height = canvasRef.current.getBoundingClientRect().height
			canvasRef.current.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D)) * devicePixelRatio
			canvasRef.current.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D)) * devicePixelRatio
			render()
		}

		window.addEventListener(`resize`, onResize)
		onResize()
		return () => window.removeEventListener(`resize`, onResize)
	}, [device, render])

	return <canvas ref={canvasRef} className="absolute left-0 top-0 h-full w-full" />
}

const rand = (min: number, max: number) => min + Math.random() * (max - min)
