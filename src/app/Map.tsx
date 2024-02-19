"use client"

import {VectorTile, VectorTileFeature} from "@mapbox/vector-tile"
import {motion, useAnimationFrame, useMotionValue, useTransform} from "framer-motion"
import Pbf from "pbf"
import {memo, useCallback, useEffect, useRef} from "react"
import invariant from "tiny-invariant"
import wretch from "wretch"
// eslint-disable-next-line import/no-named-as-default -- `QueryStringAddon` in this import is an interface, not what we want
import QueryStringAddon from "wretch/addons/queryString"

import type {WebgpuContext} from "./context"
import type {MapLayerFeature, MapTileLayer} from "./types"

import {MapTile} from "./MapTile"
import {MAPBOX_ACCESS_TOKEN} from "@/env"
import {useAsyncError} from "@/hooks/use-async-error"
import {Mat4} from "@/math/Mat4"
import {Vec2} from "@/math/Vec2"
import {clamp, lat2tile, lng2tile} from "@/util"

const pxPerTile = 512

const MapRootImpl = () => {
	const throwError = useAsyncError()
	const lng = useMotionValue(0)
	const lat = useMotionValue(0)
	const zoom = useMotionValue(0)
	const degreesPerPx = useTransform(() => 360 / pxPerTile / 2 ** zoom.get())

	const tilesInViewRef = useRef<Array<[number, number, number]>>([])
	const tileDataCache = useRef(new Map<string, ArrayBuffer>())
	const updateCamera = useCallback(() => {
		if (!webgpuContext.current) return
		const {height, width, device, viewMatrixUniformBuffer} = webgpuContext.current

		const zoomRounded = Math.floor(zoom.get())
		const leftTile = Math.floor(lng2tile(clamp(lng.get() - (width / 2) * degreesPerPx.get(), -180, 180), zoomRounded))
		const rightTile = Math.ceil(lng2tile(clamp(lng.get() + (width / 2) * degreesPerPx.get(), -180, 180), zoomRounded))
		const topTile = Math.floor(lat2tile(clamp(lat.get() + (height / 2) * degreesPerPx.get(), -85, 85), zoomRounded))
		const bottomTile = Math.ceil(lat2tile(clamp(lat.get() - (height / 2) * degreesPerPx.get(), -85, 85), zoomRounded))
		let tilesInView: Array<[number, number, number]> = []
		for (let x = clamp(leftTile, 0, 2 ** zoomRounded); x < clamp(rightTile, 0, 2 ** zoomRounded); x++) {
			for (let y = clamp(topTile, 0, 2 ** zoomRounded); y < clamp(bottomTile, 0, 2 ** zoomRounded); y++) {
				tilesInView.push([x, y, zoomRounded])
			}
		}
		tilesInViewRef.current = tilesInView

		for (const [x, y, zoom] of tilesInView) {
			if (tileDataCache.current.has(`${x}/${y}/${zoom}`)) continue

			wretch(`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/${Math.round(zoom)}/${x}/${y}.mvt`)
				.addon(QueryStringAddon)
				.query({access_token: MAPBOX_ACCESS_TOKEN})
				.get()
				.arrayBuffer()
				.then((data) => {
					tileDataCache.current.set(`${x}/${y}/${zoom}`, data)
				})
				.catch(throwError)
		}

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
	}, [degreesPerPx, lat, lng, throwError, zoom])

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
	}, [degreesPerPx, handleResize, lat, lng, throwError, updateCamera, zoom])

	// Render
	const tileCache = useRef(new Map<string, MapTile>())
	const zoomChangeQueue = useRef<{amount: number; mouseX: number; mouseY: number} | null>(null)
	useAnimationFrame(() => {
		if (!webgpuContext.current) return
		const {canvasContext, device, bindGroup} = webgpuContext.current

		if (zoomChangeQueue.current) {
			const pos = new Vec2(lng.get(), lat.get())
			const cursorX = zoomChangeQueue.current.mouseX - webgpuContext.current.width / 2
			const cursorY = -(zoomChangeQueue.current.mouseY - webgpuContext.current.height / 2)
			// Convert cursor position to world position at current zoom level
			const cursor = new Vec2(cursorX, cursorY).times(degreesPerPx.get()).plus(pos)

			const newZoom = clamp(zoom.get() - zoomChangeQueue.current.amount, 0, 18)
			zoom.set(newZoom)
			const newDegreesPerPx = 360 / pxPerTile / 2 ** zoom.get()
			const newPos = cursor.minus(new Vec2(cursorX, cursorY).times(newDegreesPerPx))

			lng.set(clamp(newPos.x, -180, 180))
			lat.set(clamp(newPos.y, -85, 85))

			updateCamera()
			zoomChangeQueue.current = null
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

		tilesInViewRef.current.map(([x, y, zoom]) => {
			if (!webgpuContext.current) return

			const data = tileDataCache.current.get(`${x}/${y}/${zoom}`)
			if (!data) return

			const _tile = new VectorTile(new Pbf(data))
			const layers: Record<string, MapTileLayer> = {}
			for (const name in _tile.layers) {
				const layer = _tile.layers[name]!

				let features: MapLayerFeature[] = []
				for (let i = 0; i < layer.length; i++) {
					const feature = layer.feature(i)
					features.push({
						extent: feature.extent,
						type: VectorTileFeature.types[feature.type],
						id: feature.id,
						properties: feature.properties,
						geoJson: feature.toGeoJSON(x, y, zoom),
					})
				}

				layers[name] = {
					version: layer.version,
					name: layer.name,
					extent: layer.extent,
					features,
				}
			}

			if (tileCache.current.has(`${x}/${y}/${zoom}`)) {
				const tile = tileCache.current.get(`${x}/${y}/${zoom}`)!
				tile.draw(pass, webgpuContext.current)
			} else {
				const tile = new MapTile({x, y, zoom, layers}, webgpuContext.current)
				tileCache.current.set(`${x}/${y}/${zoom}`, tile)
				tile.draw(pass, webgpuContext.current)
			}
		})

		pass.end()
		const commandBuffer = encoder.finish()
		device.queue.submit([commandBuffer])
	})

	return (
		<motion.canvas
			ref={canvasRef}
			className="h-full w-full touch-none"
			onPan={(event, info) => {
				lng.set(clamp(lng.get() - info.delta.x * degreesPerPx.get(), -180, 180))
				lat.set(clamp(lat.get() + info.delta.y * degreesPerPx.get(), -85, 85))
				updateCamera()
			}}
			onWheel={(event) => {
				const deltaY = event.deltaY * 0.01
				if (zoomChangeQueue.current) zoomChangeQueue.current.amount += deltaY
				else
					zoomChangeQueue.current = {
						amount: deltaY,
						mouseX: event.clientX,
						mouseY: event.clientY,
					}
			}}
		/>
	)
}

export const MapRoot = memo(MapRootImpl)
