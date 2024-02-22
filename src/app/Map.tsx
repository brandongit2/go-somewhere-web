"use client"

import {motion, useAnimationFrame, useMotionValue, useTransform} from "framer-motion"
import {memo, useCallback, useEffect, useRef} from "react"
import invariant from "tiny-invariant"

import {MapContext} from "./MapContext"
import {useAsyncError} from "@/hooks/use-async-error"
import {Vec2} from "@/math/Vec2"
import {clamp} from "@/util"

let didInit = false

const MapRootImpl = () => {
	const throwError = useAsyncError()
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const mapContext = useRef<MapContext | null>(null)

	const handleResize = useCallback(() => {
		if (!mapContext.current) return
		const {device, canvasElement} = mapContext.current

		const width = canvasElement.getBoundingClientRect().width
		const height = canvasElement.getBoundingClientRect().height
		mapContext.current.width = width
		mapContext.current.height = height

		canvasElement.width = clamp(width, 1, device.limits.maxTextureDimension2D) * devicePixelRatio
		canvasElement.height = clamp(height, 1, device.limits.maxTextureDimension2D) * devicePixelRatio

		mapContext.current.updateCamera()
	}, [])
	useEffect(() => {
		window.addEventListener(`resize`, handleResize)
		return () => window.removeEventListener(`resize`, handleResize)
	}, [handleResize])

	useEffect(() => {
		if (didInit) return
		invariant(canvasRef.current)

		MapContext.create(canvasRef.current)
			.then((context) => {
				mapContext.current = context
				handleResize()
			})
			.catch(throwError)

		didInit = true
	}, [handleResize, throwError])

	// Render
	const mousePos = useMotionValue<[number, number] | null>(null)
	const mousePosWorld = useTransform(mousePos, (p) => {
		if (!mapContext.current || !p) return null
		const {width, height, lng, lat, degreesPerPx} = mapContext.current

		const pos = new Vec2(lng, lat)
		const cursorX = p[0] - width / 2
		const cursorY = -(p[1] - height / 2)
		return new Vec2(cursorX, cursorY).times(degreesPerPx).plus(pos)
	})
	const zoomChangeAmount = useRef(0)
	useAnimationFrame(() => {
		if (!mapContext.current) return
		const {height, width, lng, lat, zoom, degreesPerPx} = mapContext.current

		const mp = mousePos.get()
		const mpw = mousePosWorld.get()
		if (zoomChangeAmount.current && mp && mpw) {
			const newZoom = clamp(zoom - zoomChangeAmount.current, 0, 18)
			const scaleChange = 2 ** (newZoom - zoom)

			mapContext.current.lng = clamp(lng + (mp[0] - 0.5 * width) * (1 - 1 / scaleChange) * degreesPerPx, -180, 180)
			mapContext.current.lat = clamp(lat - (mp[1] - 0.5 * height) * (1 - 1 / scaleChange) * degreesPerPx, -85, 85)
			mapContext.current.zoom = newZoom

			mapContext.current.updateCamera()
			zoomChangeAmount.current = 0
		}

		mapContext.current.render()
	})

	return (
		<motion.canvas
			ref={canvasRef}
			className="h-full w-full touch-none"
			onPointerMove={(event) => {
				mousePos.set([event.clientX, event.clientY])
			}}
			onPan={(event, info) => {
				if (!mapContext.current) return
				const {lng, lat, degreesPerPx, updateCamera} = mapContext.current

				mapContext.current.lng = clamp(lng - info.delta.x * degreesPerPx, -180, 180)
				mapContext.current.lat = clamp(lat + info.delta.y * degreesPerPx, -85, 85)
				updateCamera()
			}}
			onWheel={(event) => {
				zoomChangeAmount.current += event.deltaY * 0.01
			}}
		/>
	)
}

export const MapRoot = memo(MapRootImpl)
