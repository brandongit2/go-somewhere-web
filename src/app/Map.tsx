"use client"

import {motion, useAnimationFrame, useMotionValue, useTransform} from "framer-motion"
import {memo, useCallback, useEffect, useRef} from "react"
import invariant from "tiny-invariant"

import {useAsyncError} from "@/hooks/use-async-error"
import {type MapContext} from "@/map/MapContext"
import {MapRoot} from "@/map/MapRoot"
import {Vec2} from "@/math/Vec2"
import {clamp} from "@/util"

const MapImpl = () => {
	const throwError = useAsyncError()
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const mapRoot = useRef<MapRoot | null>(null)
	const mapContext = useRef<MapContext | null>(null)

	const handleResize = useCallback(() => {
		if (!mapRoot.current || !mapContext.current) return

		const {canvasElement, device} = mapContext.current

		mapContext.current.width = clamp(
			canvasElement.getBoundingClientRect().width,
			1,
			device.limits.maxTextureDimension2D,
		)
		mapContext.current.height = clamp(
			canvasElement.getBoundingClientRect().height,
			1,
			device.limits.maxTextureDimension2D,
		)
		mapRoot.current.updateCamera()
	}, [])
	useEffect(() => {
		window.addEventListener(`resize`, handleResize)
		return () => window.removeEventListener(`resize`, handleResize)
	}, [handleResize])

	useEffect(() => {
		invariant(canvasRef.current)

		MapRoot.create(canvasRef.current)
			.then(([root, context]) => {
				mapRoot.current = root
				mapContext.current = context
				handleResize()
			})
			.catch(throwError)

		return () => {
			if (mapRoot.current) mapRoot.current.destroy()
		}
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
		if (!mapRoot.current || !mapContext.current) return
		const {height, width, lng, lat, zoom, degreesPerPx} = mapContext.current

		const mp = mousePos.get()
		const mpw = mousePosWorld.get()
		if (zoomChangeAmount.current && mp && mpw) {
			const newZoom = clamp(zoom - zoomChangeAmount.current, 0, 18)
			const scaleChange = 2 ** (newZoom - zoom)

			mapContext.current.lng = clamp(lng + (mp[0] - 0.5 * width) * (1 - 1 / scaleChange) * degreesPerPx, -180, 180)
			mapContext.current.lat = clamp(lat - (mp[1] - 0.5 * height) * (1 - 1 / scaleChange) * degreesPerPx, -85, 85)
			mapContext.current.zoom = newZoom

			mapRoot.current.updateCamera()
			zoomChangeAmount.current = 0
		}

		mapRoot.current.render()
	})

	return (
		<motion.canvas
			ref={canvasRef}
			className="h-full w-full touch-none"
			onPointerMove={(event) => {
				mousePos.set([event.clientX, event.clientY])
			}}
			onPan={(event, info) => {
				if (!mapRoot.current || !mapContext.current) return
				const {lng, lat, degreesPerPx} = mapContext.current

				mapContext.current.lng = ((lng - info.delta.x * degreesPerPx + 180) % 360) - 180
				mapContext.current.lat = clamp(lat + info.delta.y * degreesPerPx, -85, 85)
				mapRoot.current.updateCamera()
			}}
			onWheel={(event) => {
				zoomChangeAmount.current += event.deltaY * 0.01
			}}
		/>
	)
}

export const Map = memo(MapImpl)
