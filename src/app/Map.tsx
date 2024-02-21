"use client"

import {motion, useAnimationFrame, useMotionValue, useTransform} from "framer-motion"
import {memo, useCallback, useEffect, useRef} from "react"
import invariant from "tiny-invariant"

import type {WebgpuContext} from "./context"
import type {TileId} from "./types"

import {TileManager} from "./TileManager"
import {useAsyncError} from "@/hooks/use-async-error"
import {Mat4} from "@/math/Mat4"
import {Vec2} from "@/math/Vec2"
import {clamp, lat2tile, lng2tile} from "@/util"

let didInit = false
const pxPerTile = 512
const tileManager = new TileManager()

const MapRootImpl = () => {
	const throwError = useAsyncError()
	const lng = useMotionValue(0)
	const lat = useMotionValue(0)
	const zoom = useMotionValue(0)
	const degreesPerPx = useTransform(() => 360 / pxPerTile / 2 ** zoom.get())

	const updateCamera = useCallback(() => {
		if (!webgpuContext.current) return
		const {height, width, device, viewMatrixUniformBuffer} = webgpuContext.current

		const zoomRounded = Math.floor(zoom.get())
		const leftTile = Math.floor(lng2tile(clamp(lng.get() - (width / 2) * degreesPerPx.get(), -180, 180), zoomRounded))
		const rightTile = Math.ceil(lng2tile(clamp(lng.get() + (width / 2) * degreesPerPx.get(), -180, 180), zoomRounded))
		const topTile = Math.floor(lat2tile(clamp(lat.get() + (height / 2) * degreesPerPx.get(), -85, 85), zoomRounded))
		const bottomTile = Math.ceil(lat2tile(clamp(lat.get() - (height / 2) * degreesPerPx.get(), -85, 85), zoomRounded))
		let tilesInView: TileId[] = []
		for (let x = clamp(leftTile, 0, 2 ** zoomRounded); x < clamp(rightTile, 0, 2 ** zoomRounded); x++) {
			for (let y = clamp(topTile, 0, 2 ** zoomRounded); y < clamp(bottomTile, 0, 2 ** zoomRounded); y++) {
				tilesInView.push(`${zoomRounded}/${x}/${y}`)
			}
		}
		tileManager.setTilesInView(tilesInView, webgpuContext.current)

		device.queue.writeBuffer(
			viewMatrixUniformBuffer,
			0,
			new Float32Array(
				Mat4.fromOrthographic(
					lng.get() - degreesPerPx.get() * (width / 2),
					lng.get() + degreesPerPx.get() * (width / 2),
					lat.get() + degreesPerPx.get() * (height / 2),
					lat.get() - degreesPerPx.get() * (height / 2),
					-1,
					1,
				),
			),
		)
	}, [degreesPerPx, lat, lng, zoom])

	const handleResize = useCallback(() => {
		if (!webgpuContext.current) return
		const {device, canvasElement} = webgpuContext.current

		const width = canvasElement.getBoundingClientRect().width
		const height = canvasElement.getBoundingClientRect().height
		webgpuContext.current.width = width
		webgpuContext.current.height = height

		canvasElement.width = clamp(width, 1, device.limits.maxTextureDimension2D) * devicePixelRatio
		canvasElement.height = clamp(height, 1, device.limits.maxTextureDimension2D) * devicePixelRatio

		updateCamera()
	}, [updateCamera])
	useEffect(() => {
		window.addEventListener(`resize`, handleResize)
		return () => window.removeEventListener(`resize`, handleResize)
	}, [handleResize])

	const canvasRef = useRef<HTMLCanvasElement>(null)
	const webgpuContext = useRef<WebgpuContext | null>(null)
	useEffect(() => {
		const init = async () => {
			if (didInit) return
			invariant(canvasRef.current)

			const gpu = navigator.gpu
			const adapter = await gpu.requestAdapter()
			if (!adapter) throw new Error(`No suitable GPUs found.`)

			const device = await adapter.requestDevice()
			device.lost
				.then((info) => {
					throwError(new Error(`GPU lost. Info: ${info.message}`))
				})
				.catch(throwError)

			const canvasContext = canvasRef.current.getContext(`webgpu`)
			if (!canvasContext) throw new Error(`WebGPU not supported.`)

			const presentationFormat = navigator.gpu.getPreferredCanvasFormat()

			canvasContext.configure({
				device,
				format: presentationFormat,
			})

			const viewMatrixUniformBuffer = device.createBuffer({
				label: `view matrix uniform buffer`,
				size: 4 * 4 * 4, // mat4x4f
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			})
			const colorUniformBuffer = device.createBuffer({
				label: `color uniform buffer`,
				size: 4 * 4, // vec4f
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			})

			const bindGroupLayout = device.createBindGroupLayout({
				label: `bind group layout`,
				entries: [
					{binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {type: `uniform`}},
					{binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: {type: `uniform`}},
				],
			})
			const pipelineLayout = device.createPipelineLayout({
				label: `pipeline layout`,
				bindGroupLayouts: [bindGroupLayout],
			})

			const bindGroup = device.createBindGroup({
				label: `bind group`,
				layout: bindGroupLayout,
				entries: [
					{binding: 0, resource: {buffer: viewMatrixUniformBuffer}},
					{binding: 1, resource: {buffer: colorUniformBuffer}},
				],
			})

			webgpuContext.current = {
				height: canvasRef.current.getBoundingClientRect().height,
				width: canvasRef.current.getBoundingClientRect().width,
				lng,
				lat,
				zoom,
				degreesPerPx,
				canvasContext,
				canvasElement: canvasRef.current,
				device,
				presentationFormat,
				pipelineLayout,
				viewMatrixUniformBuffer,
				colorUniformBuffer,
				bindGroup,
			}

			handleResize()
		}

		init().catch(throwError)
		didInit = true
	}, [degreesPerPx, handleResize, lat, lng, throwError, updateCamera, zoom])

	// Render
	const mousePos = useMotionValue<[number, number] | null>(null)
	const mousePosWorld = useTransform(mousePos, (p) => {
		if (!webgpuContext.current || !p) return null
		const {width, height} = webgpuContext.current

		const pos = new Vec2(lng.get(), lat.get())
		const cursorX = p[0] - width / 2
		const cursorY = -(p[1] - height / 2)
		return new Vec2(cursorX, cursorY).times(degreesPerPx.get()).plus(pos)
	})
	const zoomChangeAmount = useRef(0)
	useAnimationFrame(() => {
		if (!webgpuContext.current) return
		const {height, width, zoom, canvasContext, device, bindGroup} = webgpuContext.current

		const mp = mousePos.get()
		const mpw = mousePosWorld.get()
		if (zoomChangeAmount.current && mp && mpw) {
			const newZoom = clamp(zoom.get() - zoomChangeAmount.current, 0, 18)
			const scaleChange = 2 ** (newZoom - zoom.get())

			lng.set(clamp(lng.get() + (mp[0] - 0.5 * width) * (1 - 1 / scaleChange) * degreesPerPx.get(), -180, 180))
			lat.set(clamp(lat.get() - (mp[1] - 0.5 * height) * (1 - 1 / scaleChange) * degreesPerPx.get(), -85, 85))
			zoom.set(newZoom)

			updateCamera()
			zoomChangeAmount.current = 0
		}

		const encoder = device.createCommandEncoder({label: `encoder`})
		const pass = encoder.beginRenderPass({
			label: `render pass`,
			colorAttachments: [
				{
					view: canvasContext.getCurrentTexture().createView(),
					clearValue: [0, 1, 0, 1],
					loadOp: `clear` as const,
					storeOp: `store` as const,
				},
			],
		})
		pass.setBindGroup(0, bindGroup)

		tileManager.tilesInView.forEach((tileId) => {
			if (!webgpuContext.current) return
			let [zoom, x, y] = TileManager.tileIdToCoords(tileId)

			// Start by trying to find the tile in cache
			let tile = tileManager.fetchTileFromCache(`${zoom}/${x}/${y}`)
			// In the meantime, try to find a parent tile to render
			while (!tile) {
				;[x, y, zoom] = [x >> 1, y >> 1, zoom - 1]
				tile = tileManager.fetchTileFromCache(`${zoom}/${x}/${y}`)
				if (zoom <= 0) return
			}

			tile.draw(pass, webgpuContext.current)
		})

		pass.end()
		const commandBuffer = encoder.finish()
		device.queue.submit([commandBuffer])
	})

	return (
		<motion.canvas
			ref={canvasRef}
			className="h-full w-full touch-none"
			onPointerMove={(event) => {
				mousePos.set([event.clientX, event.clientY])
			}}
			onPan={(event, info) => {
				lng.set(clamp(lng.get() - info.delta.x * degreesPerPx.get(), -180, 180))
				lat.set(clamp(lat.get() + info.delta.y * degreesPerPx.get(), -85, 85))
				updateCamera()
			}}
			onWheel={(event) => {
				zoomChangeAmount.current += event.deltaY * 0.01
			}}
		/>
	)
}

export const MapRoot = memo(MapRootImpl)
